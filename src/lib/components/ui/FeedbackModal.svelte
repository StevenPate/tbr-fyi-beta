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
		class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
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
		<div
			class="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
		>
			<!-- Header -->
			<div class="border-b border-gray-200 p-6 pb-4">
				<div class="flex items-center justify-between">
					<h2 id="feedback-modal-title" class="text-2xl font-semibold text-gray-900">
						Give Feedback
					</h2>
					<button
						onclick={handleClose}
						class="text-gray-400 hover:text-gray-600 transition-colors"
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
			<form onsubmit={handleSubmit} class="p-6 space-y-6">
				{#if submitSuccess}
					<!-- Success message -->
					<div class="bg-green-50 border border-green-200 rounded-lg p-4 text-center" role="alert">
						<p class="text-green-800 font-medium">✓ Thanks! Your feedback has been sent.</p>
					</div>

					<!-- Warning message (if screenshot upload failed) -->
					{#if submitWarning}
						<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3" role="alert">
							<p class="text-sm text-yellow-800">⚠️ {submitWarning}</p>
						</div>
					{/if}
				{:else}
					<!-- Question 1 -->
					<div>
						<label for="question1" class="block text-sm font-medium text-gray-900 mb-2">
							What were you trying to do? <span class="text-red-500">*</span>
						</label>
						<textarea
							id="question1"
							bind:value={question1}
							placeholder="e.g., Add a book by scanning the barcode"
							rows="3"
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
							disabled={isSubmitting}
							required
						></textarea>
					</div>

					<!-- Question 2 -->
					<div>
						<label for="question2" class="block text-sm font-medium text-gray-900 mb-2">
							What happened? Or didn't happen? <span class="text-red-500">*</span>
						</label>
						<textarea
							id="question2"
							bind:value={question2}
							placeholder="e.g., The camera opened but nothing happened when I took the photo"
							rows="4"
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
							disabled={isSubmitting}
							required
						></textarea>
					</div>

					<!-- Screenshot upload -->
					<div>
						<label for="screenshot" class="block text-sm font-medium text-gray-900 mb-2">
							Screenshot (optional)
						</label>
						<input
							type="file"
							id="screenshot"
							bind:this={fileInput}
							onchange={handleFileChange}
							accept="image/png,image/jpeg,image/jpg,image/gif"
							class="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
							disabled={isSubmitting}
						/>
						{#if screenshot}
							<div class="mt-2 flex items-center gap-2">
								<span class="text-sm text-gray-600">📎 {screenshot.name}</span>
								<button
									type="button"
									onclick={removeFile}
									class="text-xs text-red-600 hover:text-red-800"
									disabled={isSubmitting}
								>
									Remove
								</button>
							</div>
						{/if}
						<p class="mt-1 text-xs text-gray-500">PNG, JPG, or GIF. Max 10MB.</p>
					</div>

					<!-- Error message -->
					{#if submitError}
						<div class="bg-red-50 border border-red-200 rounded-lg p-3" role="alert">
							<p class="text-sm text-red-800">{submitError}</p>
						</div>
					{/if}

					<!-- Submit button -->
					<div class="flex gap-3 pt-4">
						<button
							type="button"
							onclick={handleClose}
							class="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
							disabled={isSubmitting}
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={!canSubmit}
							class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
