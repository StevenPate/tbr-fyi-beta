// Script to compare cover image quality between Google Books and ISBNdb
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import https from 'https';
import http from 'http';
import fs from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ISBNDB_API_KEY = '48565_c9d95611e5493d3ce2ac9af517dcac2a';

// Quality thresholds (based on width)
const QUALITY_THRESHOLDS = {
	LOW: 300,
	MEDIUM: 600,
	HIGH: Infinity
};

async function compareCovers() {
	// Validate environment variables
	if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
		console.error('\n❌ Error: Missing required environment variables');
		console.error('Please ensure the following are set in your .env file:');
		console.error('  - SUPABASE_URL');
		console.error('  - SUPABASE_SERVICE_KEY');
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

	const results = {
		total: books.length,
		googleBooks: {
			low: [],
			medium: [],
			high: [],
			errors: []
		},
		isbndb: {
			low: [],
			medium: [],
			high: [],
			errors: [],
			notFound: []
		},
		comparison: {
			isbndbBetter: [],
			googleBetter: [],
			similar: [],
			bothFailed: []
		}
	};

	console.log('🔍 Analyzing Google Books covers...\n');

	// Analyze Google Books covers (current state)
	for (let i = 0; i < books.length; i++) {
		const book = books[i];
		const progress = `[${i + 1}/${books.length}]`;

		try {
			const dimensions = await getImageDimensions(book.cover_url);

			if (!dimensions) {
				results.googleBooks.errors.push({
					...book,
					error: 'Could not fetch dimensions'
				});
				console.log(`${progress} ⚠️  Google: ${book.title.substring(0, 40)}... - Error`);
				continue;
			}

			const width = dimensions.width;
			const bookInfo = {
				...book,
				width: dimensions.width,
				height: dimensions.height,
				fileSize: dimensions.fileSize,
				url: book.cover_url
			};

			if (width < QUALITY_THRESHOLDS.LOW) {
				results.googleBooks.low.push(bookInfo);
				console.log(`${progress} 🔴 Google: ${book.title.substring(0, 40)}... - ${width}px`);
			} else if (width < QUALITY_THRESHOLDS.MEDIUM) {
				results.googleBooks.medium.push(bookInfo);
				console.log(`${progress} 🟡 Google: ${book.title.substring(0, 40)}... - ${width}px`);
			} else {
				results.googleBooks.high.push(bookInfo);
				console.log(`${progress} 🟢 Google: ${book.title.substring(0, 40)}... - ${width}px`);
			}
		} catch (err) {
			results.googleBooks.errors.push({
				...book,
				error: err.message
			});
			console.log(`${progress} ❌ Google: ${book.title.substring(0, 40)}... - ${err.message}`);
		}

		// Small delay to avoid overwhelming servers
		await new Promise(resolve => setTimeout(resolve, 100));
	}

	console.log('\n🔍 Fetching ISBNdb covers...\n');

	// Analyze ISBNdb covers
	for (let i = 0; i < books.length; i++) {
		const book = books[i];
		const progress = `[${i + 1}/${books.length}]`;

		try {
			// Fetch from ISBNdb API
			const isbndbData = await fetchISBNdb(book.isbn13);

			if (!isbndbData || !isbndbData.image) {
				results.isbndb.notFound.push({
					...book,
					reason: isbndbData ? 'No image URL' : 'Book not found'
				});
				console.log(`${progress} ⚪ ISBNdb: ${book.title.substring(0, 40)}... - Not found`);
				continue;
			}

			// Check dimensions of ISBNdb image
			const dimensions = await getImageDimensions(isbndbData.image);

			if (!dimensions) {
				results.isbndb.errors.push({
					...book,
					error: 'Could not fetch dimensions',
					url: isbndbData.image
				});
				console.log(`${progress} ⚠️  ISBNdb: ${book.title.substring(0, 40)}... - Error`);
				continue;
			}

			const width = dimensions.width;
			const bookInfo = {
				...book,
				width: dimensions.width,
				height: dimensions.height,
				fileSize: dimensions.fileSize,
				url: isbndbData.image
			};

			if (width < QUALITY_THRESHOLDS.LOW) {
				results.isbndb.low.push(bookInfo);
				console.log(`${progress} 🔴 ISBNdb: ${book.title.substring(0, 40)}... - ${width}px`);
			} else if (width < QUALITY_THRESHOLDS.MEDIUM) {
				results.isbndb.medium.push(bookInfo);
				console.log(`${progress} 🟡 ISBNdb: ${book.title.substring(0, 40)}... - ${width}px`);
			} else {
				results.isbndb.high.push(bookInfo);
				console.log(`${progress} 🟢 ISBNdb: ${book.title.substring(0, 40)}... - ${width}px`);
			}
		} catch (err) {
			results.isbndb.errors.push({
				...book,
				error: err.message
			});
			console.log(`${progress} ❌ ISBNdb: ${book.title.substring(0, 40)}... - ${err.message}`);
		}

		// Delay to respect rate limits
		await new Promise(resolve => setTimeout(resolve, 150));
	}

	console.log('\n📊 Comparing results...\n');

	// Compare results
	const googleMap = new Map();
	[...results.googleBooks.low, ...results.googleBooks.medium, ...results.googleBooks.high].forEach(b => {
		googleMap.set(b.isbn13, b);
	});

	const isbndbMap = new Map();
	[...results.isbndb.low, ...results.isbndb.medium, ...results.isbndb.high].forEach(b => {
		isbndbMap.set(b.isbn13, b);
	});

	for (const book of books) {
		const googleBook = googleMap.get(book.isbn13);
		const isbndbBook = isbndbMap.get(book.isbn13);

		if (!googleBook && !isbndbBook) {
			results.comparison.bothFailed.push(book);
		} else if (googleBook && !isbndbBook) {
			results.comparison.googleBetter.push({
				...book,
				googleWidth: googleBook.width,
				reason: 'ISBNdb has no image'
			});
		} else if (!googleBook && isbndbBook) {
			results.comparison.isbndbBetter.push({
				...book,
				isbndbWidth: isbndbBook.width,
				reason: 'Google Books failed'
			});
		} else {
			// Both have images
			const googleWidth = googleBook.width;
			const isbndbWidth = isbndbBook.width;
			const diff = Math.abs(googleWidth - isbndbWidth);

			if (diff < 50) {
				// Similar quality
				results.comparison.similar.push({
					...book,
					googleWidth,
					isbndbWidth,
					googleUrl: googleBook.url,
					isbndbUrl: isbndbBook.url
				});
			} else if (isbndbWidth > googleWidth) {
				results.comparison.isbndbBetter.push({
					...book,
					googleWidth,
					isbndbWidth,
					improvement: isbndbWidth - googleWidth,
					googleUrl: googleBook.url,
					isbndbUrl: isbndbBook.url
				});
			} else {
				results.comparison.googleBetter.push({
					...book,
					googleWidth,
					isbndbWidth,
					googleUrl: googleBook.url,
					isbndbUrl: isbndbBook.url
				});
			}
		}
	}

	// Generate markdown report
	generateReport(results);

	console.log('\n✅ Report generated: scripts/cover-quality-report.md\n');
}

function generateReport(results) {
	const lines = [];

	lines.push('# Cover Image Quality Comparison Report');
	lines.push('');
	lines.push(`**Generated:** ${new Date().toLocaleString()}`);
	lines.push('');
	lines.push('---');
	lines.push('');

	// Executive Summary
	lines.push('## Executive Summary');
	lines.push('');
	lines.push(`- **Total books analyzed:** ${results.total}`);
	lines.push('');

	lines.push('### Google Books Results');
	lines.push('');
	lines.push(`- 🟢 High quality (>600px): ${results.googleBooks.high.length} (${((results.googleBooks.high.length / results.total) * 100).toFixed(1)}%)`);
	lines.push(`- 🟡 Medium quality (300-600px): ${results.googleBooks.medium.length} (${((results.googleBooks.medium.length / results.total) * 100).toFixed(1)}%)`);
	lines.push(`- 🔴 Low quality (<300px): ${results.googleBooks.low.length} (${((results.googleBooks.low.length / results.total) * 100).toFixed(1)}%)`);
	lines.push(`- ❌ Errors: ${results.googleBooks.errors.length} (${((results.googleBooks.errors.length / results.total) * 100).toFixed(1)}%)`);
	lines.push('');

	lines.push('### ISBNdb Results');
	lines.push('');
	lines.push(`- 🟢 High quality (>600px): ${results.isbndb.high.length} (${((results.isbndb.high.length / results.total) * 100).toFixed(1)}%)`);
	lines.push(`- 🟡 Medium quality (300-600px): ${results.isbndb.medium.length} (${((results.isbndb.medium.length / results.total) * 100).toFixed(1)}%)`);
	lines.push(`- 🔴 Low quality (<300px): ${results.isbndb.low.length} (${((results.isbndb.low.length / results.total) * 100).toFixed(1)}%)`);
	lines.push(`- ⚪ No image available: ${results.isbndb.notFound.length} (${((results.isbndb.notFound.length / results.total) * 100).toFixed(1)}%)`);
	lines.push(`- ❌ Errors: ${results.isbndb.errors.length} (${((results.isbndb.errors.length / results.total) * 100).toFixed(1)}%)`);
	lines.push('');

	lines.push('### Comparison');
	lines.push('');
	lines.push(`- ✅ **ISBNdb has better quality:** ${results.comparison.isbndbBetter.length} books`);
	lines.push(`- ✅ **Google Books has better quality:** ${results.comparison.googleBetter.length} books`);
	lines.push(`- 🟰 **Similar quality:** ${results.comparison.similar.length} books`);
	lines.push(`- ❌ **Both failed:** ${results.comparison.bothFailed.length} books`);
	lines.push('');

	// Recommendations
	lines.push('---');
	lines.push('');
	lines.push('## Recommendations');
	lines.push('');

	const isbndbBetterCount = results.comparison.isbndbBetter.length;
	const googleMediumCount = results.googleBooks.medium.length;

	if (isbndbBetterCount > 0) {
		lines.push(`### Switch to ISBNdb for ${isbndbBetterCount} Books`);
		lines.push('');
		lines.push(`ISBNdb provides better quality images for **${isbndbBetterCount} books** (${((isbndbBetterCount / results.total) * 100).toFixed(1)}% of collection).`);
		lines.push('');
		lines.push('**Impact:** Upgrading these would improve overall collection quality.');
		lines.push('');
	}

	if (googleMediumCount > isbndbBetterCount) {
		lines.push('### User-Provided URLs May Still Be Needed');
		lines.push('');
		lines.push(`Even with ISBNdb fallback, **${googleMediumCount - isbndbBetterCount} books** would remain at medium quality.`);
		lines.push('');
		lines.push('**Recommendation:** Implement custom URL replacement feature to let users provide better images from Amazon, Goodreads, or publisher sites.');
		lines.push('');
	}

	// Detailed Results
	lines.push('---');
	lines.push('');
	lines.push('## Detailed Results');
	lines.push('');

	// Books where ISBNdb is better
	if (results.comparison.isbndbBetter.length > 0) {
		lines.push('### Books Where ISBNdb Provides Better Quality');
		lines.push('');
		lines.push('| Title | Author | Google Books | ISBNdb | Improvement |');
		lines.push('|-------|--------|--------------|--------|-------------|');

		const sorted = results.comparison.isbndbBetter
			.sort((a, b) => (b.improvement || 0) - (a.improvement || 0))
			.slice(0, 50); // Top 50

		for (const book of sorted) {
			const title = book.title.substring(0, 40).replace(/\|/g, '\\|');
			const author = (book.author?.[0] || 'Unknown').substring(0, 30).replace(/\|/g, '\\|');
			const googleSize = book.googleWidth ? `${book.googleWidth}px` : 'N/A';
			const isbndbSize = book.isbndbWidth ? `${book.isbndbWidth}px` : 'N/A';
			const improvement = book.improvement ? `+${book.improvement}px` : book.reason || '';

			lines.push(`| ${title} | ${author} | ${googleSize} | ${isbndbSize} | ${improvement} |`);
		}

		lines.push('');
	}

	// Books where Google is better
	if (results.comparison.googleBetter.length > 0) {
		lines.push('### Books Where Google Books Provides Better Quality');
		lines.push('');
		lines.push(`**Count:** ${results.comparison.googleBetter.length} books`);
		lines.push('');
		lines.push('*(Keeping current Google Books source is optimal for these titles)*');
		lines.push('');
	}

	// Google Books medium quality breakdown
	if (results.googleBooks.medium.length > 0) {
		lines.push('### Google Books Medium Quality Images (300-600px)');
		lines.push('');
		lines.push(`**Count:** ${results.googleBooks.medium.length} books`);
		lines.push('');

		// Show first 20
		lines.push('<details>');
		lines.push('<summary>View all medium quality books</summary>');
		lines.push('');
		lines.push('| Title | Author | Dimensions |');
		lines.push('|-------|--------|------------|');

		for (const book of results.googleBooks.medium) {
			const title = book.title.substring(0, 50).replace(/\|/g, '\\|');
			const author = (book.author?.[0] || 'Unknown').substring(0, 30).replace(/\|/g, '\\|');
			const dims = `${book.width}x${book.height}px`;

			lines.push(`| ${title} | ${author} | ${dims} |`);
		}

		lines.push('');
		lines.push('</details>');
		lines.push('');
	}

	// Write to file
	const reportPath = 'scripts/cover-quality-report.md';
	fs.writeFileSync(reportPath, lines.join('\n'));
}

async function fetchISBNdb(isbn13) {
	return new Promise((resolve, reject) => {
		const options = {
			hostname: 'api2.isbndb.com',
			port: 443,
			path: `/book/${isbn13}`,
			method: 'GET',
			headers: {
				'Authorization': ISBNDB_API_KEY,
				'Content-Type': 'application/json'
			}
		};

		const req = https.request(options, (res) => {
			let data = '';

			res.on('data', (chunk) => {
				data += chunk;
			});

			res.on('end', () => {
				if (res.statusCode === 200) {
					try {
						const json = JSON.parse(data);
						resolve(json.book || null);
					} catch (err) {
						resolve(null);
					}
				} else if (res.statusCode === 404) {
					resolve(null);
				} else {
					reject(new Error(`ISBNdb API returned ${res.statusCode}`));
				}
			});
		});

		req.on('error', reject);
		req.setTimeout(10000, () => {
			req.destroy();
			reject(new Error('Timeout'));
		});

		req.end();
	});
}

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
	if (buffer.length < 24) {
		return null;
	}

	const width = buffer.readUInt32BE(16);
	const height = buffer.readUInt32BE(20);
	return { width, height };
}

compareCovers().catch(console.error);
