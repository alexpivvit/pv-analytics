
import {detectIncognito} from "detect-incognito";
import * as Bowser from "bowser";
import * as axios from "axios";
import cookie from "js-cookie";
import _ from "lodash";

const SESSION_COOKIE_NAME = "_analytics_sid";

/**
// session token structure
const session_token = "{app_token}.{timestamp}.{random_string}";
**/

class PvAnalytics {
    constructor(options = {}) {
        this._app = options.app;
        this._defaults = {};
        this._debug = !!options.debug;
        this._is_enabled = false;
        this._is_incognito = false;
        this._is_initialized = false;
        this._event_queue = [];

        if (options.app_token) {
            this.app_token = options.app_token;
        } else {
            this._log("'app_token' is invalid");
            return;
        }

        if (options.app_name) {
            this.app_name = options.app_name;
        } else {
            this._log("'app_name' is invalid");
            return;
        }

        if (options.base_url) {
            this.base_url = options.base_url;
        } else {
            this._log("'base_url' is invalid");
            return;
        }

        this._is_enabled = typeof window === "object";
    }

    init() {
        if (!this._is_enabled) {
            this._log("service is disabled");
            return new Promise((resolve) => resolve());
        }

        return detectIncognito()
            .then((result) => this._is_incognito = result.isPrivate)
            .then(() => this._startSession())
            .then(() => this._processQueuedEvents())
            .catch((error) => this._log(error));
    }

    setDefaults(defaults = {}) {
        this._defaults = defaults;
    }

    event(event_name, user_data = {}) {
        event_name = (event_name || "").trim();

        if (event_name === "") {
            this._log("'event_name' is invalid");
            return;
        }

        if (typeof user_data !== "object") {
            this._log("'user_data' is invalid");
            return;
        }

        if (!this._is_enabled) {
            this._log("service is disabled");
            return;
        }

        if (this._is_initialized) {
            this._sendEvent(event_name, user_data);
        } else {
            this._event_queue.push({event_name, user_data});
        }
    }

    getSessionToken() {
        return cookie.get(SESSION_COOKIE_NAME);
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
                this._is_initialized = true;
                return;
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
                        this._is_initialized = true;
                        cookie.set(SESSION_COOKIE_NAME, session_token);
                    } else {
                        this._endSession();
                    }
                } else {
                    this._endSession();
                }
            })
            .catch((error) => {
                this._endSession();
                this._log(error);
            });
    }

    _endSession() {
        this._is_initialized = false;
        cookie.remove(SESSION_COOKIE_NAME);
    }

    _sendEvent(event_name, user_data = {}) {
        const params = _.extend({}, this._defaults, {
            session_token: this.getSessionToken(),
            event_name,
            browser: this._getBrowserDetails(),
            timestamp: (new Date()).getTime(),
            timezone: this._getTimeZone(),
            page_location: this._getPageUrl(),
            referring_url: this._getReferringUrl(),
            is_incognito: this._is_incognito,
            query_params: this._getQueryParams(),
            user_data
        });

        const page_load_time = this._pageLoadTime();

        if (page_load_time > 0) {
            params.page_load_time = page_load_time;
        }

        return axios.post(`${this.base_url}/event`, params)
            .catch((error) => this._log(error));
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
        if (this._app &&
            this._app.$route &&
            this._isValidHttpUrl(this._app.$route.query.referrer)
        ) {
            return this._app.$route.query.referrer;
        }

        if (document) {
            return document.referrer;
        }

        return null;
    }

    _log(msg) {
        if (this._debug) {
            console.error(`[PvAnalytics] ${msg}`);
        }
    }

    _isValidHttpUrl(string) {
        let url;
        
        try {
          url = new URL(string);
        } catch (_) {
          return false;  
        }
      
        return url.protocol === "http:" || url.protocol === "https:";
    }
}

PvAnalytics.EVENT_TYPE_ERROR = "_error";
PvAnalytics.EVENT_TYPE_LEAVE = "_leave";
PvAnalytics.EVENT_TYPE_CLICK = "_click";

export default PvAnalytics;
