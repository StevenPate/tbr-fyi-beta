import type { LayoutLoad } from './$types';
import { supabase } from '$lib/supabase';
import { browser } from '$app/environment';

export const load: LayoutLoad = async ({ data, depends }) => {
	// Tell SvelteKit to reload this data whenever the session changes
	depends('supabase:auth');

	// Get session on the client side
	if (browser) {
		const { data: { session } } = await supabase.auth.getSession();

		return {
			...data,
			session,
			user: session?.user ?? null
		};
	}

	// Pass through server data
	return {
		...data
	};
};