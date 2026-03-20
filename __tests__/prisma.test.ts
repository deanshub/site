import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@prisma/adapter-pg", () => {
	return {
		PrismaPg: class MockPrismaPg {
			__adapter = true;
		},
	};
});

vi.mock("@/lib/generated/prisma/client", () => {
	return {
		PrismaClient: class MockPrismaClient {
			__mockClient = true;
		},
	};
});

describe("lib/prisma", () => {
	const globalForPrisma = globalThis as unknown as {
		prisma: unknown;
	};

	beforeEach(() => {
		vi.resetModules();
		delete globalForPrisma.prisma;
	});

	it("creates a new PrismaClient when none exists on globalThis", async () => {
		const { prisma } = await import("../lib/prisma");
		expect(prisma).toBeDefined();
		expect((prisma as Record<string, unknown>).__mockClient).toBe(true);
	});

	it("reuses existing PrismaClient from globalThis", async () => {
		const existing = { __existing: true };
		globalForPrisma.prisma = existing;

		const { prisma } = await import("../lib/prisma");
		expect(prisma).toBe(existing);
	});

	it("caches PrismaClient on globalThis in development", async () => {
		const originalEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = "development";

		const { prisma } = await import("../lib/prisma");
		expect(globalForPrisma.prisma).toBe(prisma);

		process.env.NODE_ENV = originalEnv;
	});

	it("does not cache PrismaClient on globalThis in production", async () => {
		const originalEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = "production";

		await import("../lib/prisma");
		expect(globalForPrisma.prisma).toBeUndefined();

		process.env.NODE_ENV = originalEnv;
	});
});
