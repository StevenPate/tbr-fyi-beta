<script lang="ts">
	interface Props {
		open: boolean;
		onClose: () => void;
		userId?: string | null;
	}

	let { open, onClose, userId = null }: Props = $props();

	let question1 = $state('');
	let question2 = $state('');
	let screenshot: File | null = $state(null);
	let isSubmitting = $state(false);
	let submitSuccess = $state(false);
	let submitError = $state('');
	let submitWarning = $state('');

	let fileInput: HTMLInputElement;
	let modalElement: HTMLDivElement;
	let firstFocusableElement: HTMLElement | null = null;
	let lastFocusableElement: HTMLElement | null = null;
	let previousActiveElement: HTMLElement | null = null;

	// Handle backdrop click
	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			handleClose();
		}
	}

	// Handle close with confirmation if form has content
	function handleClose() {
		if (!isSubmitting && !submitSuccess) {
			const hasContent = question1.trim() || question2.trim();
			if (hasContent) {
				const confirmed = confirm('Discard your feedback?');
				if (!confirmed) return;
			}
		}
		resetForm();
		onClose();

		// Restore focus to element that opened modal
		setTimeout(() => {
			previousActiveElement?.focus();
		}, 0);
	}

	// Handle keyboard events
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			handleClose();
		}
	}

	// Focus trap setup
	$effect(() => {
		if (open && modalElement) {
			// Capture element that opened the modal for restoration on close
			previousActiveElement = document.activeElement as HTMLElement;

			// Get all focusable elements
			const focusableElements = modalElement.querySelectorAll(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			);

			// Guard against empty NodeList
			if (focusableElements.length === 0) {
				firstFocusableElement = null;
				lastFocusableElement = null;
				return;
			}

			firstFocusableElement = focusableElements[0] as HTMLElement;
			lastFocusableElement = focusableElements[focusableElements.length - 1] as HTMLElement;

			// Focus first element
			firstFocusableElement?.focus();
		}
	});

	// Handle Tab key for focus trap
	function handleTabKey(e: KeyboardEvent) {
		if (e.key !== 'Tab') return;

		// Short-circuit if no focusable elements
		if (!firstFocusableElement || !lastFocusableElement) return;

		if (e.shiftKey) {
			// Shift + Tab
			if (document.activeElement === firstFocusableElement) {
				e.preventDefault();
				lastFocusableElement.focus();
			}
		} else {
			// Tab
			if (document.activeElement === lastFocusableElement) {
				e.preventDefault();
				firstFocusableElement.focus();
			}
		}
	}

	// Handle file selection
	function handleFileChange(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];

		if (!file) {
			screenshot = null;
			return;
		}

		// Validate file type
		const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
		if (!validTypes.includes(file.type)) {
			alert('Please upload an image file (PNG, JPG, or GIF)');
			target.value = '';
			screenshot = null;
			return;
		}

		// Validate file size (10MB max)
		const maxSize = 10 * 1024 * 1024; // 10MB
		if (file.size > maxSize) {
			alert('File too large. Please upload an image under 10MB.');
			target.value = '';
			screenshot = null;
			return;
		}

		screenshot = file;
	}

	// Remove selected file
	function removeFile() {
		screenshot = null;
		if (fileInput) {
			fileInput.value = '';
		}
	}

	// Reset form
	function resetForm() {
		question1 = '';
		question2 = '';
		screenshot = null;
		isSubmitting = false;
		submitSuccess = false;
		submitError = '';
		submitWarning = '';
		if (fileInput) {
			fileInput.value = '';
		}
	}

	// Handle form submission
	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (!question1.trim() || !question2.trim()) {
			submitError = 'Please answer both questions';
			return;
		}

		isSubmitting = true;
		submitError = '';

		try {
			const formData = new FormData();
			formData.append('question1', question1.trim());
			formData.append('question2', question2.trim());
			if (userId) {
				formData.append('userId', userId);
			}
			if (screenshot) {
				formData.append('screenshot', screenshot);
			}

			const response = await fetch('/api/feedback', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || 'Failed to submit feedback');
			}

			const result = await response.json();

			// Show warning if attachment failed but feedback succeeded
			if (result.warning) {
				submitWarning = result.warning;
			}

			submitSuccess = true;

			// Auto-close after 2 seconds
			setTimeout(() => {
				resetForm();
				onClose();
			}, 2000);
		} catch (error) {
			submitError = error instanceof Error ? error.message : 'Failed to send feedback. Please try again.';
		} finally {
			isSubmitting = false;
		}
	}

	// Derived state for submit button
	const canSubmit = $derived(
		question1.trim().length > 0 &&
		question2.trim().length > 0 &&
		!isSubmitting &&
		!submitSuccess
	);
</script>

{#if open}
	<!-- Modal backdrop -->
	<div
		bind:this={modalElement}
		class="modal-backdrop"
		onclick={handleBackdropClick}
		onkeydown={(e) => {
			handleKeydown(e);
			handleTabKey(e);
		}}
		role="dialog"
		aria-modal="true"
		aria-labelledby="feedback-modal-title"
	>
		<!-- Modal content -->
		<div class="modal-content">
			<!-- Header -->
			<div class="modal-header">
				<div class="modal-header-inner">
					<h2 id="feedback-modal-title" class="modal-title">
						Give Feedback
					</h2>
					<button
						onclick={handleClose}
						class="modal-close"
						aria-label="Close feedback form"
						disabled={isSubmitting}
					>
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
						</svg>
					</button>
				</div>
			</div>

			<!-- Form -->
			<form onsubmit={handleSubmit} class="modal-form">
				{#if submitSuccess}
					<!-- Success message -->
					<div class="alert alert-success" role="alert">
						<p>Thanks! Your feedback has been sent.</p>
					</div>

					<!-- Warning message (if screenshot upload failed) -->
					{#if submitWarning}
						<div class="alert alert-warning" role="alert">
							<p>{submitWarning}</p>
						</div>
					{/if}
				{:else}
					<!-- Question 1 -->
					<div class="form-group">
						<label for="question1" class="form-label">
							What were you trying to do? <span class="required">*</span>
						</label>
						<textarea
							id="question1"
							bind:value={question1}
							placeholder="e.g., Add a book by scanning the barcode"
							rows="3"
							class="form-textarea"
							disabled={isSubmitting}
							required
						></textarea>
					</div>

					<!-- Question 2 -->
					<div class="form-group">
						<label for="question2" class="form-label">
							What happened? Or didn't happen? <span class="required">*</span>
						</label>
						<textarea
							id="question2"
							bind:value={question2}
							placeholder="e.g., The camera opened but nothing happened when I took the photo"
							rows="4"
							class="form-textarea"
							disabled={isSubmitting}
							required
						></textarea>
					</div>

					<!-- Screenshot upload -->
					<div class="form-group">
						<label for="screenshot" class="form-label">
							Screenshot (optional)
						</label>
						<input
							type="file"
							id="screenshot"
							bind:this={fileInput}
							onchange={handleFileChange}
							accept="image/png,image/jpeg,image/jpg,image/gif"
							class="file-input"
							disabled={isSubmitting}
						/>
						{#if screenshot}
							<div class="file-preview">
								<span class="file-name">{screenshot.name}</span>
								<button
									type="button"
									onclick={removeFile}
									class="file-remove"
									disabled={isSubmitting}
								>
									Remove
								</button>
							</div>
						{/if}
						<p class="form-hint">PNG, JPG, or GIF. Max 10MB.</p>
					</div>

					<!-- Error message -->
					{#if submitError}
						<div class="alert alert-error" role="alert">
							<p>{submitError}</p>
						</div>
					{/if}

					<!-- Submit button -->
					<div class="button-group">
						<button
							type="button"
							onclick={handleClose}
							class="btn btn-secondary"
							disabled={isSubmitting}
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={!canSubmit}
							class="btn btn-primary"
						>
							{#if isSubmitting}
								<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
								Sending...
							{:else}
								Send Feedback
							{/if}
						</button>
					</div>
				{/if}
			</form>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 50;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
	}

	.modal-content {
		background: var(--surface);
		border-radius: 16px;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
		max-width: 42rem;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
	}

	.modal-header {
		border-bottom: 1px solid var(--border);
		padding: 24px;
		padding-bottom: 16px;
	}

	.modal-header-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.modal-title {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.modal-close {
		color: var(--text-secondary);
		background: none;
		border: none;
		cursor: pointer;
		padding: 4px;
		transition: color 0.2s;
	}

	.modal-close:hover {
		color: var(--text-primary);
	}

	.modal-form {
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.form-group {
		display: flex;
		flex-direction: column;
	}

	.form-label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-primary);
		margin-bottom: 8px;
	}

	.required {
		color: #dc2626;
	}

	.form-textarea {
		width: 100%;
		padding: 8px 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
		font-size: 0.875rem;
		color: var(--text-primary);
		background: var(--surface);
		resize: none;
		transition: border-color 0.2s, box-shadow 0.2s;
	}

	.form-textarea:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px rgba(196, 166, 124, 0.2);
	}

	.form-textarea:disabled {
		opacity: 0.5;
	}

	.form-textarea::placeholder {
		color: var(--text-secondary);
	}

	.file-input {
		width: 100%;
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	.file-input::file-selector-button {
		margin-right: 16px;
		padding: 8px 16px;
		border-radius: 8px;
		border: none;
		font-size: 0.875rem;
		font-weight: 500;
		background: var(--paper-light);
		color: var(--accent-hover);
		cursor: pointer;
		transition: background 0.2s;
	}

	.file-input::file-selector-button:hover {
		background: var(--paper-mid);
	}

	.file-preview {
		margin-top: 8px;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.file-name {
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	.file-remove {
		font-size: 0.75rem;
		color: #dc2626;
		background: none;
		border: none;
		cursor: pointer;
	}

	.file-remove:hover {
		color: #991b1b;
	}

	.form-hint {
		margin-top: 4px;
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.alert {
		padding: 12px 16px;
		border-radius: 8px;
		font-size: 0.875rem;
	}

	.alert-success {
		background: #f0fdf4;
		border: 1px solid #bbf7d0;
		color: #166534;
		text-align: center;
		font-weight: 500;
	}

	.alert-warning {
		background: #fefce8;
		border: 1px solid #fef08a;
		color: #854d0e;
	}

	.alert-error {
		background: #fef2f2;
		border: 1px solid #fecaca;
		color: #991b1b;
	}

	.button-group {
		display: flex;
		gap: 12px;
		padding-top: 16px;
	}

	.btn {
		flex: 1;
		padding: 10px 16px;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.btn-secondary {
		background: var(--surface);
		border: 1px solid var(--border);
		color: var(--text-primary);
	}

	.btn-secondary:hover:not(:disabled) {
		background: var(--paper-light);
	}

	.btn-primary {
		background: var(--accent);
		border: none;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
