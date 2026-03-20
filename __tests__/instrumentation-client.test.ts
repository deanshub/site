import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("instrumentation-client", () => {
	const mockSendBeacon = vi.fn();
	const mockFetch = vi.fn();
	let originalSendBeacon: typeof navigator.sendBeacon;
	let mockPerformanceMark: ReturnType<typeof vi.fn>;
	let mockPerformanceMeasure: ReturnType<typeof vi.fn>;
	let mockPerformanceClearMarks: ReturnType<typeof vi.fn>;
	let mockPerformanceClearMeasures: ReturnType<typeof vi.fn>;
	let mockPerformanceGetEntries: ReturnType<typeof vi.fn>;
	const observerCallbacks: Array<
		(list: { getEntries: () => PerformanceEntry[] }) => void
	> = [];
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
		mockSendBeacon.mockClear();
		mockFetch.mockClear();
		observerCallbacks.length = 0;

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

		mockPerformanceMark = vi.fn();
		mockPerformanceMeasure = vi.fn().mockReturnValue({ duration: 0 });
		mockPerformanceClearMarks = vi.fn();
		mockPerformanceClearMeasures = vi.fn();
		mockPerformanceGetEntries = vi.fn().mockReturnValue([]);

		vi.stubGlobal("performance", {
			mark: mockPerformanceMark,
			measure: mockPerformanceMeasure,
			clearMarks: mockPerformanceClearMarks,
			clearMeasures: mockPerformanceClearMeasures,
			getEntriesByType: mockPerformanceGetEntries,
		});

		class MockPerformanceObserver {
			constructor(
				callback: (list: { getEntries: () => PerformanceEntry[] }) => void,
			) {
				observerCallbacks.push(callback);
			}
			observe = vi.fn();
		}
		vi.stubGlobal("PerformanceObserver", MockPerformanceObserver);

		vi.resetModules();
	});

	afterEach(() => {
		Object.defineProperty(navigator, "sendBeacon", {
			value: originalSendBeacon,
			writable: true,
			configurable: true,
		});
		vi.unstubAllGlobals();
		vi.useRealTimers();
		delete (window as unknown as Record<string, unknown>).__perf;
	});

	async function loadModule() {
		return await import("../instrumentation-client");
	}

	it("places page-start mark on load", async () => {
		await loadModule();
		expect(mockPerformanceMark).toHaveBeenCalledWith("page-start");
	});

	it("exposes __perf.flushPageMetrics on window", async () => {
		await loadModule();
		const perf = (window as unknown as Record<string, unknown>).__perf as {
			flushPageMetrics: () => void;
		};
		expect(perf).toBeDefined();
		expect(typeof perf.flushPageMetrics).toBe("function");
	});

	it("sends TTFB from navigation timing", async () => {
		mockPerformanceGetEntries.mockReturnValue([
			{ requestStart: 10, responseStart: 60 },
		]);
		await loadModule();

		expect(mockSendBeacon).toHaveBeenCalled();
		const payload = JSON.parse(mockSendBeacon.mock.calls[0][1]);
		expect(payload.name).toBe("TTFB");
		expect(payload.value).toBe(50);
		expect(payload.pathname).toBe("/home");
	});

	it("sets up PerformanceObservers for web vitals", async () => {
		await loadModule();
		// LCP, FCP (paint), CLS (layout-shift), INP (event)
		expect(observerCallbacks).toHaveLength(4);
	});

	it("onRouterTransitionStart measures page duration and resets", async () => {
		mockPerformanceMeasure.mockReturnValue({ duration: 5000 });
		const mod = await loadModule();

		mod.onRouterTransitionStart("http://localhost/about");

		// Should measure page-duration
		expect(mockPerformanceMeasure).toHaveBeenCalledWith(
			"page-duration",
			"page-start",
			"page-end",
		);

		// Should send page-duration metric
		const calls = mockSendBeacon.mock.calls.map((c: [string, string]) =>
			JSON.parse(c[1]),
		);
		const pageDuration = calls.find(
			(c: { name: string }) => c.name === "page-duration",
		);
		expect(pageDuration).toBeDefined();
		expect(pageDuration.value).toBe(5000);
		expect(pageDuration.pathname).toBe("/home");

		// Should reset marks
		expect(mockPerformanceClearMarks).toHaveBeenCalledWith("page-start");
		expect(mockPerformanceClearMarks).toHaveBeenCalledWith("page-end");
		expect(mockPerformanceClearMeasures).toHaveBeenCalledWith("page-duration");
	});

	it("onRouterTransitionStart parses relative URLs", async () => {
		mockPerformanceMeasure.mockReturnValue({ duration: 100 });
		const mod = await loadModule();

		mod.onRouterTransitionStart("/contact?foo=bar");

		// Next transition should use /contact as pathname
		mockPerformanceMeasure.mockReturnValue({ duration: 200 });
		mod.onRouterTransitionStart("/next");

		const calls = mockSendBeacon.mock.calls.map((c: [string, string]) =>
			JSON.parse(c[1]),
		);
		const contactMetric = calls.find(
			(c: { name: string; pathname: string }) =>
				c.name === "page-duration" && c.pathname === "/contact",
		);
		expect(contactMetric).toBeDefined();
	});

	it("does not send page-duration when duration is 0", async () => {
		mockPerformanceMeasure.mockReturnValue({ duration: 0 });
		const mod = await loadModule();
		const beforeCount = mockSendBeacon.mock.calls.length;

		mod.onRouterTransitionStart("/about");

		const afterCalls = mockSendBeacon.mock.calls
			.slice(beforeCount)
			.map((c: [string, string]) => JSON.parse(c[1]));
		const pageDuration = afterCalls.find(
			(c: { name: string }) => c.name === "page-duration",
		);
		expect(pageDuration).toBeUndefined();
	});

	it("falls back to fetch when sendBeacon is unavailable", async () => {
		Object.defineProperty(navigator, "sendBeacon", {
			value: undefined,
			writable: true,
			configurable: true,
		});
		mockPerformanceGetEntries.mockReturnValue([]);
		mockPerformanceMeasure.mockReturnValue({ duration: 1000 });

		const mod = await loadModule();
		mod.onRouterTransitionStart("/about");

		expect(mockFetch).toHaveBeenCalled();
		const [url, options] = mockFetch.mock.calls[0];
		expect(url).toBe("/api/analytics");
		expect(options.method).toBe("POST");
		expect(options.keepalive).toBe(true);
		expect(options.headers["Content-Type"]).toBe("application/json");
		const parsed = JSON.parse(options.body);
		expect(parsed.name).toBe("page-duration");
		expect(parsed.value).toBe(1000);
	});

	it("LCP observer sends metric", async () => {
		await loadModule();

		// Find LCP observer callback (first observer registered)
		const lcpCallback = observerCallbacks[0];
		lcpCallback({
			getEntries: () => [{ startTime: 250 }] as PerformanceEntry[],
		});

		const calls = mockSendBeacon.mock.calls.map((c: [string, string]) =>
			JSON.parse(c[1]),
		);
		const lcp = calls.find((c: { name: string }) => c.name === "LCP");
		expect(lcp).toBeDefined();
		expect(lcp.value).toBe(250);
	});

	it("FCP observer sends metric for first-contentful-paint", async () => {
		await loadModule();

		// FCP is the second observer
		const fcpCallback = observerCallbacks[1];
		fcpCallback({
			getEntries: () =>
				[
					{ name: "first-contentful-paint", startTime: 180 },
				] as PerformanceEntry[],
		});

		const calls = mockSendBeacon.mock.calls.map((c: [string, string]) =>
			JSON.parse(c[1]),
		);
		const fcp = calls.find((c: { name: string }) => c.name === "FCP");
		expect(fcp).toBeDefined();
		expect(fcp.value).toBe(180);
	});

	it("CLS observer accumulates and flushes on transition", async () => {
		mockPerformanceMeasure.mockReturnValue({ duration: 100 });
		const mod = await loadModule();

		// CLS is the third observer
		const clsCallback = observerCallbacks[2];
		clsCallback({
			getEntries: () =>
				[
					{ hadRecentInput: false, value: 0.1 },
				] as unknown as PerformanceEntry[],
		});
		clsCallback({
			getEntries: () =>
				[
					{ hadRecentInput: false, value: 0.05 },
				] as unknown as PerformanceEntry[],
		});

		mod.onRouterTransitionStart("/next");

		const calls = mockSendBeacon.mock.calls.map((c: [string, string]) =>
			JSON.parse(c[1]),
		);
		const cls = calls.find((c: { name: string }) => c.name === "CLS");
		expect(cls).toBeDefined();
		expect(cls.value).toBeCloseTo(0.15);
	});

	it("INP observer tracks worst interaction and flushes on transition", async () => {
		mockPerformanceMeasure.mockReturnValue({ duration: 100 });
		const mod = await loadModule();

		// INP is the fourth observer
		const inpCallback = observerCallbacks[3];
		inpCallback({
			getEntries: () => [{ duration: 80 }] as PerformanceEntry[],
		});
		inpCallback({
			getEntries: () => [{ duration: 200 }] as PerformanceEntry[],
		});
		inpCallback({
			getEntries: () => [{ duration: 50 }] as PerformanceEntry[],
		});

		mod.onRouterTransitionStart("/next");

		const calls = mockSendBeacon.mock.calls.map((c: [string, string]) =>
			JSON.parse(c[1]),
		);
		const inp = calls.find((c: { name: string }) => c.name === "INP");
		expect(inp).toBeDefined();
		expect(inp.value).toBe(200);
	});
});
