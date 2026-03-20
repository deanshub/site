let pageLoadTime = Date.now();
let currentPathname = window.location.pathname;

function sendAnalytics(pathname: string, duration: number) {
	const payload = JSON.stringify({
		pathname,
		duration,
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

export function onRouterTransitionStart(url: string) {
	const duration = Date.now() - pageLoadTime;
	if (duration > 0) {
		sendAnalytics(currentPathname, duration);
	}

	// Reset for the new page
	const parsed = new URL(url, window.location.origin);
	currentPathname = parsed.pathname;
	pageLoadTime = Date.now();
}

// Expose for the analytics tracker component
(window as unknown as Record<string, unknown>).__analyticsState = {
	getPageLoadTime: () => pageLoadTime,
	getCurrentPathname: () => currentPathname,
	sendAnalytics,
};
