import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsTracker } from "../components/analytics-tracker";

describe("AnalyticsTracker", () => {
	const mockSendAnalytics = vi.fn();
	let loadTime: number;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
		loadTime = Date.now();
		mockSendAnalytics.mockClear();

		(window as unknown as Record<string, unknown>).__analyticsState = {
			getPageLoadTime: () => loadTime,
			getCurrentPathname: () => "/test-page",
			sendAnalytics: mockSendAnalytics,
		};
	});

	afterEach(() => {
		cleanup();
		vi.useRealTimers();
		delete (window as unknown as Record<string, unknown>).__analyticsState;
	});

	it("renders nothing", () => {
		const { container } = render(<AnalyticsTracker />);
		expect(container.innerHTML).toBe("");
	});

	it("sends analytics on visibilitychange to hidden", () => {
		render(<AnalyticsTracker />);
		vi.advanceTimersByTime(3000);

		Object.defineProperty(document, "visibilityState", {
			value: "hidden",
			configurable: true,
		});
		document.dispatchEvent(new Event("visibilitychange"));

		expect(mockSendAnalytics).toHaveBeenCalledWith("/test-page", 3000);
	});

	it("does not send analytics on visibilitychange to visible", () => {
		render(<AnalyticsTracker />);
		vi.advanceTimersByTime(1000);

		Object.defineProperty(document, "visibilityState", {
			value: "visible",
			configurable: true,
		});
		document.dispatchEvent(new Event("visibilitychange"));

		expect(mockSendAnalytics).not.toHaveBeenCalled();
	});

	it("sends analytics on beforeunload", () => {
		render(<AnalyticsTracker />);
		vi.advanceTimersByTime(2000);

		window.dispatchEvent(new Event("beforeunload"));

		expect(mockSendAnalytics).toHaveBeenCalledWith("/test-page", 2000);
	});

	it("removes event listeners on unmount", () => {
		const removeSpy = vi.spyOn(document, "removeEventListener");
		const removeWindowSpy = vi.spyOn(window, "removeEventListener");

		const { unmount } = render(<AnalyticsTracker />);
		unmount();

		expect(removeSpy).toHaveBeenCalledWith(
			"visibilitychange",
			expect.any(Function),
		);
		expect(removeWindowSpy).toHaveBeenCalledWith(
			"beforeunload",
			expect.any(Function),
		);

		removeSpy.mockRestore();
		removeWindowSpy.mockRestore();
	});

	it("does not send when __analyticsState is missing", () => {
		delete (window as unknown as Record<string, unknown>).__analyticsState;
		render(<AnalyticsTracker />);
		vi.advanceTimersByTime(1000);

		Object.defineProperty(document, "visibilityState", {
			value: "hidden",
			configurable: true,
		});
		document.dispatchEvent(new Event("visibilitychange"));
		window.dispatchEvent(new Event("beforeunload"));

		expect(mockSendAnalytics).not.toHaveBeenCalled();
	});

	it("does not send when duration is 0 on visibilitychange", () => {
		render(<AnalyticsTracker />);
		// No time advancement — duration is 0

		Object.defineProperty(document, "visibilityState", {
			value: "hidden",
			configurable: true,
		});
		document.dispatchEvent(new Event("visibilitychange"));

		expect(mockSendAnalytics).not.toHaveBeenCalled();
	});

	it("does not send when duration is 0 on beforeunload", () => {
		render(<AnalyticsTracker />);
		// No time advancement — duration is 0

		window.dispatchEvent(new Event("beforeunload"));

		expect(mockSendAnalytics).not.toHaveBeenCalled();
	});
});
