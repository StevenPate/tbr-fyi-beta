// Script to analyze book cover image quality
// Fetches all book covers and checks their actual dimensions
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import https from 'https';
import http from 'http';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Quality thresholds (based on width)
const QUALITY_THRESHOLDS = {
	LOW: 300,
	MEDIUM: 600,
	HIGH: Infinity
};

async function analyzeCovers() {
	// Validate environment variables
	if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
		console.error('\n❌ Error: Missing required environment variables');
		console.error('Please ensure the following are set in your .env file:');
		console.error('  - SUPABASE_URL');
		console.error('  - SUPABASE_SERVICE_KEY');
		console.error('\nSee .env.example for reference.\n');
		process.exit(1);
	}

	// Initialize Supabase client
	const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

	console.log('📚 Fetching books from database...\n');

	// Fetch all books with cover URLs
	const { data: books, error } = await supabase
		.from('books')
		.select('id, isbn13, title, author, cover_url')
		.not('cover_url', 'is', null);

	if (error) {
		console.error('❌ Error fetching books:', error.message);
		process.exit(1);
	}

	if (!books || books.length === 0) {
		console.log('No books with covers found.');
		return;
	}

	console.log(`Found ${books.length} books with cover URLs\n`);
	console.log('🔍 Analyzing image quality (this may take a while)...\n');

	const results = {
		total: books.length,
		low: [],
		medium: [],
		high: [],
		errors: []
	};

	// Analyze each cover
	for (let i = 0; i < books.length; i++) {
		const book = books[i];
		const progress = `[${i + 1}/${books.length}]`;

		try {
			const dimensions = await getImageDimensions(book.cover_url);

			if (!dimensions) {
				results.errors.push({
					...book,
					error: 'Could not fetch dimensions'
				});
				console.log(`${progress} ⚠️  ${book.title.substring(0, 40)}... - Error fetching dimensions`);
				continue;
			}

			const width = dimensions.width;
			const bookInfo = {
				...book,
				width: dimensions.width,
				height: dimensions.height,
				fileSize: dimensions.fileSize
			};

			if (width < QUALITY_THRESHOLDS.LOW) {
				results.low.push(bookInfo);
				console.log(`${progress} 🔴 ${book.title.substring(0, 40)}... - ${width}x${dimensions.height}px (LOW)`);
			} else if (width < QUALITY_THRESHOLDS.MEDIUM) {
				results.medium.push(bookInfo);
				console.log(`${progress} 🟡 ${book.title.substring(0, 40)}... - ${width}x${dimensions.height}px (MEDIUM)`);
			} else {
				results.high.push(bookInfo);
				console.log(`${progress} 🟢 ${book.title.substring(0, 40)}... - ${width}x${dimensions.height}px (HIGH)`);
			}
		} catch (err) {
			results.errors.push({
				...book,
				error: err.message
			});
			console.log(`${progress} ❌ ${book.title.substring(0, 40)}... - Error: ${err.message}`);
		}

		// Small delay to avoid overwhelming servers
		await new Promise(resolve => setTimeout(resolve, 100));
	}

	// Print summary
	console.log('\n' + '='.repeat(80));
	console.log('📊 SUMMARY\n');
	console.log(`Total books analyzed: ${results.total}`);
	console.log(`\n🔴 Low quality (<${QUALITY_THRESHOLDS.LOW}px): ${results.low.length} (${((results.low.length / results.total) * 100).toFixed(1)}%)`);
	console.log(`🟡 Medium quality (${QUALITY_THRESHOLDS.LOW}-${QUALITY_THRESHOLDS.MEDIUM}px): ${results.medium.length} (${((results.medium.length / results.total) * 100).toFixed(1)}%)`);
	console.log(`🟢 High quality (>${QUALITY_THRESHOLDS.MEDIUM}px): ${results.high.length} (${((results.high.length / results.total) * 100).toFixed(1)}%)`);
	console.log(`❌ Errors: ${results.errors.length} (${((results.errors.length / results.total) * 100).toFixed(1)}%)`);

	// Show worst offenders
	if (results.low.length > 0) {
		console.log('\n🔴 LOWEST QUALITY COVERS (top 10):');
		const sorted = results.low.sort((a, b) => a.width - b.width).slice(0, 10);
		sorted.forEach((book, i) => {
			console.log(`  ${i + 1}. ${book.title.substring(0, 50)} - ${book.width}x${book.height}px (${(book.fileSize / 1024).toFixed(1)}KB)`);
			console.log(`     ISBN: ${book.isbn13}`);
			console.log(`     URL: ${book.cover_url.substring(0, 80)}...`);
		});
	}

	console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Fetch image and get dimensions without loading entire image into memory
 */
function getImageDimensions(url) {
	return new Promise((resolve, reject) => {
		const client = url.startsWith('https:') ? https : http;

		const request = client.get(url, (response) => {
			// Handle redirects
			if (response.statusCode === 301 || response.statusCode === 302) {
				if (response.headers.location) {
					getImageDimensions(response.headers.location)
						.then(resolve)
						.catch(reject);
					return;
				}
			}

			if (response.statusCode !== 200) {
				reject(new Error(`HTTP ${response.statusCode}`));
				return;
			}

			const fileSize = parseInt(response.headers['content-length'] || '0', 10);
			const chunks = [];
			let bytesRead = 0;

			response.on('data', (chunk) => {
				chunks.push(chunk);
				bytesRead += chunk.length;

				// Try to parse dimensions from partial data
				// For JPEG/PNG, dimensions are in the header (first ~1KB)
				if (bytesRead >= 1024) {
					const buffer = Buffer.concat(chunks);
					const dimensions = extractDimensions(buffer);

					if (dimensions) {
						response.destroy(); // Stop downloading
						resolve({ ...dimensions, fileSize });
					}
				}
			});

			response.on('end', () => {
				const buffer = Buffer.concat(chunks);
				const dimensions = extractDimensions(buffer);

				if (dimensions) {
					resolve({ ...dimensions, fileSize });
				} else {
					reject(new Error('Could not extract dimensions'));
				}
			});

			response.on('error', reject);
		});

		request.on('error', reject);
		request.setTimeout(10000, () => {
			request.destroy();
			reject(new Error('Timeout'));
		});
	});
}

/**
 * Extract width/height from image buffer (JPEG and PNG only)
 */
function extractDimensions(buffer) {
	// JPEG
	if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
		return extractJPEGDimensions(buffer);
	}

	// PNG
	if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
		return extractPNGDimensions(buffer);
	}

	return null;
}

function extractJPEGDimensions(buffer) {
	let offset = 2; // Skip SOI marker

	while (offset < buffer.length) {
		// Check for marker
		if (buffer[offset] !== 0xFF) {
			break;
		}

		const marker = buffer[offset + 1];
		offset += 2;

		// SOF0-SOF15 markers contain dimensions
		if ((marker >= 0xC0 && marker <= 0xCF) && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
			const height = buffer.readUInt16BE(offset + 3);
			const width = buffer.readUInt16BE(offset + 5);
			return { width, height };
		}

		// Skip segment
		const segmentLength = buffer.readUInt16BE(offset);
		offset += segmentLength;
	}

	return null;
}

function extractPNGDimensions(buffer) {
	// PNG dimensions are at bytes 16-23 (after signature and IHDR chunk type)
	if (buffer.length < 24) {
		return null;
	}

	const width = buffer.readUInt32BE(16);
	const height = buffer.readUInt32BE(20);
	return { width, height };
}

analyzeCovers().catch(console.error);
