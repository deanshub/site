import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("instrumentation-client", () => {
	const mockSendBeacon = vi.fn();
	const mockFetch = vi.fn();
	let originalSendBeacon: typeof navigator.sendBeacon;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
		mockSendBeacon.mockClear();
		mockFetch.mockClear();

		originalSendBeacon = navigator.sendBeacon;
		Object.defineProperty(navigator, "sendBeacon", {
			value: mockSendBeacon,
			writable: true,
			configurable: true,
		});
		globalThis.fetch = mockFetch as unknown as typeof fetch;

		Object.defineProperty(window, "location", {
			value: { pathname: "/home", origin: "http://localhost" },
			writable: true,
			configurable: true,
		});

		// Clear any previously loaded module
		vi.resetModules();
	});

	afterEach(() => {
		Object.defineProperty(navigator, "sendBeacon", {
			value: originalSendBeacon,
			writable: true,
			configurable: true,
		});
		vi.useRealTimers();
	});

	async function loadModule() {
		return await import("../instrumentation-client");
	}

	it("sets __analyticsState on window at load", async () => {
		await loadModule();
		const state = (window as unknown as Record<string, unknown>)
			.__analyticsState as Record<string, unknown>;
		expect(state).toBeDefined();
		expect(typeof state.getPageLoadTime).toBe("function");
		expect(typeof state.getCurrentPathname).toBe("function");
		expect(typeof state.sendAnalytics).toBe("function");
	});

	it("tracks initial pathname and load time", async () => {
		await loadModule();
		const state = (window as unknown as Record<string, unknown>)
			.__analyticsState as {
			getPageLoadTime: () => number;
			getCurrentPathname: () => string;
		};
		expect(state.getCurrentPathname()).toBe("/home");
		expect(state.getPageLoadTime()).toBe(Date.now());
	});

	it("onRouterTransitionStart sends analytics via sendBeacon and resets state", async () => {
		const mod = await loadModule();

		vi.advanceTimersByTime(5000);

		mod.onRouterTransitionStart("http://localhost/about");

		expect(mockSendBeacon).toHaveBeenCalledOnce();
		const [url, body] = mockSendBeacon.mock.calls[0];
		expect(url).toBe("/api/analytics");
		const parsed = JSON.parse(body);
		expect(parsed.pathname).toBe("/home");
		expect(parsed.duration).toBe(5000);
		expect(parsed.timestamp).toBeDefined();

		// State should be reset
		const state = (window as unknown as Record<string, unknown>)
			.__analyticsState as {
			getPageLoadTime: () => number;
			getCurrentPathname: () => string;
		};
		expect(state.getCurrentPathname()).toBe("/about");
	});

	it("onRouterTransitionStart parses relative URLs", async () => {
		const mod = await loadModule();
		vi.advanceTimersByTime(100);
		mod.onRouterTransitionStart("/contact?foo=bar");

		const state = (window as unknown as Record<string, unknown>)
			.__analyticsState as { getCurrentPathname: () => string };
		expect(state.getCurrentPathname()).toBe("/contact");
	});

	it("does not send analytics when duration is 0", async () => {
		const mod = await loadModule();
		// No time has passed
		mod.onRouterTransitionStart("/about");
		expect(mockSendBeacon).not.toHaveBeenCalled();
	});

	it("falls back to fetch when sendBeacon is unavailable", async () => {
		Object.defineProperty(navigator, "sendBeacon", {
			value: undefined,
			writable: true,
			configurable: true,
		});

		const mod = await loadModule();
		vi.advanceTimersByTime(1000);
		mod.onRouterTransitionStart("/about");

		expect(mockFetch).toHaveBeenCalledOnce();
		const [url, options] = mockFetch.mock.calls[0];
		expect(url).toBe("/api/analytics");
		expect(options.method).toBe("POST");
		expect(options.keepalive).toBe(true);
		expect(options.headers["Content-Type"]).toBe("application/json");
		const parsed = JSON.parse(options.body);
		expect(parsed.pathname).toBe("/home");
		expect(parsed.duration).toBe(1000);
	});

	it("sendAnalytics exposed on __analyticsState works via sendBeacon", async () => {
		await loadModule();
		const state = (window as unknown as Record<string, unknown>)
			.__analyticsState as {
			sendAnalytics: (p: string, d: number) => void;
		};
		state.sendAnalytics("/test", 2000);
		expect(mockSendBeacon).toHaveBeenCalledOnce();
		const parsed = JSON.parse(mockSendBeacon.mock.calls[0][1]);
		expect(parsed.pathname).toBe("/test");
		expect(parsed.duration).toBe(2000);
	});
});
