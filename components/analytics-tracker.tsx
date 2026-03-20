"use client";

import { useEffect } from "react";

interface AnalyticsState {
	getPageLoadTime: () => number;
	getCurrentPathname: () => string;
	sendAnalytics: (pathname: string, duration: number) => void;
}

function getState(): AnalyticsState | null {
	return (
		((window as unknown as Record<string, unknown>)
			.__analyticsState as AnalyticsState | null) ?? null
	);
}

export function AnalyticsTracker() {
	useEffect(() => {
		function handleVisibilityChange() {
			if (document.visibilityState === "hidden") {
				const state = getState();
				if (!state) return;
				const duration = Date.now() - state.getPageLoadTime();
				if (duration > 0) {
					state.sendAnalytics(state.getCurrentPathname(), duration);
				}
			}
		}

		function handleBeforeUnload() {
			const state = getState();
			if (!state) return;
			const duration = Date.now() - state.getPageLoadTime();
			if (duration > 0) {
				state.sendAnalytics(state.getCurrentPathname(), duration);
			}
		}

		document.addEventListener("visibilitychange", handleVisibilityChange);
		window.addEventListener("beforeunload", handleBeforeUnload);

		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			window.removeEventListener("beforeunload", handleBeforeUnload);
		};
	}, []);

	return null;
}
