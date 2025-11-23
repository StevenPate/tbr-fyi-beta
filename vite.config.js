import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		// Allow external connections (ngrok)
		host: '0.0.0.0',
		strictPort: false,
		hmr: {
			clientPort: 5173
		}
	},
	preview: {
		host: '0.0.0.0',
		strictPort: false
	}
});
