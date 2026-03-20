"use client";

import { format, startOfDay } from "date-fns";
import { useMemo } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Line,
	LineChart,
	XAxis,
	YAxis,
} from "recharts";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";

interface PerfMetric {
	id: string;
	pathname: string;
	name: string;
	value: number;
	timestamp: string;
}

interface PageView {
	id: string;
	pathname: string;
	duration: number;
	timestamp: string;
}

const VITALS = ["LCP", "FCP", "TTFB"] as const;

const vitalsConfig = {
	LCP: { label: "LCP", color: "var(--chart-1)" },
	FCP: { label: "FCP", color: "var(--chart-2)" },
	TTFB: { label: "TTFB", color: "var(--chart-3)" },
} satisfies ChartConfig;

const durationConfig = {
	"page-duration": { label: "Avg duration", color: "var(--chart-4)" },
} satisfies ChartConfig;

const viewsConfig = {
	views: { label: "Views", color: "var(--chart-5)" },
} satisfies ChartConfig;

export function VitalsOverTimeChart({ metrics }: { metrics: PerfMetric[] }) {
	const data = useMemo(() => {
		const byDay = new Map<string, Record<string, number[]>>();

		for (const m of metrics) {
			if (!VITALS.includes(m.name as (typeof VITALS)[number])) continue;
			const day = format(startOfDay(new Date(m.timestamp)), "MMM d");
			if (!byDay.has(day)) byDay.set(day, {});
			const bucket = byDay.get(day) ?? {};
			if (!bucket[m.name]) bucket[m.name] = [];
			bucket[m.name].push(m.value);
		}

		return [...byDay.entries()].map(([day, bucket]) => {
			const row: Record<string, string | number> = { day };
			for (const name of VITALS) {
				const vals = bucket[name];
				if (vals && vals.length > 0) {
					row[name] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
				}
			}
			return row;
		});
	}, [metrics]);

	if (data.length === 0) {
		return null;
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Web Vitals over time</CardTitle>
				<CardDescription>Daily average LCP, FCP, TTFB (ms)</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={vitalsConfig} className="h-64 w-full">
					<LineChart data={data} accessibilityLayer>
						<CartesianGrid vertical={false} />
						<XAxis dataKey="day" tickLine={false} axisLine={false} />
						<YAxis tickLine={false} axisLine={false} width={50} />
						<ChartTooltip content={<ChartTooltipContent />} />
						<ChartLegend content={<ChartLegendContent />} />
						{VITALS.map((name) => (
							<Line
								key={name}
								type="monotone"
								dataKey={name}
								stroke={`var(--color-${name})`}
								strokeWidth={2}
								dot={false}
								connectNulls
							/>
						))}
					</LineChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}

export function PageDurationChart({ metrics }: { metrics: PerfMetric[] }) {
	const data = useMemo(() => {
		const byDay = new Map<string, number[]>();

		for (const m of metrics) {
			if (m.name !== "page-duration") continue;
			const day = format(startOfDay(new Date(m.timestamp)), "MMM d");
			if (!byDay.has(day)) byDay.set(day, []);
			byDay.get(day)?.push(m.value);
		}

		return [...byDay.entries()].map(([day, vals]) => ({
			day,
			"page-duration": Math.round(
				vals.reduce((a, b) => a + b, 0) / vals.length,
			),
		}));
	}, [metrics]);

	if (data.length === 0) {
		return null;
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Page duration over time</CardTitle>
				<CardDescription>Daily average time on page (ms)</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={durationConfig} className="h-64 w-full">
					<BarChart data={data} accessibilityLayer>
						<CartesianGrid vertical={false} />
						<XAxis dataKey="day" tickLine={false} axisLine={false} />
						<YAxis tickLine={false} axisLine={false} width={50} />
						<ChartTooltip content={<ChartTooltipContent />} />
						<Bar
							dataKey="page-duration"
							fill="var(--color-page-duration)"
							radius={[4, 4, 0, 0]}
						/>
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}

export function TopPagesChart({ views }: { views: PageView[] }) {
	const data = useMemo(() => {
		const byPath = new Map<string, number>();
		for (const v of views) {
			byPath.set(v.pathname, (byPath.get(v.pathname) ?? 0) + 1);
		}
		return [...byPath.entries()]
			.map(([pathname, views]) => ({ pathname, views }))
			.sort((a, b) => b.views - a.views)
			.slice(0, 10);
	}, [views]);

	if (data.length === 0) {
		return null;
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Top pages</CardTitle>
				<CardDescription>Most viewed pages</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={viewsConfig} className="h-64 w-full">
					<BarChart data={data} layout="vertical" accessibilityLayer>
						<CartesianGrid horizontal={false} />
						<XAxis type="number" tickLine={false} axisLine={false} />
						<YAxis
							dataKey="pathname"
							type="category"
							tickLine={false}
							axisLine={false}
							width={120}
							className="text-xs"
						/>
						<ChartTooltip content={<ChartTooltipContent />} />
						<Bar
							dataKey="views"
							fill="var(--color-views)"
							radius={[0, 4, 4, 0]}
						/>
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
