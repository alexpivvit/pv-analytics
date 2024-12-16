import { detectIncognito } from "detect-incognito";
import * as Bowser from "bowser";
import * as axios from "axios";
import cookie from "js-cookie";
import _ from "lodash";

const SESSION_COOKIE_NAME = "_analytics_sid";

const INITIAL_SESSION_COOKIE_NAME = "_analytics_initial_sid";

/**
// session token structure
const session_token = "{app_token}.{timestamp}.{random_string}";
**/

class PvAnalytics {
    constructor(options = {}) {
        this._app = options.app;
        this._defaults = {};
        this._debug = !!options.debug;
        this._preserve_utm = !!options.preserve_utm;
        this._is_enabled = false;
        this._is_incognito = false;
        this._is_initialized = false;
        this._retry_on_failure = options.retry_on_failure || false;
        this._retry_delay = options.retry_delay || 250;
        this._retry_attempts = options.retry_attempts || 1;
        this._event_queue = [];
        this._session_domain = options.session_domain || (typeof window === "object" ? window.location.host : "");
        this._error_callback = options.error_callback;
        this._promise = options.promise;
        this._inactivity_timeout = options.inactivity_timeout || -1;
        this._last_action_timestamp = null;
        this._session_timeout_handler = null;

        if (options.app_token) {
            this.app_token = options.app_token;
        } else {
            this._log("PvAnalytics::constructor()", "'app_token' is invalid");
            return;
        }

        if (options.app_name) {
            this.app_name = options.app_name;
        } else {
            this._log("PvAnalytics::constructor()", "'app_name' is invalid");
            return;
        }

        if (options.base_url) {
            this.base_url = options.base_url;
        } else {
            this._log("PvAnalytics::constructor()", "'base_url' is invalid");
            return;
        }

        this._is_enabled = typeof window === "object";
    }

    init(retry_attempts = null) {
        if (_.isNull(retry_attempts)) {
            retry_attempts = this._retry_attempts;
        }

        if (!this._is_enabled) {
            this._log("PvAnalytics::init()", "service is disabled");
            return new Promise((resolve) => resolve());
        }

        return this._detectIncognito()
            .then((result) => this._is_incognito = result)
            .then(() => this._startSession())
            .then(() => this._processQueuedEvents())
            .catch((error) => {
                this._log("PvAnalytics::init() error:", error);

                if (typeof this._error_callback === "function") {
                    this._error_callback(error);
                }

                if (this._retry_on_failure &&
                    this._retry_delay > 0 &&
                    retry_attempts > 0
                ) {
                    setTimeout(() => this.init(--retry_attempts), this._retry_delay);
                }
            });
    }

    restartSession() {
        this._endSession();

        return this.init();
    }

    setDefaults(defaults = {}) {
        this._defaults = defaults;
    }

    event(event_name, user_data = {}) {
        event_name = (event_name || "").trim();

        if (event_name === "") {
            this._log("PvAnalytics::event()", "'event_name' is invalid");
            return;
        }

        if (typeof user_data !== "object") {
            this._log("PvAnalytics::event()", "'user_data' is invalid");
            return;
        }

        if (!this._is_enabled) {
            this._log("PvAnalytics::event()", "service is disabled");
            return;
        }

        if (this._inactivity_timeout > 0) {
            if (this._session_timeout_handler) {
                this._log("PvAnalytics::event()", "clearing the timeout handler...");
                clearTimeout(this._session_timeout_handler);
            }

            this._restartSessionDebounced();
        }

        this._last_action_timestamp = Date.now();

        if (this._is_initialized) {
            this._sendEvent(event_name, user_data);
        } else {
            this._event_queue.push({event_name, user_data});
        }
    }

    getSessionToken() {
        let session_token = cookie.get(SESSION_COOKIE_NAME);

        if (!session_token && typeof sessionStorage === "object") {
            session_token = sessionStorage.getItem(SESSION_COOKIE_NAME);
        }

        this._log("PvAnalytics::getSessionToken()", session_token);

        return session_token;
    }

    getInitialSessionToken() {
        let initial_session_token = cookie.get(INITIAL_SESSION_COOKIE_NAME);

        if (!initial_session_token && typeof sessionStorage === "object") {
            initial_session_token = sessionStorage.getItem(INITIAL_SESSION_COOKIE_NAME);
        }

        this._log("PvAnalytics::getInitialSessionToken()", initial_session_token);

        return initial_session_token;
    }

    _detectIncognito() {
        return new Promise((resolve) => {
            detectIncognito()
                .then((result) => resolve(!!result.isPrivate))
                .catch(() => resolve(false));
        })
    }

    _restartSessionDebounced() {
        this._log("PvAnalytics::event()", `session will be restarted in ${this._inactivity_timeout}s`);

        this._session_timeout_handler = setTimeout(() => {
            this._log("PvAnalytics::event()", `restart current session...`);
            this.restartSession();
        }, this._inactivity_timeout * 1000);
    }

    _processQueuedEvents() {
        while (this._event_queue.length > 0) {
            const event = this._event_queue.shift();
            this._sendEvent(event.event_name, event.user_data);
        }
    }

    _startSession() {
        const session_token = this.getSessionToken();

        if (session_token) {
            const parts = atob(session_token).split(".");

            if (parts.length === 3 && parts[0] === this.app_token) {
                if (this._promise) {
                    return this._promise
                        .then(() => {
                            this._is_initialized = true;
                            this._log("PvAnalytics::_startSession()", "service is ready (async)");
                        })
                }

                this._is_initialized = true;
                this._log("PvAnalytics::_startSession()", "service is ready");

                return new Promise((resolve) => resolve());
            } else {
                this._endSession();
            }
        }

        const params = {
            app_token: this.app_token,
            app_name: this.app_name
        };

        return axios.post(`${this.base_url}/session-start`, params)
            .then((response) => {
                if (response.data.status) {
                    const session_token = response.data.data.session_token;

                    if (session_token) {
                        cookie.set(SESSION_COOKIE_NAME, session_token, {
                            path: "/",
                            domain: this._session_domain
                        });

                        if (typeof sessionStorage === "object") {
                            sessionStorage.setItem(SESSION_COOKIE_NAME, session_token);
                        }

                        if (this._promise) {
                            return this._promise
                                .then(() => {
                                    this._is_initialized = true;
                                    this._log("PvAnalytics::_startSession()", "service is ready (async)");
                                })
                        }

                        this._is_initialized = true;
                        this._log("PvAnalytics::_startSession()", "service is ready");
                    } else {
                        this._endSession();
                    }
                } else {
                    this._endSession();
                }
            })
            .catch((error) => {
                this._endSession();
                throw error;
            });
    }

    _saveInitialSessionToken() {
        const initial_session_token = this.getInitialSessionToken();

        if (initial_session_token) {
            return;
        }

        const session_token = this.getSessionToken();

        cookie.set(INITIAL_SESSION_COOKIE_NAME, session_token, {
            path: "/",
            domain: this._session_domain
        });

        if (typeof sessionStorage === "object") {
            sessionStorage.setItem(INITIAL_SESSION_COOKIE_NAME, session_token);
        }
    }

    _endSession() {
        this._saveInitialSessionToken();

        this._is_initialized = false;

        cookie.remove(SESSION_COOKIE_NAME, {
            path: "/",
            domain: this._session_domain
        });

        if (typeof sessionStorage === "object") {
            sessionStorage.removeItem(SESSION_COOKIE_NAME);
        }
    }

    _sendEvent(event_name, user_data = {}, retry_attempts = null) {
        if (_.isNull(retry_attempts)) {
            retry_attempts = this._retry_attempts;
        }

        const params = _.extend({}, this._defaults, {
            initial_session_token: this.getInitialSessionToken() || this.getSessionToken(),
            session_token: this.getSessionToken(),
            event_name,
            browser: this._getBrowserDetails(),
            timestamp: (new Date()).getTime(),
            timezone: this._getTimeZone(),
            page_location: this._getPageUrl(),
            referring_url: this._getReferringUrl(),
            is_incognito: this._is_incognito,
            query_params: this._getQueryParams(),
            page_load_time: 0,
            user_data
        });

        const page_load_time = this._pageLoadTime();

        if (page_load_time > 0) {
            params.page_load_time = page_load_time;
        }

        return axios.post(`${this.base_url}/event`, params)
            .then(() => this._log("PvAnalytics::_sendEvent()", params))
            .catch((error) => {
                this._log("PvAnalytics::_sendEvent() error:", error);

                if (typeof this._error_callback === "function") {
                    this._error_callback(error);
                }

                if (this._retry_on_failure &&
                    this._retry_delay > 0 &&
                    retry_attempts > 0
                ) {
                    setTimeout(() => this._sendEvent(event_name, user_data, --retry_attempts), this._retry_delay);
                }
            });
    }

    _getQueryParams() {
        let query = {};

        if (this._app && this._app.$route) {
            query = _.extend(query, this._app.$route.query);
        }

        if (typeof window === "object" && typeof URLSearchParams === "function") {
            (new URLSearchParams(window.location.search))
                .forEach((value, key) => query[key] = value.replace(/\/$/, ""));
        }

        if (this._preserve_utm && typeof sessionStorage === "object") {
            _.uniq(Object.keys(query).concat(Object.keys(sessionStorage)))
                .forEach((key) => {
                    if (/^utm_.*/.test(key)) {
                        if (query[key]) {
                            sessionStorage.setItem(key, query[key])
                        } else {
                            query[key] = sessionStorage.getItem(key);
                        }
                    }
                });
        }

        return query;
    }

    _pageLoadTime() {
        if (typeof window === "object" && window.performance && window.performance.timing) {
            return window.performance.timing.loadEventEnd - window.performance.timing.navigationStart;
        }

        return null;
    }

    _getBrowserDetails() {
        if (typeof window === "object") {
            return Bowser.getParser(window.navigator.userAgent)
                .getResult();
        }

        return null;
    }

    _getTimeZone() {
        if (Intl && Intl.DateTimeFormat) {
            return Intl && Intl.DateTimeFormat().resolvedOptions().timeZone;
        }

        return null;
    }

    _getPageUrl() {
        if (typeof window === "object") {
            return window.location.href;
        }

        return null;
    }

    _getReferringUrl() {
        let referrer = null;

        if (typeof document === "object") {
            referrer = document.referrer;
        }

        if (this._app &&
            this._app.$route &&
            this._isValidHttpUrl(this._app.$route.query.referrer) &&
            !referrer
        ) {
            referrer = this._app.$route.query.referrer;
        }

        if (!referrer && typeof sessionStorage === "object") {
            referrer = sessionStorage.getItem("_referrer");
        }

        return referrer || null;
    }

    _log(...data) {
        if (this._debug) {
            console.log("[PvAnalytics]", ...data);
        }
    }

    _isValidHttpUrl(string) {
        let url;
        
        try {
          url = new URL(string);
        } catch {
          return false;  
        }
      
        return url.protocol === "http:" || url.protocol === "https:";
    }
}

PvAnalytics.EVENT_TYPE_ERROR = "_error";
PvAnalytics.EVENT_TYPE_LEAVE = "_leave";
PvAnalytics.EVENT_TYPE_CLICK = "_click";

export default PvAnalytics;
