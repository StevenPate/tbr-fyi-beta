// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import type { User } from '$lib/server/auth';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			requestId?: string;
			user: User | null;
		}
		interface PageData {
			user?: User | null;
		}
		// interface PageState {}
		// interface Platform {}
	}

	// Umami analytics
	interface Window {
		umami?: {
			track: (event: string, data?: Record<string, string | number | boolean>) => void;
		};
	}
	const umami: Window['umami'];
}

export {};
