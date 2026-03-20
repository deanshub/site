import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockPageViewCreate = vi.fn();
const mockPageViewFindMany = vi.fn();
const mockPerfMetricCreate = vi.fn();
const mockPerfMetricFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
	prisma: {
		pageView: {
			create: (...args: unknown[]) => mockPageViewCreate(...args),
			findMany: (...args: unknown[]) => mockPageViewFindMany(...args),
		},
		perfMetric: {
			create: (...args: unknown[]) => mockPerfMetricCreate(...args),
			findMany: (...args: unknown[]) => mockPerfMetricFindMany(...args),
		},
	},
}));

describe("POST /api/analytics", () => {
	let POST: (req: Request) => Promise<Response>;

	beforeEach(async () => {
		vi.clearAllMocks();
		const mod = await import("../app/api/analytics/route");
		POST = mod.POST;
	});

	it("creates a PerfMetric with valid name/value payload", async () => {
		mockPerfMetricCreate.mockResolvedValue({ id: "1" });

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
		expect(mockPerfMetricCreate).toHaveBeenCalledWith({
			data: {
				pathname: "/about",
				name: "LCP",
				value: 250.5,
				timestamp: new Date("2026-01-01T00:00:00.000Z"),
			},
		});
	});

	it("creates a PerfMetric for page-duration", async () => {
		mockPerfMetricCreate.mockResolvedValue({ id: "1" });

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
		expect(mockPerfMetricCreate).toHaveBeenCalled();
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
		expect(mockPerfMetricCreate).not.toHaveBeenCalled();
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
		mockPageViewCreate.mockResolvedValue({ id: "1" });

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
		expect(mockPageViewCreate).toHaveBeenCalledWith({
			data: {
				pathname: "/about",
				duration: 5000,
				timestamp: new Date("2026-01-01T00:00:00.000Z"),
			},
		});
	});

	it("rounds duration for legacy PageView", async () => {
		mockPageViewCreate.mockResolvedValue({ id: "1" });

		const req = new Request("http://localhost/api/analytics", {
			method: "POST",
			body: JSON.stringify({
				pathname: "/",
				duration: 1234.56,
				timestamp: "2026-01-01T00:00:00.000Z",
			}),
		});

		await POST(req);
		expect(mockPageViewCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ duration: 1235 }),
			}),
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

	it("returns 500 when prisma throws", async () => {
		mockPerfMetricCreate.mockRejectedValue(new Error("DB error"));

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
		mockPageViewFindMany.mockResolvedValue(mockViews);

		const req = new Request("http://localhost/api/analytics");
		const res = await GET(req);
		const data = await res.json();

		expect(res.status).toBe(200);
		expect(data).toEqual(mockViews);
		expect(mockPageViewFindMany).toHaveBeenCalledWith({
			where: { timestamp: { gte: expect.any(Date) } },
			orderBy: { timestamp: "desc" },
		});

		const call = mockPageViewFindMany.mock.calls[0][0];
		const since = call.where.timestamp.gte as Date;
		const expectedSince = new Date("2026-03-13T12:00:00.000Z");
		expect(since.toISOString()).toBe(expectedSince.toISOString());
	});

	it("returns PerfMetric entries when model=metrics", async () => {
		const mockMetrics = [{ id: "1", pathname: "/", name: "LCP", value: 250 }];
		mockPerfMetricFindMany.mockResolvedValue(mockMetrics);

		const req = new Request("http://localhost/api/analytics?model=metrics");
		const res = await GET(req);
		const data = await res.json();

		expect(res.status).toBe(200);
		expect(data).toEqual(mockMetrics);
		expect(mockPerfMetricFindMany).toHaveBeenCalledWith({
			where: { timestamp: { gte: expect.any(Date) } },
			orderBy: { timestamp: "desc" },
		});
	});

	it("respects custom days param", async () => {
		mockPageViewFindMany.mockResolvedValue([]);

		const req = new Request("http://localhost/api/analytics?days=30");
		await GET(req);

		const call = mockPageViewFindMany.mock.calls[0][0];
		const since = call.where.timestamp.gte as Date;
		const expectedSince = new Date("2026-02-18T12:00:00.000Z");
		expect(since.toISOString()).toBe(expectedSince.toISOString());
	});

	it("returns 500 when prisma throws", async () => {
		mockPageViewFindMany.mockRejectedValue(new Error("DB error"));

		const req = new Request("http://localhost/api/analytics");
		const res = await GET(req);
		expect(res.status).toBe(500);
		const data = await res.json();
		expect(data.error).toBe("Failed to fetch analytics");
	});
});
