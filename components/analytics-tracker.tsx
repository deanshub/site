"use client";

import { useEffect } from "react";

interface PerfState {
	flushPageMetrics: () => void;
}

function getPerf(): PerfState | null {
	return (
		((window as unknown as Record<string, unknown>)
			.__perf as PerfState | null) ?? null
	);
}

export function AnalyticsTracker() {
	useEffect(() => {
		function handleVisibilityChange() {
			if (document.visibilityState === "hidden") {
				getPerf()?.flushPageMetrics();
			}
		}

		function handleBeforeUnload() {
			getPerf()?.flushPageMetrics();
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
