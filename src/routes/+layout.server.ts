import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	// Pass the user from server to client
	return {
		user: locals.user
	};
};