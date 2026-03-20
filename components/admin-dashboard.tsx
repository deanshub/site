"use client";

import { format } from "date-fns";
import { useState } from "react";
import useSWR from "swr";
import {
	PageDurationChart,
	TopPagesChart,
	VitalsOverTimeChart,
} from "@/components/admin-charts";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PageView {
	id: string;
	pathname: string;
	duration: number;
	timestamp: string;
}

interface PerfMetric {
	id: string;
	pathname: string;
	name: string;
	value: number;
	timestamp: string;
}

const METRIC_NAMES = ["page-duration", "LCP", "FCP", "CLS", "INP", "TTFB"];

function formatMs(ms: number): string {
	if (ms < 1000) return `${Math.round(ms)}ms`;
	return `${(ms / 1000).toFixed(2)}s`;
}

function formatMetricValue(name: string, value: number): string {
	if (name === "CLS") return value.toFixed(3);
	return formatMs(value);
}

function ratingForMetric(
	name: string,
	value: number,
): "good" | "needs-improvement" | "poor" {
	const thresholds: Record<string, [number, number]> = {
		LCP: [2500, 4000],
		FCP: [1800, 3000],
		CLS: [0.1, 0.25],
		INP: [200, 500],
		TTFB: [800, 1800],
	};
	const t = thresholds[name];
	if (!t) return "good";
	if (value <= t[0]) return "good";
	if (value <= t[1]) return "needs-improvement";
	return "poor";
}

function RatingBadge({ name, value }: { name: string; value: number }) {
	const rating = ratingForMetric(name, value);
	const variant =
		rating === "good"
			? "default"
			: rating === "needs-improvement"
				? "secondary"
				: "destructive";
	const label =
		rating === "good"
			? "Good"
			: rating === "needs-improvement"
				? "Needs work"
				: "Poor";
	return <Badge variant={variant}>{label}</Badge>;
}

function MetricSummaryCards({ metrics }: { metrics: PerfMetric[] }) {
	const summaries = METRIC_NAMES.map((name) => {
		const entries = metrics.filter((m) => m.name === name);
		if (entries.length === 0) return null;
		const values = entries.map((e) => e.value);
		const avg = values.reduce((a, b) => a + b, 0) / values.length;
		const p75 = values.sort((a, b) => a - b)[Math.floor(values.length * 0.75)];
		const min = Math.min(...values);
		const max = Math.max(...values);
		return { name, count: entries.length, avg, p75, min, max };
	}).filter((s) => s !== null);

	if (summaries.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">No metrics recorded yet.</p>
		);
	}

	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{summaries.map((s) => (
				<Card key={s.name}>
					<CardHeader className="pb-2">
						<CardDescription>{s.name}</CardDescription>
						<CardTitle className="text-2xl">
							{formatMetricValue(s.name, s.p75)}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-2">
							<RatingBadge name={s.name} value={s.p75} />
							<span className="text-muted-foreground text-xs">
								p75 of {s.count} samples
							</span>
						</div>
						<div className="text-muted-foreground mt-2 grid grid-cols-3 gap-2 text-xs">
							<div>
								<span className="block font-medium">Avg</span>
								{formatMetricValue(s.name, s.avg)}
							</div>
							<div>
								<span className="block font-medium">Min</span>
								{formatMetricValue(s.name, s.min)}
							</div>
							<div>
								<span className="block font-medium">Max</span>
								{formatMetricValue(s.name, s.max)}
							</div>
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	);
}

function PageViewsTable({ views }: { views: PageView[] }) {
	if (views.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				No page views recorded yet.
			</p>
		);
	}

	const byPath = new Map<string, { count: number; totalDuration: number }>();
	for (const v of views) {
		const existing = byPath.get(v.pathname) ?? { count: 0, totalDuration: 0 };
		existing.count++;
		existing.totalDuration += v.duration;
		byPath.set(v.pathname, existing);
	}
	const pathStats = [...byPath.entries()]
		.map(([pathname, stats]) => ({
			pathname,
			...stats,
			avgDuration: stats.totalDuration / stats.count,
		}))
		.sort((a, b) => b.count - a.count);

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Pages by views</CardTitle>
					<CardDescription>
						Aggregated from {views.length} page views
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Path</TableHead>
								<TableHead className="text-right">Views</TableHead>
								<TableHead className="text-right">Avg duration</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{pathStats.map((row) => (
								<TableRow key={row.pathname}>
									<TableCell className="font-mono text-sm">
										{row.pathname}
									</TableCell>
									<TableCell className="text-right">{row.count}</TableCell>
									<TableCell className="text-right">
										{formatMs(row.avgDuration)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Recent page views</CardTitle>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Path</TableHead>
								<TableHead className="text-right">Duration</TableHead>
								<TableHead className="text-right">Time</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{views.slice(0, 50).map((v) => (
								<TableRow key={v.id}>
									<TableCell className="font-mono text-sm">
										{v.pathname}
									</TableCell>
									<TableCell className="text-right">
										{formatMs(v.duration)}
									</TableCell>
									<TableCell className="text-muted-foreground text-right text-sm">
										{format(new Date(v.timestamp), "MMM d, HH:mm:ss")}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	);
}

function MetricsTable({ metrics }: { metrics: PerfMetric[] }) {
	if (metrics.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">No metrics recorded yet.</p>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Recent metrics</CardTitle>
				<CardDescription>Last 100 entries</CardDescription>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Metric</TableHead>
							<TableHead>Path</TableHead>
							<TableHead className="text-right">Value</TableHead>
							<TableHead className="text-right">Rating</TableHead>
							<TableHead className="text-right">Time</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{metrics.slice(0, 100).map((m) => (
							<TableRow key={m.id}>
								<TableCell>
									<Badge variant="outline">{m.name}</Badge>
								</TableCell>
								<TableCell className="font-mono text-sm">
									{m.pathname}
								</TableCell>
								<TableCell className="text-right">
									{formatMetricValue(m.name, m.value)}
								</TableCell>
								<TableCell className="text-right">
									<RatingBadge name={m.name} value={m.value} />
								</TableCell>
								<TableCell className="text-muted-foreground text-right text-sm">
									{format(new Date(m.timestamp), "MMM d, HH:mm:ss")}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}

export function AdminDashboard() {
	const [days, setDays] = useState("7");
	const { data: pageViews, isLoading: loadingViews } = useSWR<PageView[]>(
		`/api/analytics?days=${days}`,
		{ suspense: false },
	);
	const { data: metrics, isLoading: loadingMetrics } = useSWR<PerfMetric[]>(
		`/api/analytics?model=metrics&days=${days}`,
		{ suspense: false },
	);

	if (loadingViews || loadingMetrics) {
		return (
			<div className="text-muted-foreground text-sm">Loading analytics...</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-3">
				<span className="text-muted-foreground text-sm">Time range:</span>
				<Select value={days} onValueChange={(v) => v && setDays(v)}>
					<SelectTrigger className="w-36">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="1">Last 24 hours</SelectItem>
						<SelectItem value="7">Last 7 days</SelectItem>
						<SelectItem value="30">Last 30 days</SelectItem>
						<SelectItem value="90">Last 90 days</SelectItem>
					</SelectContent>
				</Select>
			</div>

			<MetricSummaryCards metrics={metrics ?? []} />

			<div className="grid gap-4 lg:grid-cols-2">
				<VitalsOverTimeChart metrics={metrics ?? []} />
				<PageDurationChart metrics={metrics ?? []} />
			</div>

			<TopPagesChart views={pageViews ?? []} />

			<Tabs defaultValue="metrics">
				<TabsList>
					<TabsTrigger value="metrics">Web Vitals</TabsTrigger>
					<TabsTrigger value="pageviews">Page Views (legacy)</TabsTrigger>
				</TabsList>
				<TabsContent value="metrics" className="mt-4">
					<MetricsTable metrics={metrics ?? []} />
				</TabsContent>
				<TabsContent value="pageviews" className="mt-4">
					<PageViewsTable views={pageViews ?? []} />
				</TabsContent>
			</Tabs>
		</div>
	);
}
