<script lang="ts">
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui';

	const identifier = $page.params.identifier;
	let isExporting = $state(false);
	let exportError = $state<string | null>(null);

	async function handleExport() {
		isExporting = true;
		exportError = null;

		try {
			const response = await fetch('/api/export', {
				method: 'GET',
				headers: {
					'Referer': window.location.href
				}
			});

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
			const filename = filenameMatch?.[1] || 'tbr-export.json';

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
				Download your complete book collection as a JSON file. Includes ISBNs, notes, read/owned status, shelves, and metadata.
			</p>

			<Button
				variant="primary"
				size="lg"
				onclick={handleExport}
				disabled={isExporting}
			>
				{isExporting ? 'Exporting...' : 'Export Library'}
			</Button>

			{#if exportError}
				<div class="mt-4 bg-red-50 border border-red-200 rounded-lg p-3" role="alert">
					<p class="text-sm text-red-800">{exportError}</p>
				</div>
			{/if}
		</div>
	</div>
</div>
