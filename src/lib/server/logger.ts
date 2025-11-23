import pino from 'pino';
import { dev } from '$app/environment';

// Create base logger
export const logger = pino({
	level: dev ? 'debug' : 'info',
	formatters: {
		level: (label) => {
			return { level: label };
		}
	},
	...(dev
		? {
				transport: {
					target: 'pino-pretty',
					options: {
						colorize: true,
						translateTime: 'HH:MM:ss',
						ignore: 'pid,hostname'
					}
				}
			}
		: {})
});

// Typed logging contexts
export interface BookAdditionLog {
	event: 'book_addition';
	user_id: string;
	source: 'sms' | 'web';
	method: 'isbn' | 'search' | 'image' | 'amazon_link';
	isbn13?: string;
	title?: string;
	success: boolean;
	error?: string;
	duration_ms: number;
}

export interface UserEventLog {
	event: 'user_event';
	user_id: string;
	action: 'signup' | 'opt_out' | 'help' | 'unknown_command';
	source: 'sms' | 'web';
}

export interface APICallLog {
	event: 'api_call';
	service: 'google_books' | 'google_vision' | 'supabase';
	duration_ms: number;
	success: boolean;
	error?: string;
}

export interface ErrorLog {
	event: 'error';
	error_type: string;
	message: string;
	stack?: string;
	user_id?: string;
	context?: Record<string, unknown>;
}

// Convenience methods
export const logBookAddition = (data: BookAdditionLog) => {
	logger.info(data, `Book addition: ${data.success ? 'success' : 'failed'}`);
};

export const logUserEvent = (data: UserEventLog) => {
	logger.info(data, `User event: ${data.action}`);
};

export const logAPICall = (data: APICallLog) => {
	logger.info(data, `API call to ${data.service}`);
};

export const logError = (data: ErrorLog) => {
	logger.error(data, `Error: ${data.error_type}`);
};

// Performance timing helper
export const startTimer = () => {
	const start = Date.now();
	return () => Date.now() - start;
};
