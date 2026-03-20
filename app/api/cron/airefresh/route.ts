import { NextResponse } from "next/server";

async function runAiRefresh() {
	console.log("[airefresh] Starting AI refresh job...");
	// TODO: implement actual refresh logic
	console.log("[airefresh] Done.");
}

export async function GET(request: Request) {
	const authHeader = request.headers.get("authorization");
	if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		await runAiRefresh();
		return NextResponse.json({ ok: true });
	} catch {
		return NextResponse.json({ error: "AI refresh failed" }, { status: 500 });
	}
}
