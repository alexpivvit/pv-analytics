'use strict';

var detectincognitojs = require('detectincognitojs');
var Bowser = require('bowser');
var axios = require('axios');
var cookie = require('js-cookie');
var _ = require('lodash');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n["default"] = e;
  return Object.freeze(n);
}

var Bowser__namespace = /*#__PURE__*/_interopNamespace(Bowser);
var axios__namespace = /*#__PURE__*/_interopNamespace(axios);
var cookie__default = /*#__PURE__*/_interopDefaultLegacy(cookie);
var ___default = /*#__PURE__*/_interopDefaultLegacy(_);

function _classCallCheck(a, n) {
  if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function");
}
function _defineProperties(e, r) {
  for (var t = 0; t < r.length; t++) {
    var o = r[t];
    o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o);
  }
}
function _createClass(e, r, t) {
  return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, "prototype", {
    writable: !1
  }), e;
}
function _toPrimitive(t, r) {
  if ("object" != typeof t || !t) return t;
  var e = t[Symbol.toPrimitive];
  if (void 0 !== e) {
    var i = e.call(t, r || "default");
    if ("object" != typeof i) return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return ("string" === r ? String : Number)(t);
}
function _toPropertyKey(t) {
  var i = _toPrimitive(t, "string");
  return "symbol" == typeof i ? i : i + "";
}
function _typeof(o) {
  "@babel/helpers - typeof";

  return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) {
    return typeof o;
  } : function (o) {
    return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o;
  }, _typeof(o);
}

var SESSION_COOKIE_NAME = "_analytics_sid";
var INITIAL_SESSION_COOKIE_NAME = "_analytics_initial_sid";

/**
// session token structure
const session_token = "{app_token}.{timestamp}.{random_string}";
**/
var PvAnalytics = /*#__PURE__*/function () {
  function PvAnalytics() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    _classCallCheck(this, PvAnalytics);
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
    this._session_domain = options.session_domain || ((typeof window === "undefined" ? "undefined" : _typeof(window)) === "object" ? window.location.host : "");
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
    this._is_enabled = (typeof window === "undefined" ? "undefined" : _typeof(window)) === "object";
  }
  return _createClass(PvAnalytics, [{
    key: "init",
    value: function init() {
      var _this = this;
      var retry_attempts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
      if (___default["default"].isNull(retry_attempts)) {
        retry_attempts = this._retry_attempts;
      }
      if (!this._is_enabled) {
        this._log("PvAnalytics::init()", "service is disabled");
        return new Promise(function (resolve) {
          return resolve();
        });
      }
      return this._detectIncognito().then(function (result) {
        return _this._is_incognito = result;
      }).then(function () {
        return _this._startSession();
      }).then(function () {
        return _this._processQueuedEvents();
      })["catch"](function (error) {
        _this._log("PvAnalytics::init() error:", error);
        if (typeof _this._error_callback === "function") {
          _this._error_callback(error);
        }
        if (_this._retry_on_failure && _this._retry_delay > 0 && retry_attempts > 0) {
          setTimeout(function () {
            return _this.init(--retry_attempts);
          }, _this._retry_delay);
        }
      });
    }
  }, {
    key: "restartSession",
    value: function restartSession() {
      this._endSession();
      return this.init();
    }
  }, {
    key: "setDefaults",
    value: function setDefaults() {
      var defaults = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      this._defaults = defaults;
    }
  }, {
    key: "event",
    value: function event(event_name) {
      var user_data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      event_name = (event_name || "").trim();
      if (event_name === "") {
        this._log("PvAnalytics::event()", "'event_name' is invalid");
        return;
      }
      if (_typeof(user_data) !== "object") {
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
        this._event_queue.push({
          event_name: event_name,
          user_data: user_data
        });
      }
    }
  }, {
    key: "getSessionToken",
    value: function getSessionToken() {
      var session_token = cookie__default["default"].get(SESSION_COOKIE_NAME);
      if (!session_token && (typeof sessionStorage === "undefined" ? "undefined" : _typeof(sessionStorage)) === "object") {
        session_token = sessionStorage.getItem(SESSION_COOKIE_NAME);
      }
      this._log("PvAnalytics::getSessionToken()", session_token);
      return session_token;
    }
  }, {
    key: "getInitialSessionToken",
    value: function getInitialSessionToken() {
      var initial_session_token = cookie__default["default"].get(INITIAL_SESSION_COOKIE_NAME);
      if (!initial_session_token && (typeof sessionStorage === "undefined" ? "undefined" : _typeof(sessionStorage)) === "object") {
        initial_session_token = sessionStorage.getItem(INITIAL_SESSION_COOKIE_NAME);
      }
      this._log("PvAnalytics::getInitialSessionToken()", initial_session_token);
      return initial_session_token;
    }
  }, {
    key: "_detectIncognito",
    value: function _detectIncognito() {
      return new Promise(function (resolve) {
        detectincognitojs.detectIncognito().then(function (result) {
          return resolve(!!result.isPrivate);
        })["catch"](function () {
          return resolve(false);
        });
      });
    }
  }, {
    key: "_restartSessionDebounced",
    value: function _restartSessionDebounced() {
      var _this2 = this;
      this._log("PvAnalytics::event()", "session will be restarted in ".concat(this._inactivity_timeout, "s"));
      this._session_timeout_handler = setTimeout(function () {
        _this2._log("PvAnalytics::event()", "restart current session...");
        _this2.restartSession();
      }, this._inactivity_timeout * 1000);
    }
  }, {
    key: "_processQueuedEvents",
    value: function _processQueuedEvents() {
      while (this._event_queue.length > 0) {
        var event = this._event_queue.shift();
        this._sendEvent(event.event_name, event.user_data);
      }
    }
  }, {
    key: "_startSession",
    value: function _startSession() {
      var _this3 = this;
      var session_token = this.getSessionToken();
      if (session_token) {
        var parts = atob(session_token).split(".");
        if (parts.length === 3 && parts[0] === this.app_token) {
          if (this._promise) {
            return this._promise.then(function () {
              _this3._is_initialized = true;
              _this3._log("PvAnalytics::_startSession()", "service is ready (async)");
            });
          }
          this._is_initialized = true;
          this._log("PvAnalytics::_startSession()", "service is ready");
          return new Promise(function (resolve) {
            return resolve();
          });
        } else {
          this._endSession();
        }
      }
      var params = {
        app_token: this.app_token,
        app_name: this.app_name
      };
      return axios__namespace.post("".concat(this.base_url, "/session-start"), params).then(function (response) {
        if (response.data.status) {
          var _session_token = response.data.data.session_token;
          if (_session_token) {
            cookie__default["default"].set(SESSION_COOKIE_NAME, _session_token, {
              path: "/",
              domain: _this3._session_domain
            });
            if ((typeof sessionStorage === "undefined" ? "undefined" : _typeof(sessionStorage)) === "object") {
              sessionStorage.setItem(SESSION_COOKIE_NAME, _session_token);
            }
            if (_this3._promise) {
              return _this3._promise.then(function () {
                _this3._is_initialized = true;
                _this3._log("PvAnalytics::_startSession()", "service is ready (async)");
              });
            }
            _this3._is_initialized = true;
            _this3._log("PvAnalytics::_startSession()", "service is ready");
          } else {
            _this3._endSession();
          }
        } else {
          _this3._endSession();
        }
      })["catch"](function (error) {
        _this3._endSession();
        throw error;
      });
    }
  }, {
    key: "_saveInitialSessionToken",
    value: function _saveInitialSessionToken() {
      var initial_session_token = this.getInitialSessionToken();
      if (initial_session_token) {
        return;
      }
      var session_token = this.getSessionToken();
      cookie__default["default"].set(INITIAL_SESSION_COOKIE_NAME, session_token, {
        path: "/",
        domain: this._session_domain
      });
      if ((typeof sessionStorage === "undefined" ? "undefined" : _typeof(sessionStorage)) === "object") {
        sessionStorage.setItem(INITIAL_SESSION_COOKIE_NAME, session_token);
      }
    }
  }, {
    key: "_endSession",
    value: function _endSession() {
      this._saveInitialSessionToken();
      this._is_initialized = false;
      cookie__default["default"].remove(SESSION_COOKIE_NAME, {
        path: "/",
        domain: this._session_domain
      });
      if ((typeof sessionStorage === "undefined" ? "undefined" : _typeof(sessionStorage)) === "object") {
        sessionStorage.removeItem(SESSION_COOKIE_NAME);
      }
    }
  }, {
    key: "_sendEvent",
    value: function _sendEvent(event_name) {
      var _this4 = this;
      var user_data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var retry_attempts = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
      if (___default["default"].isNull(retry_attempts)) {
        retry_attempts = this._retry_attempts;
      }
      var params = ___default["default"].extend({}, this._defaults, {
        initial_session_token: this.getInitialSessionToken() || this.getSessionToken(),
        session_token: this.getSessionToken(),
        event_name: event_name,
        browser: this._getBrowserDetails(),
        timestamp: new Date().getTime(),
        timezone: this._getTimeZone(),
        page_location: this._getPageUrl(),
        referring_url: this._getReferringUrl(),
        is_incognito: this._is_incognito,
        query_params: this._getQueryParams(),
        page_load_time: 0,
        user_data: user_data
      });
      var page_load_time = this._pageLoadTime();
      if (page_load_time > 0) {
        params.page_load_time = page_load_time;
      }
      return axios__namespace.post("".concat(this.base_url, "/event"), params).then(function () {
        return _this4._log("PvAnalytics::_sendEvent()", params);
      })["catch"](function (error) {
        _this4._log("PvAnalytics::_sendEvent() error:", error);
        if (typeof _this4._error_callback === "function") {
          _this4._error_callback(error);
        }
        if (_this4._retry_on_failure && _this4._retry_delay > 0 && retry_attempts > 0) {
          setTimeout(function () {
            return _this4._sendEvent(event_name, user_data, --retry_attempts);
          }, _this4._retry_delay);
        }
      });
    }
  }, {
    key: "_getQueryParams",
    value: function _getQueryParams() {
      var query = {};
      if (this._app && this._app.$route) {
        query = ___default["default"].extend(query, this._app.$route.query);
      }
      if ((typeof window === "undefined" ? "undefined" : _typeof(window)) === "object" && typeof URLSearchParams === "function") {
        new URLSearchParams(window.location.search).forEach(function (value, key) {
          return query[key] = value.replace(/\/$/, "");
        });
      }
      if (this._preserve_utm && (typeof sessionStorage === "undefined" ? "undefined" : _typeof(sessionStorage)) === "object") {
        ___default["default"].uniq(Object.keys(query).concat(Object.keys(sessionStorage))).forEach(function (key) {
          if (/^utm_.*/.test(key)) {
            if (query[key]) {
              sessionStorage.setItem(key, query[key]);
            } else {
              query[key] = sessionStorage.getItem(key);
            }
          }
        });
      }
      return query;
    }
  }, {
    key: "_pageLoadTime",
    value: function _pageLoadTime() {
      if ((typeof window === "undefined" ? "undefined" : _typeof(window)) === "object" && window.performance && window.performance.timing) {
        return window.performance.timing.loadEventEnd - window.performance.timing.navigationStart;
      }
      return null;
    }
  }, {
    key: "_getBrowserDetails",
    value: function _getBrowserDetails() {
      if ((typeof window === "undefined" ? "undefined" : _typeof(window)) === "object") {
        return Bowser__namespace.getParser(window.navigator.userAgent).getResult();
      }
      return null;
    }
  }, {
    key: "_getTimeZone",
    value: function _getTimeZone() {
      if (Intl && Intl.DateTimeFormat) {
        return Intl && Intl.DateTimeFormat().resolvedOptions().timeZone;
      }
      return null;
    }
  }, {
    key: "_getPageUrl",
    value: function _getPageUrl() {
      if ((typeof window === "undefined" ? "undefined" : _typeof(window)) === "object") {
        return window.location.href;
      }
      return null;
    }
  }, {
    key: "_getReferringUrl",
    value: function _getReferringUrl() {
      var referrer = null;
      if ((typeof document === "undefined" ? "undefined" : _typeof(document)) === "object") {
        referrer = document.referrer;
      }
      if (this._app && this._app.$route && this._isValidHttpUrl(this._app.$route.query.referrer) && !referrer) {
        referrer = this._app.$route.query.referrer;
      }
      if (!referrer && (typeof sessionStorage === "undefined" ? "undefined" : _typeof(sessionStorage)) === "object") {
        referrer = sessionStorage.getItem("_referrer");
      }
      return referrer || null;
    }
  }, {
    key: "_log",
    value: function _log() {
      if (this._debug) {
        var _console;
        for (var _len = arguments.length, data = new Array(_len), _key = 0; _key < _len; _key++) {
          data[_key] = arguments[_key];
        }
        (_console = console).log.apply(_console, ["[PvAnalytics]"].concat(data));
      }
    }
  }, {
    key: "_isValidHttpUrl",
    value: function _isValidHttpUrl(string) {
      var url;
      try {
        url = new URL(string);
      } catch (_unused) {
        return false;
      }
      return url.protocol === "http:" || url.protocol === "https:";
    }
  }]);
}();
PvAnalytics.EVENT_TYPE_ERROR = "_error";
PvAnalytics.EVENT_TYPE_LEAVE = "_leave";
PvAnalytics.EVENT_TYPE_CLICK = "_click";

module.exports = PvAnalytics;
