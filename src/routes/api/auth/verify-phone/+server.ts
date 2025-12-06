import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';

export const POST: RequestHandler = async ({ request, locals }) => {
	const { phone, code } = await request.json();

	if (!phone || !code) {
		return json({ error: 'Phone number and code required' }, { status: 400 });
	}

	// Get authenticated user from locals
	const authUser = locals.user;

	if (!authUser) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	// Verify the code
	const { data: verification, error: verifyError } = await supabase
		.from('phone_verification_codes')
		.select('*')
		.eq('phone_number', phone)
		.eq('code', code)
		.eq('auth_id', authUser.id)
		.eq('is_used', false)
		.gt('expires_at', new Date().toISOString())
		.single();

	if (verifyError || !verification) {
		// Increment attempts on failure
		await supabase
			.from('phone_verification_codes')
			.update({ attempts: verification?.attempts ? verification.attempts + 1 : 1 })
			.eq('phone_number', phone)
			.eq('auth_id', authUser.id)
			.eq('is_used', false);

		return json({ error: 'Invalid or expired code' }, { status: 400 });
	}

	// Mark code as used
	await supabase
		.from('phone_verification_codes')
		.update({ is_used: true, used_at: new Date().toISOString() })
		.eq('id', verification.id);

	// Link the phone number to the auth user
	// First check if phone number already has an account
	const { data: existingUser } = await supabase
		.from('users')
		.select('*')
		.eq('phone_number', phone)
		.single();

	if (existingUser) {
		// Update existing phone user with auth account
		const { error: updateError } = await supabase
			.from('users')
			.update({
				auth_id: authUser.id,
				email: authUser.email,
				account_created_at: new Date().toISOString()
			})
			.eq('phone_number', phone);

		if (updateError) {
			return json({ error: 'Failed to link account' }, { status: 500 });
		}

		// Transfer any temporary user data to the phone account
		await supabase
			.from('users')
			.delete()
			.eq('phone_number', `auth_${authUser.id}`);

		return json({
			success: true,
			message: 'Phone verified and account linked',
			existingData: true
		});
	} else {
		// Update the auth user's temporary record with real phone number
		const { error: updateError } = await supabase
			.from('users')
			.update({
				phone_number: phone
			})
			.eq('auth_id', authUser.id);

		if (updateError) {
			return json({ error: 'Failed to update account' }, { status: 500 });
		}

		return json({
			success: true,
			message: 'Phone verified',
			existingData: false
		});
	}
};