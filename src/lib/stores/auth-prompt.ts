// Store for controlling the sign-in prompt modal
// Triggered when API calls return 401 (session expired)

import { writable } from 'svelte/store';

interface AuthPromptState {
	show: boolean;
	message?: string;
}

function createAuthPromptStore() {
	const { subscribe, set } = writable<AuthPromptState>({
		show: false
	});

	return {
		subscribe,
		trigger: (message?: string) => {
			set({ show: true, message });
		},
		dismiss: () => {
			set({ show: false });
		}
	};
}

export const authPrompt = createAuthPromptStore();
