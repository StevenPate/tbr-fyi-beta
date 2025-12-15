import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ data }) => {
	// Pass through server data (user comes from hooks.server.ts)
	return {
		...data
	};
};
