"use client";

import { AdminDashboard } from "@/components/admin-dashboard";

export default function AdminPage() {
	return (
		<main className="mx-auto w-full max-w-6xl px-4 py-8">
			<h1 className="mb-6 text-2xl font-semibold tracking-tight">Analytics</h1>
			<AdminDashboard />
		</main>
	);
}
