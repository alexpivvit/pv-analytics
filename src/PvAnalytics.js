
import {detectIncognito} from "detect-incognito";
import * as Bowser from "bowser";
import * as axios from "axios";
import cookie from "js-cookie";

const SESSION_COOKIE_NAME = "_analytics_sid";

/**
// session token structure
const session_token = "{app_token}.{timestamp}.{random_string}";
**/

class PvAnalytics {
    constructor(options = {}) {
        this._is_incognito = false;
        this._is_initialized = false;
        this._event_queue = [];

        if (options.app_token) {
            this.app_token = options.app_token;
        } else {
            this._log("'app_token' is invalid");
        }

        if (options.app_name) {
            this.app_name = options.app_name;
        } else {
            this._log("'app_name' is invalid");
        }

        if (options.base_url) {
            this.base_url = options.base_url;
        } else {
            this._log("'base_url' is invalid");
        }
    }

    init() {
        return detectIncognito()
            .then((result) => this._is_incognito = result.isPrivate)
            .then(() => this._startSession())
            .then(() => this._processQueuedEvents())
            .catch((error) => this._log(error));
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

        if (this._is_initialized) {
            this._sendEvent(event_name, user_data);
        } else {
            this._event_queue.push({event_name, user_data});
        }
    }

    _processQueuedEvents() {
        while (this._event_queue.length > 0) {
            const event = this._event_queue.shift();
            this._sendEvent(event.event_name, event.user_data);
        }
    }

    _startSession() {
        const session_token = this._getSessionToken();

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
                if (response.data) {
                    this._is_initialized = !!response.data.session_token;
                    cookie.set(SESSION_COOKIE_NAME, response.data.session_token);
                }
            });
    }

    _endSession() {
        this._is_initialized = false;
        cookie.remove(SESSION_COOKIE_NAME);
    }

    _getSessionToken() {
        return cookie.get(SESSION_COOKIE_NAME);
    }

    _sendEvent(event_name, user_data = {}) {
        const params = {
            session_token: this._getSessionToken(),
            event_name,
            browser: this._getBrowserDetails(),
            timestamp: (new Date()).getTime(),
            timezone: this._getTimeZone(),
            page_url: this._getPageUrl(),
            referring_url: this._getReferringUrl(),
            is_incognito: this._is_incognito,
            user_data
        };

        const page_load_time = this._pageLoadTime();

        if (page_load_time > 0) {
            params.page_load_time = page_load_time;
        }

        return axios.post(`${this.base_url}/event`, params)
            .catch((error) => this._log(error));
    }

    _pageLoadTime() {
        if (window && window.performance && window.performance.timing) {
            return window.performance.timing.loadEventEnd - window.performance.timing.navigationStart;
        }

        return null;
    }

    _getBrowserDetails() {
        if (window && window.navigator) {
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
        if (window) {
            return window.location.href;
        }

        return null;
    }

    _getReferringUrl() {
        if (document) {
            return document.referrer;
        }

        return null;
    }

    _log(msg) {
        console.error(`[PvAnalytics] ${msg}`);
    }
}

PvAnalytics.EVENT_TYPE_ERROR = "_error";
PvAnalytics.EVENT_TYPE_LEAVE = "_leave";
PvAnalytics.EVENT_TYPE_CLICK = "_click";

export default PvAnalytics;
