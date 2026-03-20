import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@": resolve(__dirname, "."),
		},
	},
	test: {
		environment: "jsdom",
		testTimeout: 5000,
		hookTimeout: 5000,
		teardownTimeout: 5000,
		fileParallelism: true,
		maxConcurrency: 10,
		coverage: {
			provider: "v8",
			include: [
				"instrumentation-client.ts",
				"components/analytics-tracker.tsx",
				"app/api/analytics/route.ts",
				"lib/prisma.ts",
			],
			thresholds: {
				statements: 100,
				branches: 100,
				functions: 100,
				lines: 100,
			},
		},
	},
});
