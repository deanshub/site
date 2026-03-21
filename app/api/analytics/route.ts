import { NextResponse } from "next/server";
import {
	addPageView,
	addPerfMetric,
	getPageViews,
	getPerfMetrics,
} from "@/lib/github-data";

const ALLOWED_METRIC_NAMES = [
	"page-duration",
	"LCP",
	"FCP",
	"CLS",
	"INP",
	"TTFB",
];

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const { pathname, timestamp } = body;

		if (typeof pathname !== "string") {
			return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
		}

		// New PerfMetric format: { pathname, name, value, timestamp }
		if ("name" in body) {
			const { name, value } = body;

			if (
				typeof name !== "string" ||
				!ALLOWED_METRIC_NAMES.includes(name) ||
				typeof value !== "number"
			) {
				return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
			}

			await addPerfMetric({
				pathname,
				name,
				value,
				timestamp: new Date(timestamp).toISOString(),
			});

			return NextResponse.json({ ok: true });
		}

		// Legacy PageView format: { pathname, duration, timestamp }
		const { duration } = body;

		if (typeof duration !== "number") {
			return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
		}

		await addPageView({
			pathname,
			duration: Math.round(duration),
			timestamp: new Date(timestamp).toISOString(),
		});

		return NextResponse.json({ ok: true });
	} catch {
		return NextResponse.json(
			{ error: "Failed to record analytics" },
			{ status: 500 },
		);
	}
}

export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const days = Number(searchParams.get("days") ?? 7);
		const model = searchParams.get("model");

		const since = new Date();
		since.setDate(since.getDate() - days);

		if (model === "metrics") {
			const metrics = await getPerfMetrics(since);
			return NextResponse.json(metrics);
		}

		const views = await getPageViews(since);
		return NextResponse.json(views);
	} catch {
		return NextResponse.json(
			{ error: "Failed to fetch analytics" },
			{ status: 500 },
		);
	}
}
