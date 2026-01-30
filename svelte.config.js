import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter()
		// Note: CSRF protection is implemented manually in hooks.server.ts
		// This allows exempting specific routes (Twilio webhook) while protecting others
	}
};

export default config;
