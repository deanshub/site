const ALLOWED_METRICS = [
	"page-duration",
	"LCP",
	"FCP",
	"CLS",
	"INP",
	"TTFB",
] as const;

type MetricName = (typeof ALLOWED_METRICS)[number];

let currentPathname = window.location.pathname;
let clsValue = 0;
let inpValue = 0;

function sendMetric(pathname: string, name: MetricName, value: number) {
	const payload = JSON.stringify({
		pathname,
		name,
		value,
		timestamp: new Date().toISOString(),
	});

	if (navigator.sendBeacon) {
		navigator.sendBeacon("/api/analytics", payload);
	} else {
		fetch("/api/analytics", {
			method: "POST",
			body: payload,
			keepalive: true,
			headers: { "Content-Type": "application/json" },
		});
	}
}

function measurePageDuration() {
	try {
		performance.mark("page-end");
		const measures = performance.measure(
			"page-duration",
			"page-start",
			"page-end",
		);
		const duration = measures.duration;
		if (duration > 0) {
			sendMetric(currentPathname, "page-duration", duration);
		}
	} catch {
		// marks may not exist yet
	}
}

function resetMarks() {
	performance.clearMarks("page-start");
	performance.clearMarks("page-end");
	performance.clearMeasures("page-duration");
	performance.mark("page-start");
}

function flushPageMetrics() {
	measurePageDuration();
	if (clsValue > 0) {
		sendMetric(currentPathname, "CLS", clsValue);
	}
	if (inpValue > 0) {
		sendMetric(currentPathname, "INP", inpValue);
	}
}

// Initial page-start mark
performance.mark("page-start");

// TTFB from navigation timing
try {
	const nav = performance.getEntriesByType("navigation")[0] as
		| PerformanceNavigationTiming
		| undefined;
	if (nav && nav.responseStart > 0) {
		sendMetric(currentPathname, "TTFB", nav.responseStart - nav.requestStart);
	}
} catch {
	// navigation timing not available
}

// Web Vitals observers
try {
	// LCP
	new PerformanceObserver((list) => {
		const entries = list.getEntries();
		const last = entries[entries.length - 1];
		if (last) {
			sendMetric(currentPathname, "LCP", last.startTime);
		}
	}).observe({ type: "largest-contentful-paint", buffered: true });
} catch {
	// LCP observer not supported
}

try {
	// FCP
	new PerformanceObserver((list) => {
		for (const entry of list.getEntries()) {
			if (entry.name === "first-contentful-paint") {
				sendMetric(currentPathname, "FCP", entry.startTime);
			}
		}
	}).observe({ type: "paint", buffered: true });
} catch {
	// paint observer not supported
}

try {
	// CLS
	new PerformanceObserver((list) => {
		for (const entry of list.getEntries()) {
			if (
				!(entry as PerformanceEntry & { hadRecentInput?: boolean })
					.hadRecentInput
			) {
				clsValue += (entry as PerformanceEntry & { value?: number }).value ?? 0;
			}
		}
	}).observe({ type: "layout-shift", buffered: true });
} catch {
	// layout-shift observer not supported
}

try {
	// INP
	new PerformanceObserver((list) => {
		for (const entry of list.getEntries()) {
			if (entry.duration > inpValue) {
				inpValue = entry.duration;
			}
		}
	}).observe({
		type: "event",
		buffered: true,
		durationThreshold: 40,
	} as PerformanceObserverInit);
} catch {
	// event observer not supported
}

// Next.js instrumentation hook
export function onRouterTransitionStart(url: string) {
	flushPageMetrics();

	// Reset for the new page
	const parsed = new URL(url, window.location.origin);
	currentPathname = parsed.pathname;
	clsValue = 0;
	inpValue = 0;
	resetMarks();
}

// Expose for the analytics tracker component
(window as unknown as Record<string, unknown>).__perf = {
	flushPageMetrics,
};
