import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface PerfMetric {
	id: string;
	pathname: string;
	name: string;
	value: number;
	timestamp: string;
}

export interface PageView {
	id: string;
	pathname: string;
	duration: number;
	timestamp: string;
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";
const GITHUB_REPO = process.env.GITHUB_REPO ?? "";
const MAX_AGE_DAYS = 90;
const MAX_RETRIES = 3;

function githubApi(path: string) {
	return `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`;
}

function pruneOldEntries<T extends { timestamp: string }>(entries: T[]): T[] {
	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);
	return entries.filter((e) => new Date(e.timestamp) >= cutoff);
}

async function readLocalFile<T>(filePath: string): Promise<T[]> {
	try {
		const fullPath = join(process.cwd(), filePath);
		const content = await readFile(fullPath, "utf-8");
		return JSON.parse(content) as T[];
	} catch {
		return [];
	}
}

async function fetchFileFromGitHub(
	filePath: string,
): Promise<{ content: string; sha: string }> {
	const res = await fetch(githubApi(filePath), {
		headers: {
			Authorization: `Bearer ${GITHUB_TOKEN}`,
			Accept: "application/vnd.github.v3+json",
		},
		cache: "no-store",
	});

	if (!res.ok) {
		if (res.status === 404) {
			return { content: "[]", sha: "" };
		}
		throw new Error(`GitHub API error: ${res.status}`);
	}

	const data = await res.json();
	const content = Buffer.from(data.content, "base64").toString("utf-8");
	return { content, sha: data.sha };
}

async function writeFileToGitHub(
	filePath: string,
	content: string,
	sha: string,
): Promise<void> {
	const body: Record<string, string> = {
		message: `data: update ${filePath}`,
		content: Buffer.from(content).toString("base64"),
	};
	if (sha) {
		body.sha = sha;
	}

	const res = await fetch(githubApi(filePath), {
		method: "PUT",
		headers: {
			Authorization: `Bearer ${GITHUB_TOKEN}`,
			Accept: "application/vnd.github.v3+json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});

	if (!res.ok) {
		const error = await res.text();
		throw new Error(`GitHub PUT failed (${res.status}): ${error}`);
	}
}

async function appendLocalFile<T extends { timestamp: string }>(
	filePath: string,
	entry: T,
): Promise<void> {
	const fullPath = join(process.cwd(), filePath);
	const entries = await readLocalFile<T>(filePath);
	entries.push(entry);
	const pruned = pruneOldEntries(entries);
	await writeFile(fullPath, JSON.stringify(pruned, null, 2));
}

async function appendViaGitHub<T extends { timestamp: string }>(
	filePath: string,
	entry: T,
): Promise<void> {
	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		const { content, sha } = await fetchFileFromGitHub(filePath);
		const entries = JSON.parse(content) as T[];
		entries.push(entry);
		const pruned = pruneOldEntries(entries);
		const updated = JSON.stringify(pruned, null, 2);

		try {
			await writeFileToGitHub(filePath, updated, sha);
			return;
		} catch (err) {
			const isConflict = err instanceof Error && err.message.includes("409");
			if (!isConflict || attempt === MAX_RETRIES - 1) {
				throw err;
			}
		}
	}
}

async function appendToFile<T extends { timestamp: string }>(
	filePath: string,
	entry: T,
): Promise<void> {
	if (!GITHUB_TOKEN) {
		return appendLocalFile(filePath, entry);
	}
	return appendViaGitHub(filePath, entry);
}

export async function getPerfMetrics(since: Date): Promise<PerfMetric[]> {
	const entries = await readLocalFile<PerfMetric>("data/perf-metrics.json");
	return entries
		.filter((e) => new Date(e.timestamp) >= since)
		.sort(
			(a, b) =>
				new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
		);
}

export async function getPageViews(since: Date): Promise<PageView[]> {
	const entries = await readLocalFile<PageView>("data/page-views.json");
	return entries
		.filter((e) => new Date(e.timestamp) >= since)
		.sort(
			(a, b) =>
				new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
		);
}

export async function addPerfMetric(
	metric: Omit<PerfMetric, "id">,
): Promise<void> {
	const entry: PerfMetric = {
		id: crypto.randomUUID(),
		...metric,
	};
	await appendToFile("data/perf-metrics.json", entry);
}

export async function addPageView(view: Omit<PageView, "id">): Promise<void> {
	const entry: PageView = {
		id: crypto.randomUUID(),
		...view,
	};
	await appendToFile("data/page-views.json", entry);
}
