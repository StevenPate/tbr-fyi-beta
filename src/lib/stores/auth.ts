// Client-side auth store
// Handles phone and email verification flows

import { writable } from 'svelte/store';
import { goto } from '$app/navigation';

interface AuthState {
	user: any | null;
	loading: boolean;
}

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>({
		user: null,
		loading: false
	});

	return {
		subscribe,
		initialize: async () => {
			// Check current session status
			try {
				const response = await fetch('/api/auth/session');
				const data = await response.json();
				if (data.authenticated && data.user) {
					update((state) => ({ ...state, user: data.user }));
				}
			} catch (error) {
				console.error('Failed to initialize auth:', error);
			}
		},
		signInWithEmail: async (email: string) => {
			update((state) => ({ ...state, loading: true }));
			try {
				const response = await fetch('/api/auth/send-magic-link', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email })
				});

				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.error || 'Failed to send magic link');
				}
			} finally {
				update((state) => ({ ...state, loading: false }));
			}
		},
		signUpWithEmail: async (email: string) => {
			// Same as sign in for magic links - reuse the implementation
			update((state) => ({ ...state, loading: true }));
			try {
				const response = await fetch('/api/auth/send-magic-link', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email })
				});

				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.error || 'Failed to send magic link');
				}
			} finally {
				update((state) => ({ ...state, loading: false }));
			}
		},
		signOut: async () => {
			update((state) => ({ ...state, loading: true }));
			try {
				await fetch('/api/auth/session', { method: 'DELETE' });
				set({ user: null, loading: false });
				goto('/');
			} catch (error) {
				console.error('Failed to sign out:', error);
				update((state) => ({ ...state, loading: false }));
			}
		},
		verifyPhone: async (phone: string, code: string) => {
			update((state) => ({ ...state, loading: true }));
			try {
				const response = await fetch('/api/auth/verify-phone', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ phone, code })
				});

				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.error || 'Verification failed');
				}

				const data = await response.json();
				update((state) => ({ ...state, user: data.user, loading: false }));
				return data;
			} catch (error) {
				update((state) => ({ ...state, loading: false }));
				throw error;
			}
		},
		sendPhoneVerification: async (phone: string) => {
			update((state) => ({ ...state, loading: true }));
			try {
				const response = await fetch('/api/auth/send-code', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ phone })
				});

				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.error || 'Failed to send verification code');
				}

				return await response.json();
			} finally {
				update((state) => ({ ...state, loading: false }));
			}
		},
		setUsername: async (username: string) => {
			update((state) => ({ ...state, loading: true }));
			try {
				const response = await fetch('/api/auth/username', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ username })
				});

				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.error || 'Failed to set username');
				}

				const data = await response.json();
				update((state) => ({ ...state, user: data.user, loading: false }));
				return data;
			} catch (error) {
				update((state) => ({ ...state, loading: false }));
				throw error;
			}
		}
	};
}

export const auth = createAuthStore();
