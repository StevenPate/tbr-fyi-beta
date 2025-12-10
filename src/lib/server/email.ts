/**
 * Email Service using Resend
 * Sends verification emails for magic link authentication
 */

import { Resend } from 'resend';
import { dev } from '$app/environment';
import { logger } from '$lib/server/logger';
import { env } from '$env/dynamic/private';

// Initialize Resend client (safe even if API key not set)
const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
	if (!resend) {
		// Fallback: log to console if Resend not configured
		logger.info(
			{
				to,
				subject,
				body_preview: body.substring(0, 100)
			},
			'📧 Email would be sent (Resend not configured)'
		);
		console.log('\n========== EMAIL ==========');
		console.log(`To: ${to}`);
		console.log(`Subject: ${subject}`);
		console.log(`Body:\n${body}`);
		console.log('===========================\n');
		return;
	}

	try {
		await resend.emails.send({
			from: dev ? 'TBR.fyi <onboarding@resend.dev>' : 'TBR.fyi <noreply@tbr.fyi>',
			to,
			subject,
			html: body
		});

		logger.info({ to, subject }, '📧 Email sent successfully');
	} catch (error) {
		logger.error(
			{
				to,
				subject,
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			'Failed to send email'
		);
		throw new Error('Failed to send email');
	}
}

export function generateMagicLinkEmail(link: string): string {
	return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
	<div style="background-color: #f7f7f7; padding: 30px; border-radius: 10px;">
		<h1 style="color: #2563eb; margin-top: 0;">Verify Your Email</h1>
		<p style="font-size: 16px;">Click the button below to verify your email and access your TBR shelf:</p>
		<div style="text-align: center; margin: 30px 0;">
			<a href="${link}" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">Verify Email</a>
		</div>
		<p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
		<p style="font-size: 14px; color: #2563eb; word-break: break-all;">${link}</p>
		<p style="font-size: 12px; color: #999; margin-top: 30px;">This link will expire in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
	</div>
</body>
</html>
	`.trim();
}
