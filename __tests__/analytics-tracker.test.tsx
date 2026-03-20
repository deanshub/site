import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsTracker } from "../components/analytics-tracker";

describe("AnalyticsTracker", () => {
	const mockFlush = vi.fn();

	beforeEach(() => {
		mockFlush.mockClear();
		(window as unknown as Record<string, unknown>).__perf = {
			flushPageMetrics: mockFlush,
		};
	});

	afterEach(() => {
		cleanup();
		delete (window as unknown as Record<string, unknown>).__perf;
	});

	it("renders nothing", () => {
		const { container } = render(<AnalyticsTracker />);
		expect(container.innerHTML).toBe("");
	});

	it("calls flushPageMetrics on visibilitychange to hidden", () => {
		render(<AnalyticsTracker />);

		Object.defineProperty(document, "visibilityState", {
			value: "hidden",
			configurable: true,
		});
		document.dispatchEvent(new Event("visibilitychange"));

		expect(mockFlush).toHaveBeenCalledOnce();
	});

	it("does not flush on visibilitychange to visible", () => {
		render(<AnalyticsTracker />);

		Object.defineProperty(document, "visibilityState", {
			value: "visible",
			configurable: true,
		});
		document.dispatchEvent(new Event("visibilitychange"));

		expect(mockFlush).not.toHaveBeenCalled();
	});

	it("calls flushPageMetrics on beforeunload", () => {
		render(<AnalyticsTracker />);
		window.dispatchEvent(new Event("beforeunload"));
		expect(mockFlush).toHaveBeenCalledOnce();
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

	it("does not throw when __perf is missing", () => {
		delete (window as unknown as Record<string, unknown>).__perf;
		render(<AnalyticsTracker />);

		Object.defineProperty(document, "visibilityState", {
			value: "hidden",
			configurable: true,
		});
		document.dispatchEvent(new Event("visibilitychange"));
		window.dispatchEvent(new Event("beforeunload"));

		expect(mockFlush).not.toHaveBeenCalled();
	});
});
