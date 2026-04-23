import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import cookie from "js-cookie";
import PvAnalytics from "./index.js";

vi.mock("detect-incognito", () => ({
    detectIncognito: () => Promise.resolve({ isPrivate: false })
}));

const mock = new MockAdapter(axios);

const defaultOptions = {
    app_token: "test-token",
    app_name: "Test App",
    base_url: "https://example.com",
    is_enabled: true,
    session_domain: "localhost" 
};

const mockSessionToken = btoa("test-token.1234567890.abc123");

beforeEach(() => {
    mock.reset();
    cookie.remove("_analytics_sid");
    cookie.remove("_analytics_initial_sid");
    sessionStorage.clear();
});

describe("constructor", () => {
    it("requires app_token", () => {
        const instance = new PvAnalytics({ ...defaultOptions, app_token: null });
        expect(instance.app_token).toBeUndefined();
    });

    it("requires app_name", () => {
        const instance = new PvAnalytics({ ...defaultOptions, app_name: null });
        expect(instance.app_name).toBeUndefined();
    });

    it("requires base_url", () => {
        const instance = new PvAnalytics({ ...defaultOptions, base_url: null });
        expect(instance.base_url).toBeUndefined();
    });

    it("is disabled when is_enabled is false", () => {
        const instance = new PvAnalytics({ ...defaultOptions, is_enabled: false });
        expect(instance._is_enabled).toBe(false);
    });
});

describe("init()", () => {
    it("starts a new session when none exists", async () => {
        mock.onPost("https://example.com/session-start").reply(200, {
            status: true,
            data: { session_token: mockSessionToken }
        });

        const instance = new PvAnalytics(defaultOptions);
        await instance.init();

        expect(instance._is_initialized).toBe(true);
        expect(cookie.get("_analytics_sid")).toBe(mockSessionToken);
    });

    it("reuses a valid existing session token", async () => {
        cookie.set("_analytics_sid", mockSessionToken);

        const instance = new PvAnalytics(defaultOptions);
        await instance.init();

        expect(mock.history.post.length).toBe(0); // no HTTP call
        expect(instance._is_initialized).toBe(true);
    });

    it("ends session and retries if existing token has wrong app_token", async () => {
        const wrongToken = btoa("wrong-token.1234567890.abc123");
        cookie.set("_analytics_sid", wrongToken);

        mock.onPost("https://example.com/session-start").reply(200, {
            status: true,
            data: { session_token: mockSessionToken }
        });

        const instance = new PvAnalytics(defaultOptions);
        await instance.init();

        expect(instance._is_initialized).toBe(true);
        expect(cookie.get("_analytics_sid")).toBe(mockSessionToken);
    });

    it("does not initialize when disabled", async () => {
        const instance = new PvAnalytics({ ...defaultOptions, is_enabled: false });
        await instance.init();

        expect(instance._is_initialized).toBe(false);
        expect(mock.history.post.length).toBe(0);
    });

    it("retries on failure when retry_on_failure is true", async () => {
        vi.useFakeTimers();

        mock.onPost("https://example.com/session-start")
            .replyOnce(500)
            .onPost("https://example.com/session-start")
            .reply(200, { status: true, data: { session_token: mockSessionToken } });

        const instance = new PvAnalytics({
            ...defaultOptions,
            retry_on_failure: true,
            retry_delay: 250,
            retry_attempts: 1
        });

        const initPromise = instance.init();
        await vi.runAllTimersAsync();
        await initPromise;

        expect(instance._is_initialized).toBe(true);

        vi.useRealTimers();
    });
});

describe("event()", () => {
    it("sends an event when initialized", async () => {
        cookie.set("_analytics_sid", mockSessionToken);
        mock.onPost("https://example.com/event").reply(200);

        const instance = new PvAnalytics(defaultOptions);
        await instance.init();
        instance.event("test_event", { user_id: 1 });

        expect(mock.history.post.length).toBe(1);
        expect(JSON.parse(mock.history.post[0].data).event_name).toBe("test_event");
    });

    it("queues events before init and flushes them after", async () => {
        mock.onPost("https://example.com/session-start").reply(200, {
            status: true,
            data: { session_token: mockSessionToken }
        });
        mock.onPost("https://example.com/event").reply(200);

        const instance = new PvAnalytics(defaultOptions);

        instance.event("queued_event"); // called before init
        await instance.init();

        const eventCalls = mock.history.post.filter(r =>
            r.url === "https://example.com/event"
        );
        expect(eventCalls.length).toBe(1);
        expect(JSON.parse(eventCalls[0].data).event_name).toBe("queued_event");
    });

    it("rejects empty event_name", async () => {
        cookie.set("_analytics_sid", mockSessionToken);

        const instance = new PvAnalytics(defaultOptions);
        await instance.init();
        instance.event("  ");

        expect(mock.history.post.length).toBe(0);
    });
});

describe("getSessionToken()", () => {
    it("reads from cookie", () => {
        cookie.set("_analytics_sid", mockSessionToken);
        const instance = new PvAnalytics(defaultOptions);
        expect(instance.getSessionToken()).toBe(mockSessionToken);
    });

    it("falls back to sessionStorage", () => {
        sessionStorage.setItem("_analytics_sid", mockSessionToken);
        const instance = new PvAnalytics(defaultOptions);
        expect(instance.getSessionToken()).toBe(mockSessionToken);
    });
});

describe("restartSession()", () => {
    it("clears the session and reinitializes", async () => {
        cookie.set("_analytics_sid", mockSessionToken);

        mock.onPost("https://example.com/session-start").reply(200, {
            status: true,
            data: { session_token: mockSessionToken }
        });

        const instance = new PvAnalytics(defaultOptions);
        await instance.init();
        await instance.restartSession();

        expect(mock.history.post.length).toBe(1);
        expect(instance._is_initialized).toBe(true);
    });
});