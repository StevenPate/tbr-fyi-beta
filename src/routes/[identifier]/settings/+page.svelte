<script lang="ts">
	import { Button } from '$lib/components/ui';

	let isExporting = $state(false);
	let exportError = $state<string | null>(null);
	let exportFormat = $state<'csv' | 'json'>('csv');

	async function handleExport() {
		isExporting = true;
		exportError = null;

		const endpoint = exportFormat === 'csv' ? '/api/export/csv' : '/api/export';
		const defaultFilename = exportFormat === 'csv' ? 'tbr-export.csv' : 'tbr-export.json';

		try {
			// Browser automatically sets Referer header with current page URL
			const response = await fetch(endpoint);

			if (!response.ok) {
				const result = await response.json();
				exportError = result.error || 'Export failed';
				return;
			}

			// Trigger download
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;

			// Extract filename from Content-Disposition header
			const contentDisposition = response.headers.get('Content-Disposition');
			const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
			const filename = filenameMatch?.[1] || defaultFilename;

			a.download = filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			window.URL.revokeObjectURL(url);
		} catch (error) {
			console.error('Export error:', error);
			exportError = 'Export failed. Please try again.';
		} finally {
			isExporting = false;
		}
	}
</script>

<svelte:head>
	<title>Settings - TBR</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8">
	<div class="max-w-2xl mx-auto px-4">
		<!-- Header -->
		<div class="mb-8">
			<h1 class="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
			<p class="text-gray-600">
				Manage your account and export your library
			</p>
		</div>

		<!-- Export Section -->
		<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
			<h2 class="text-xl font-semibold text-gray-900 mb-2">Export Library</h2>
			<p class="text-gray-600 mb-4">
				Download your books to use with other platforms.
			</p>

			<!-- Format Selection -->
			<fieldset class="mb-6">
				<legend class="sr-only">Export format</legend>
				<div class="space-y-3">
					<label class="flex items-start gap-3 cursor-pointer">
						<input
							type="radio"
							name="export-format"
							value="csv"
							bind:group={exportFormat}
							class="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
						/>
						<div>
							<span class="block font-medium text-gray-900">CSV (Goodreads format)</span>
							<span class="block text-sm text-gray-500">Works with StoryGraph, Hardcover, BookWyrm, Literal</span>
						</div>
					</label>
					<label class="flex items-start gap-3 cursor-pointer">
						<input
							type="radio"
							name="export-format"
							value="json"
							bind:group={exportFormat}
							class="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
						/>
						<div>
							<span class="block font-medium text-gray-900">JSON (TBR.fyi format)</span>
							<span class="block text-sm text-gray-500">For developers or data backup</span>
						</div>
					</label>
				</div>
			</fieldset>

			<Button
				variant="primary"
				size="lg"
				onclick={handleExport}
				disabled={isExporting}
			>
				{isExporting ? 'Exporting...' : 'Download Export'}
			</Button>

			{#if exportFormat === 'csv'}
				<p class="mt-4 text-sm text-gray-500">
					After downloading, import to:
					<span class="block mt-1">StoryGraph: Manage Account &rarr; Goodreads Import</span>
					<span class="block">Hardcover: Settings &rarr; Import</span>
					<span class="block">BookWyrm: Settings &rarr; Import</span>
				</p>
			{/if}

			{#if exportError}
				<div class="mt-4 bg-red-50 border border-red-200 rounded-lg p-3" role="alert">
					<p class="text-sm text-red-800">{exportError}</p>
				</div>
			{/if}
		</div>
	</div>
</div>
