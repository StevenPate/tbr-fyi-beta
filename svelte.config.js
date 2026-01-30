import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter(),
		// Disable SvelteKit's built-in CSRF - we implement it manually in hooks.server.ts
		// This allows exempting specific routes (Twilio webhook) while protecting others
		csrf: {
			checkOrigin: false
		}
	}
};

export default config;
