import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockAddPerfMetric = vi.fn();
const mockAddPageView = vi.fn();
const mockGetPerfMetrics = vi.fn();
const mockGetPageViews = vi.fn();

vi.mock("@/lib/github-data", () => ({
	addPerfMetric: (...args: unknown[]) => mockAddPerfMetric(...args),
	addPageView: (...args: unknown[]) => mockAddPageView(...args),
	getPerfMetrics: (...args: unknown[]) => mockGetPerfMetrics(...args),
	getPageViews: (...args: unknown[]) => mockGetPageViews(...args),
}));

describe("POST /api/analytics", () => {
	let POST: (req: Request) => Promise<Response>;

	beforeEach(async () => {
		vi.clearAllMocks();
		const mod = await import("../app/api/analytics/route");
		POST = mod.POST;
	});

	it("creates a PerfMetric with valid name/value payload", async () => {
		mockAddPerfMetric.mockResolvedValue(undefined);

		const req = new Request("http://localhost/api/analytics", {
			method: "POST",
			body: JSON.stringify({
				pathname: "/about",
				name: "LCP",
				value: 250.5,
				timestamp: "2026-01-01T00:00:00.000Z",
			}),
			headers: { "Content-Type": "application/json" },
		});

		const res = await POST(req);
		const data = await res.json();

		expect(res.status).toBe(200);
		expect(data).toEqual({ ok: true });
		expect(mockAddPerfMetric).toHaveBeenCalledWith({
			pathname: "/about",
			name: "LCP",
			value: 250.5,
			timestamp: "2026-01-01T00:00:00.000Z",
		});
	});

	it("creates a PerfMetric for page-duration", async () => {
		mockAddPerfMetric.mockResolvedValue(undefined);

		const req = new Request("http://localhost/api/analytics", {
			method: "POST",
			body: JSON.stringify({
				pathname: "/",
				name: "page-duration",
				value: 5000,
				timestamp: "2026-01-01T00:00:00.000Z",
			}),
		});

		const res = await POST(req);
		expect(res.status).toBe(200);
		expect(mockAddPerfMetric).toHaveBeenCalled();
	});

	it("rejects unknown metric names", async () => {
		const req = new Request("http://localhost/api/analytics", {
			method: "POST",
			body: JSON.stringify({
				pathname: "/",
				name: "unknown-metric",
				value: 100,
				timestamp: "2026-01-01T00:00:00.000Z",
			}),
		});

		const res = await POST(req);
		expect(res.status).toBe(400);
		expect(mockAddPerfMetric).not.toHaveBeenCalled();
	});

	it("rejects name payload with non-number value", async () => {
		const req = new Request("http://localhost/api/analytics", {
			method: "POST",
			body: JSON.stringify({
				pathname: "/",
				name: "LCP",
				value: "not-a-number",
			}),
		});

		const res = await POST(req);
		expect(res.status).toBe(400);
	});

	it("creates a legacy PageView with duration payload (backward compat)", async () => {
		mockAddPageView.mockResolvedValue(undefined);

		const req = new Request("http://localhost/api/analytics", {
			method: "POST",
			body: JSON.stringify({
				pathname: "/about",
				duration: 5000,
				timestamp: "2026-01-01T00:00:00.000Z",
			}),
			headers: { "Content-Type": "application/json" },
		});

		const res = await POST(req);
		const data = await res.json();

		expect(res.status).toBe(200);
		expect(data).toEqual({ ok: true });
		expect(mockAddPageView).toHaveBeenCalledWith({
			pathname: "/about",
			duration: 5000,
			timestamp: "2026-01-01T00:00:00.000Z",
		});
	});

	it("rounds duration for legacy PageView", async () => {
		mockAddPageView.mockResolvedValue(undefined);

		const req = new Request("http://localhost/api/analytics", {
			method: "POST",
			body: JSON.stringify({
				pathname: "/",
				duration: 1234.56,
				timestamp: "2026-01-01T00:00:00.000Z",
			}),
		});

		await POST(req);
		expect(mockAddPageView).toHaveBeenCalledWith(
			expect.objectContaining({ duration: 1235 }),
		);
	});

	it("returns 400 for missing pathname", async () => {
		const req = new Request("http://localhost/api/analytics", {
			method: "POST",
			body: JSON.stringify({ duration: 1000 }),
		});

		const res = await POST(req);
		expect(res.status).toBe(400);
	});

	it("returns 400 for non-number duration in legacy format", async () => {
		const req = new Request("http://localhost/api/analytics", {
			method: "POST",
			body: JSON.stringify({ pathname: "/", duration: "not a number" }),
		});

		const res = await POST(req);
		expect(res.status).toBe(400);
	});

	it("returns 500 when data layer throws", async () => {
		mockAddPerfMetric.mockRejectedValue(new Error("GitHub API error"));

		const req = new Request("http://localhost/api/analytics", {
			method: "POST",
			body: JSON.stringify({
				pathname: "/",
				name: "LCP",
				value: 100,
				timestamp: "2026-01-01T00:00:00.000Z",
			}),
		});

		const res = await POST(req);
		expect(res.status).toBe(500);
		const data = await res.json();
		expect(data.error).toBe("Failed to record analytics");
	});

	it("returns 500 when request.json() throws", async () => {
		const req = new Request("http://localhost/api/analytics", {
			method: "POST",
			body: "not json",
		});

		const res = await POST(req);
		expect(res.status).toBe(500);
	});
});

describe("GET /api/analytics", () => {
	let GET: (req: Request) => Promise<Response>;

	beforeEach(async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-03-20T12:00:00.000Z"));
		vi.clearAllMocks();
		const mod = await import("../app/api/analytics/route");
		GET = mod.GET;
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns page views for default 7 days", async () => {
		const mockViews = [{ id: "1", pathname: "/", duration: 3000 }];
		mockGetPageViews.mockResolvedValue(mockViews);

		const req = new Request("http://localhost/api/analytics");
		const res = await GET(req);
		const data = await res.json();

		expect(res.status).toBe(200);
		expect(data).toEqual(mockViews);
		expect(mockGetPageViews).toHaveBeenCalledWith(expect.any(Date));

		const since = mockGetPageViews.mock.calls[0][0] as Date;
		const expectedSince = new Date("2026-03-13T12:00:00.000Z");
		expect(since.toISOString()).toBe(expectedSince.toISOString());
	});

	it("returns PerfMetric entries when model=metrics", async () => {
		const mockMetrics = [{ id: "1", pathname: "/", name: "LCP", value: 250 }];
		mockGetPerfMetrics.mockResolvedValue(mockMetrics);

		const req = new Request("http://localhost/api/analytics?model=metrics");
		const res = await GET(req);
		const data = await res.json();

		expect(res.status).toBe(200);
		expect(data).toEqual(mockMetrics);
		expect(mockGetPerfMetrics).toHaveBeenCalledWith(expect.any(Date));
	});

	it("respects custom days param", async () => {
		mockGetPageViews.mockResolvedValue([]);

		const req = new Request("http://localhost/api/analytics?days=30");
		await GET(req);

		const since = mockGetPageViews.mock.calls[0][0] as Date;
		const expectedSince = new Date("2026-02-18T12:00:00.000Z");
		expect(since.toISOString()).toBe(expectedSince.toISOString());
	});

	it("returns 500 when data layer throws", async () => {
		mockGetPageViews.mockRejectedValue(new Error("Read error"));

		const req = new Request("http://localhost/api/analytics");
		const res = await GET(req);
		expect(res.status).toBe(500);
		const data = await res.json();
		expect(data.error).toBe("Failed to fetch analytics");
	});
});
