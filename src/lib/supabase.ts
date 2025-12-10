import { browser } from '$app/environment';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

let client: SupabaseClient | null = null;

function ensureClient(): SupabaseClient {
	if (!browser) {
		throw new Error('Supabase browser client is not available during server-side execution');
	}

	if (!client) {
		client = createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
	}

	return client;
}

export function getSupabaseClient(): SupabaseClient {
	return ensureClient();
}
