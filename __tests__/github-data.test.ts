import { beforeEach, describe, expect, it, vi } from "vitest";

const mockReadFile = vi.fn();

vi.mock("node:fs/promises", () => ({
	default: { readFile: (...args: unknown[]) => mockReadFile(...args) },
	readFile: (...args: unknown[]) => mockReadFile(...args),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.stubEnv("GITHUB_TOKEN", "test-token");
vi.stubEnv("GITHUB_REPO", "owner/repo");

describe("github-data", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getPerfMetrics", () => {
		it("reads from local file and filters by date", async () => {
			const entries = [
				{
					id: "1",
					pathname: "/",
					name: "LCP",
					value: 200,
					timestamp: "2026-03-20T10:00:00.000Z",
				},
				{
					id: "2",
					pathname: "/",
					name: "FCP",
					value: 100,
					timestamp: "2025-01-01T00:00:00.000Z",
				},
			];
			mockReadFile.mockResolvedValue(JSON.stringify(entries));

			const { getPerfMetrics } = await import("../lib/github-data");
			const since = new Date("2026-03-01T00:00:00.000Z");
			const result = await getPerfMetrics(since);

			expect(result).toHaveLength(1);
			expect(result[0].id).toBe("1");
		});

		it("returns empty array when file does not exist", async () => {
			mockReadFile.mockRejectedValue(new Error("ENOENT"));

			const { getPerfMetrics } = await import("../lib/github-data");
			const result = await getPerfMetrics(new Date());

			expect(result).toEqual([]);
		});

		it("sorts results by timestamp descending", async () => {
			const entries = [
				{
					id: "1",
					pathname: "/",
					name: "LCP",
					value: 200,
					timestamp: "2026-03-18T10:00:00.000Z",
				},
				{
					id: "2",
					pathname: "/",
					name: "LCP",
					value: 300,
					timestamp: "2026-03-20T10:00:00.000Z",
				},
			];
			mockReadFile.mockResolvedValue(JSON.stringify(entries));

			const { getPerfMetrics } = await import("../lib/github-data");
			const result = await getPerfMetrics(new Date("2026-03-01T00:00:00.000Z"));

			expect(result[0].id).toBe("2");
			expect(result[1].id).toBe("1");
		});
	});

	describe("getPageViews", () => {
		it("reads from local file and filters by date", async () => {
			const entries = [
				{
					id: "1",
					pathname: "/",
					duration: 3000,
					timestamp: "2026-03-20T10:00:00.000Z",
				},
			];
			mockReadFile.mockResolvedValue(JSON.stringify(entries));

			const { getPageViews } = await import("../lib/github-data");
			const result = await getPageViews(new Date("2026-03-01T00:00:00.000Z"));

			expect(result).toHaveLength(1);
		});
	});

	describe("addPerfMetric", () => {
		it("fetches current file, appends entry, and PUTs back", async () => {
			const existing = [
				{
					id: "old",
					pathname: "/",
					name: "LCP",
					value: 100,
					timestamp: new Date().toISOString(),
				},
			];

			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: async () => ({
						content: Buffer.from(JSON.stringify(existing)).toString("base64"),
						sha: "abc123",
					}),
				})
				.mockResolvedValueOnce({ ok: true });

			const { addPerfMetric } = await import("../lib/github-data");
			await addPerfMetric({
				pathname: "/about",
				name: "FCP",
				value: 150,
				timestamp: new Date().toISOString(),
			});

			expect(mockFetch).toHaveBeenCalledTimes(2);

			const putCall = mockFetch.mock.calls[1];
			expect(putCall[1].method).toBe("PUT");

			const putBody = JSON.parse(putCall[1].body);
			expect(putBody.sha).toBe("abc123");

			const decoded = JSON.parse(
				Buffer.from(putBody.content, "base64").toString("utf-8"),
			);
			expect(decoded).toHaveLength(2);
			expect(decoded[1].name).toBe("FCP");
		});

		it("retries on 409 conflict", async () => {
			const existing = [
				{
					id: "old",
					pathname: "/",
					name: "LCP",
					value: 100,
					timestamp: new Date().toISOString(),
				},
			];

			mockFetch
				// First attempt: GET succeeds
				.mockResolvedValueOnce({
					ok: true,
					json: async () => ({
						content: Buffer.from(JSON.stringify(existing)).toString("base64"),
						sha: "abc123",
					}),
				})
				// First attempt: PUT fails with 409
				.mockResolvedValueOnce({
					ok: false,
					status: 409,
					text: async () => "409 Conflict",
				})
				// Retry: GET succeeds
				.mockResolvedValueOnce({
					ok: true,
					json: async () => ({
						content: Buffer.from(JSON.stringify(existing)).toString("base64"),
						sha: "def456",
					}),
				})
				// Retry: PUT succeeds
				.mockResolvedValueOnce({ ok: true });

			const { addPerfMetric } = await import("../lib/github-data");
			await addPerfMetric({
				pathname: "/",
				name: "TTFB",
				value: 50,
				timestamp: new Date().toISOString(),
			});

			expect(mockFetch).toHaveBeenCalledTimes(4);
		});

		it("prunes entries older than 90 days", async () => {
			const old = new Date();
			old.setDate(old.getDate() - 100);

			const existing = [
				{
					id: "old",
					pathname: "/",
					name: "LCP",
					value: 100,
					timestamp: old.toISOString(),
				},
			];

			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: async () => ({
						content: Buffer.from(JSON.stringify(existing)).toString("base64"),
						sha: "abc123",
					}),
				})
				.mockResolvedValueOnce({ ok: true });

			const { addPerfMetric } = await import("../lib/github-data");
			await addPerfMetric({
				pathname: "/",
				name: "FCP",
				value: 200,
				timestamp: new Date().toISOString(),
			});

			const putBody = JSON.parse(mockFetch.mock.calls[1][1].body);
			const decoded = JSON.parse(
				Buffer.from(putBody.content, "base64").toString("utf-8"),
			);
			// Old entry pruned, only new entry remains
			expect(decoded).toHaveLength(1);
			expect(decoded[0].name).toBe("FCP");
		});

		it("handles 404 (new file) gracefully", async () => {
			mockFetch
				.mockResolvedValueOnce({
					ok: false,
					status: 404,
				})
				.mockResolvedValueOnce({ ok: true });

			const { addPerfMetric } = await import("../lib/github-data");
			await addPerfMetric({
				pathname: "/",
				name: "LCP",
				value: 100,
				timestamp: new Date().toISOString(),
			});

			const putBody = JSON.parse(mockFetch.mock.calls[1][1].body);
			expect(putBody.sha).toBeUndefined();
		});
	});
});
