'use strict';

var detectIncognito = require('detect-incognito');
var Bowser = require('bowser');
var axios = require('axios');
var cookie = require('js-cookie');

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

    this._is_enabled = true;
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

      var session_token = this._getSessionToken();

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
        if (response.data) {
          _this2._is_initialized = !!response.data.session_token;
          cookie__default["default"].set(SESSION_COOKIE_NAME, response.data.session_token);
        }
      });
    }
  }, {
    key: "_endSession",
    value: function _endSession() {
      this._is_initialized = false;
      cookie__default["default"].remove(SESSION_COOKIE_NAME);
    }
  }, {
    key: "_getSessionToken",
    value: function _getSessionToken() {
      return cookie__default["default"].get(SESSION_COOKIE_NAME);
    }
  }, {
    key: "_sendEvent",
    value: function _sendEvent(event_name) {
      var _this3 = this;

      var user_data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var params = {
        session_token: this._getSessionToken(),
        event_name: event_name,
        browser: this._getBrowserDetails(),
        timestamp: new Date().getTime(),
        timezone: this._getTimeZone(),
        page_url: this._getPageUrl(),
        referring_url: this._getReferringUrl(),
        is_incognito: this._is_incognito,
        user_data: user_data
      };

      var page_load_time = this._pageLoadTime();

      if (page_load_time > 0) {
        params.page_load_time = page_load_time;
      }

      return axios__namespace.post("".concat(this.base_url, "/event"), params)["catch"](function (error) {
        return _this3._log(error);
      });
    }
  }, {
    key: "_pageLoadTime",
    value: function _pageLoadTime() {
      if (window && window.performance && window.performance.timing) {
        return window.performance.timing.loadEventEnd - window.performance.timing.navigationStart;
      }

      return null;
    }
  }, {
    key: "_getBrowserDetails",
    value: function _getBrowserDetails() {
      if (window && window.navigator) {
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
      if (window) {
        return window.location.href;
      }

      return null;
    }
  }, {
    key: "_getReferringUrl",
    value: function _getReferringUrl() {
      if (document) {
        return document.referrer;
      }

      return null;
    }
  }, {
    key: "_log",
    value: function _log(msg) {
      console.error("[PvAnalytics] ".concat(msg));
    }
  }]);

  return PvAnalytics;
}();

PvAnalytics.EVENT_TYPE_ERROR = "_error";
PvAnalytics.EVENT_TYPE_LEAVE = "_leave";
PvAnalytics.EVENT_TYPE_CLICK = "_click";

var index = {
  install: function install(Vue) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    Vue.prototype.$pvAnalytics = new PvAnalytics(options);
    Vue.prototype.$pvAnalytics.init();

    if (options.track_errors) {
      Vue.mixin({
        errorCaptured: function errorCaptured(err, vm, info) {
          if (Vue.prototype.$pvAnalytics) {
            Vue.prototype.$pvAnalytics.event(PvAnalytics.EVENT_TYPE_ERROR, {
              message: err.toString(),
              componennt: vm.$options.name,
              stack: err.stack,
              info: info
            });
          }

          return true;
        }
      });
    }

    if (options.track_leave && window) {
      window.addEventListener("beforeunload", function () {
        if (Vue.prototype.$pvAnalytics) {
          Vue.prototype.$pvAnalytics.event(PvAnalytics.EVENT_TYPE_LEAVE);
        }
      }, {
        capture: true
      });
    }

    if (options.track_clicks && click) {
      window.addEventListener("click", function () {
        if (Vue.prototype.$pvAnalytics) {
          Vue.prototype.$pvAnalytics.event(PvAnalytics.EVENT_TYPE_CLICK, {
            html: e.target.outerHTML,
            "class": e.target.className
          });
        }
      });
    }
  }
};

module.exports = index;
