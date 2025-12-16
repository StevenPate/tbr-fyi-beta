import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter(),
		// Disable CSRF origin check to allow Twilio webhook POSTs
		// Security: SMS endpoint validates Twilio signature, other endpoints use JSON APIs
		csrf: {
			checkOrigin: false
		}
	}
};

export default config;
