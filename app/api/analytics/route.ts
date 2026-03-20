import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const { pathname, duration, timestamp } = body;

		if (typeof pathname !== "string" || typeof duration !== "number") {
			return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
		}

		await prisma.pageView.create({
			data: {
				pathname,
				duration: Math.round(duration),
				timestamp: new Date(timestamp),
			},
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

		const since = new Date();
		since.setDate(since.getDate() - days);

		const views = await prisma.pageView.findMany({
			where: { timestamp: { gte: since } },
			orderBy: { timestamp: "desc" },
		});

		return NextResponse.json(views);
	} catch {
		return NextResponse.json(
			{ error: "Failed to fetch analytics" },
			{ status: 500 },
		);
	}
}
