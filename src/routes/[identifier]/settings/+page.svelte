<script lang="ts">
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
	<title>Settings - TBR.fyi</title>
</svelte:head>

<div class="settings-page">
	<div class="settings-container">
		<!-- Header -->
		<div class="settings-header">
			<h1 class="settings-title">Settings</h1>
			<p class="settings-subtitle">
				Manage your account and export your library
			</p>
		</div>

		<!-- Export Section -->
		<div class="card">
			<h2 class="card-title">Export Library</h2>
			<p class="card-description">
				Download your books to use with other platforms.
			</p>

			<!-- Format Selection -->
			<fieldset class="format-fieldset">
				<legend class="sr-only">Export format</legend>
				<div class="format-options">
					<label class="format-option">
						<input
							type="radio"
							name="export-format"
							value="csv"
							bind:group={exportFormat}
							class="format-radio"
						/>
						<div>
							<span class="format-label">CSV (Goodreads format)</span>
							<span class="format-hint">Works with StoryGraph, Hardcover, BookWyrm, Literal</span>
						</div>
					</label>
					<label class="format-option">
						<input
							type="radio"
							name="export-format"
							value="json"
							bind:group={exportFormat}
							class="format-radio"
						/>
						<div>
							<span class="format-label">JSON (TBR.fyi format)</span>
							<span class="format-hint">For developers or data backup</span>
						</div>
					</label>
				</div>
			</fieldset>

			<button
				class="export-button"
				onclick={handleExport}
				disabled={isExporting}
			>
				{#if isExporting}
					<svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
					Exporting...
				{:else}
					Download Export
				{/if}
			</button>

			{#if exportFormat === 'csv'}
				<p class="import-hint">
					After downloading, import to:
					<span class="import-step">StoryGraph: Manage Account &rarr; Goodreads Import</span>
					<span class="import-step">Hardcover: Settings &rarr; Import</span>
					<span class="import-step">BookWyrm: Settings &rarr; Import</span>
				</p>
			{/if}

			{#if exportError}
				<div class="error-alert" role="alert">
					<p>{exportError}</p>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.settings-page {
		font-family: var(--font-sans);
		background: var(--background);
		color: var(--text-primary);
		min-height: 100vh;
		padding: 32px 16px;
	}

	.settings-container {
		max-width: 40rem;
		margin: 0 auto;
	}

	.settings-header {
		margin-bottom: 32px;
	}

	.settings-title {
		font-size: 1.875rem;
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: 8px;
	}

	.settings-subtitle {
		color: var(--text-secondary);
	}

	.card {
		background: var(--surface);
		border-radius: 16px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		padding: 24px;
		border: 1px solid var(--border);
	}

	.card-title {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 8px;
	}

	.card-description {
		color: var(--text-secondary);
		margin-bottom: 24px;
	}

	.format-fieldset {
		margin-bottom: 24px;
	}

	.format-options {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.format-option {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		cursor: pointer;
	}

	.format-radio {
		margin-top: 4px;
		width: 16px;
		height: 16px;
		accent-color: var(--accent);
	}

	.format-label {
		display: block;
		font-weight: 500;
		color: var(--text-primary);
	}

	.format-hint {
		display: block;
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	.export-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 12px 24px;
		background: var(--accent);
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.2s;
	}

	.export-button:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.export-button:focus {
		outline: none;
		box-shadow: 0 0 0 3px rgba(196, 166, 124, 0.3);
	}

	.export-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.import-hint {
		margin-top: 16px;
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	.import-step {
		display: block;
		margin-top: 4px;
	}

	.import-step:first-of-type {
		margin-top: 8px;
	}

	.error-alert {
		margin-top: 16px;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 8px;
		padding: 12px;
		color: #991b1b;
		font-size: 0.875rem;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}
</style>
