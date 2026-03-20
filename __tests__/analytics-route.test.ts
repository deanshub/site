import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.fn();
const mockFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
	prisma: {
		pageView: {
			create: (...args: unknown[]) => mockCreate(...args),
			findMany: (...args: unknown[]) => mockFindMany(...args),
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

	it("creates a page view with valid payload", async () => {
		mockCreate.mockResolvedValue({ id: "1" });

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
		expect(mockCreate).toHaveBeenCalledWith({
			data: {
				pathname: "/about",
				duration: 5000,
				timestamp: new Date("2026-01-01T00:00:00.000Z"),
			},
		});
	});

	it("rounds duration to nearest integer", async () => {
		mockCreate.mockResolvedValue({ id: "1" });

		const req = new Request("http://localhost/api/analytics", {
			method: "POST",
			body: JSON.stringify({
				pathname: "/",
				duration: 1234.56,
				timestamp: "2026-01-01T00:00:00.000Z",
			}),
		});

		await POST(req);
		expect(mockCreate).toHaveBeenCalledWith(
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
		const data = await res.json();
		expect(data.error).toBe("Invalid payload");
	});

	it("returns 400 for non-number duration", async () => {
		const req = new Request("http://localhost/api/analytics", {
			method: "POST",
			body: JSON.stringify({ pathname: "/", duration: "not a number" }),
		});

		const res = await POST(req);
		expect(res.status).toBe(400);
	});

	it("returns 500 when prisma throws", async () => {
		mockCreate.mockRejectedValue(new Error("DB error"));

		const req = new Request("http://localhost/api/analytics", {
			method: "POST",
			body: JSON.stringify({
				pathname: "/",
				duration: 1000,
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
		mockFindMany.mockResolvedValue(mockViews);

		const req = new Request("http://localhost/api/analytics");
		const res = await GET(req);
		const data = await res.json();

		expect(res.status).toBe(200);
		expect(data).toEqual(mockViews);
		expect(mockFindMany).toHaveBeenCalledWith({
			where: { timestamp: { gte: expect.any(Date) } },
			orderBy: { timestamp: "desc" },
		});

		const call = mockFindMany.mock.calls[0][0];
		const since = call.where.timestamp.gte as Date;
		const expectedSince = new Date("2026-03-13T12:00:00.000Z");
		expect(since.toISOString()).toBe(expectedSince.toISOString());
	});

	it("respects custom days param", async () => {
		mockFindMany.mockResolvedValue([]);

		const req = new Request("http://localhost/api/analytics?days=30");
		await GET(req);

		const call = mockFindMany.mock.calls[0][0];
		const since = call.where.timestamp.gte as Date;
		const expectedSince = new Date("2026-02-18T12:00:00.000Z");
		expect(since.toISOString()).toBe(expectedSince.toISOString());
	});

	it("returns 500 when prisma throws", async () => {
		mockFindMany.mockRejectedValue(new Error("DB error"));

		const req = new Request("http://localhost/api/analytics");
		const res = await GET(req);
		expect(res.status).toBe(500);
		const data = await res.json();
		expect(data.error).toBe("Failed to fetch analytics");
	});
});
