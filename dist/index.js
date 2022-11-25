'use strict';

var detectIncognito = require('detect-incognito');
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

function _typeof(obj) {
  "@babel/helpers - typeof";

  return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) {
    return typeof obj;
  } : function (obj) {
    return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
  }, _typeof(obj);
}

function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}

function _defineProperties(target, props) {
  for (var i = 0; i < props.length; i++) {
    var descriptor = props[i];
    descriptor.enumerable = descriptor.enumerable || false;
    descriptor.configurable = true;
    if ("value" in descriptor) descriptor.writable = true;
    Object.defineProperty(target, descriptor.key, descriptor);
  }
}

function _createClass(Constructor, protoProps, staticProps) {
  if (protoProps) _defineProperties(Constructor.prototype, protoProps);
  if (staticProps) _defineProperties(Constructor, staticProps);
  Object.defineProperty(Constructor, "prototype", {
    writable: false
  });
  return Constructor;
}

var SESSION_COOKIE_NAME = "_analytics_sid";
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

    this._is_enabled = (typeof window === "undefined" ? "undefined" : _typeof(window)) === "object";
  }

  _createClass(PvAnalytics, [{
    key: "init",
    value: function init() {
      var _this = this;

      if (!this._is_enabled) {
        this._log("service is disabled");

        return new Promise(function (resolve) {
          return resolve();
        });
      }

      return detectIncognito.detectIncognito().then(function (result) {
        return _this._is_incognito = result.isPrivate;
      }).then(function () {
        return _this._startSession();
      }).then(function () {
        return _this._processQueuedEvents();
      })["catch"](function (error) {
        return _this._log(error);
      });
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
        this._log("'event_name' is invalid");

        return;
      }

      if (_typeof(user_data) !== "object") {
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
        this._event_queue.push({
          event_name: event_name,
          user_data: user_data
        });
      }
    }
  }, {
    key: "getSessionToken",
    value: function getSessionToken() {
      return cookie__default["default"].get(SESSION_COOKIE_NAME);
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
      var _this2 = this;

      var session_token = this.getSessionToken();

      if (session_token) {
        var parts = atob(session_token).split(".");

        if (parts.length === 3 && parts[0] === this.app_token) {
          this._is_initialized = true;
          return;
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
            _this2._is_initialized = true;
            cookie__default["default"].set(SESSION_COOKIE_NAME, _session_token);
          } else {
            _this2._endSession();
          }
        } else {
          _this2._endSession();
        }
      })["catch"](function (error) {
        _this2._endSession();

        _this2._log(error);
      });
    }
  }, {
    key: "_endSession",
    value: function _endSession() {
      this._is_initialized = false;
      cookie__default["default"].remove(SESSION_COOKIE_NAME);
    }
  }, {
    key: "_sendEvent",
    value: function _sendEvent(event_name) {
      var _this3 = this;

      var user_data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      var params = ___default["default"].extend({}, this._defaults, {
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

      return axios__namespace.post("".concat(this.base_url, "/event"), params)["catch"](function (error) {
        return _this3._log(error);
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
    value: function _log(msg) {
      if (this._debug) {
        console.error("[PvAnalytics] ".concat(msg));
      }
    }
  }, {
    key: "_isValidHttpUrl",
    value: function _isValidHttpUrl(string) {
      var url;

      try {
        url = new URL(string);
      } catch (_) {
        return false;
      }

      return url.protocol === "http:" || url.protocol === "https:";
    }
  }]);

  return PvAnalytics;
}();

PvAnalytics.EVENT_TYPE_ERROR = "_error";
PvAnalytics.EVENT_TYPE_LEAVE = "_leave";
PvAnalytics.EVENT_TYPE_CLICK = "_click";

module.exports = PvAnalytics;
