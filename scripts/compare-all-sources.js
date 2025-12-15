// Script to compare cover image quality across Google Books, ISBNdb, and Open Library
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import https from 'https';
import http from 'http';
import fs from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ISBNDB_API_KEY = '48565_c9d95611e5493d3ce2ac9af517dcac2a';

const QUALITY_THRESHOLDS = {
	LOW: 300,
	MEDIUM: 600,
	HIGH: Infinity
};

async function compareAllSources() {
	if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
		console.error('\n❌ Error: Missing required environment variables');
		process.exit(1);
	}

	const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

	console.log('📚 Fetching books from database...\n');

	const { data: books, error } = await supabase
		.from('books')
		.select('id, isbn13, title, author, cover_url')
		.not('cover_url', 'is', null);

	if (error) {
		console.error('❌ Error fetching books:', error.message);
		process.exit(1);
	}

	console.log(`Found ${books.length} books with cover URLs\n`);

	const results = {
		total: books.length,
		google: { low: [], medium: [], high: [], errors: [] },
		isbndb: { low: [], medium: [], high: [], errors: [], notFound: [] },
		openlib: { low: [], medium: [], high: [], errors: [], notFound: [] }
	};

	// Analyze all three sources
	console.log('🔍 Analyzing all sources...\n');

	for (let i = 0; i < books.length; i++) {
		const book = books[i];
		const progress = `[${i + 1}/${books.length}]`;

		// Google Books (current)
		try {
			const dims = await getImageDimensions(book.cover_url);
			if (dims) {
				categorizeBook(results.google, book, dims, 'google');
				console.log(`${progress} Google: ${book.title.substring(0, 30)}... - ${dims.width}px`);
			} else {
				results.google.errors.push({ ...book, error: 'Could not fetch' });
				console.log(`${progress} Google: ${book.title.substring(0, 30)}... - Error`);
			}
		} catch (err) {
			results.google.errors.push({ ...book, error: err.message });
			console.log(`${progress} Google: ${book.title.substring(0, 30)}... - ${err.message}`);
		}

		// ISBNdb
		try {
			const isbndbData = await fetchISBNdb(book.isbn13);
			if (isbndbData?.image) {
				const dims = await getImageDimensions(isbndbData.image);
				if (dims) {
					categorizeBook(results.isbndb, book, dims, 'isbndb');
					console.log(`${progress} ISBNdb: ${book.title.substring(0, 30)}... - ${dims.width}px`);
				} else {
					results.isbndb.errors.push({ ...book, error: 'Could not fetch', url: isbndbData.image });
					console.log(`${progress} ISBNdb: ${book.title.substring(0, 30)}... - Error`);
				}
			} else {
				results.isbndb.notFound.push(book);
				console.log(`${progress} ISBNdb: ${book.title.substring(0, 30)}... - Not found`);
			}
		} catch (err) {
			results.isbndb.errors.push({ ...book, error: err.message });
			console.log(`${progress} ISBNdb: ${book.title.substring(0, 30)}... - ${err.message}`);
		}

		// Open Library
		const openlibUrl = `https://covers.openlibrary.org/b/isbn/${book.isbn13}-L.jpg`;
		try {
			const dims = await getImageDimensions(openlibUrl);
			if (dims && dims.width > 1) { // OL returns 1x1 blank for not found
				categorizeBook(results.openlib, book, dims, 'openlib');
				console.log(`${progress} OpenLib: ${book.title.substring(0, 30)}... - ${dims.width}px`);
			} else {
				results.openlib.notFound.push(book);
				console.log(`${progress} OpenLib: ${book.title.substring(0, 30)}... - Not found`);
			}
		} catch (err) {
			results.openlib.errors.push({ ...book, error: err.message });
			console.log(`${progress} OpenLib: ${book.title.substring(0, 30)}... - ${err.message}`);
		}

		await new Promise(resolve => setTimeout(resolve, 100));
	}

	// Find the best source for each book
	const bestChoices = analyzeBestChoices(books, results);

	// Generate report
	generateComprehensiveReport(results, bestChoices);

	console.log('\n✅ Report generated: scripts/all-sources-report.md\n');
}

function categorizeBook(result, book, dims, source) {
	const bookInfo = {
		...book,
		width: dims.width,
		height: dims.height,
		fileSize: dims.fileSize,
		url: source === 'google' ? book.cover_url : undefined
	};

	if (dims.width < QUALITY_THRESHOLDS.LOW) {
		result.low.push(bookInfo);
	} else if (dims.width < QUALITY_THRESHOLDS.MEDIUM) {
		result.medium.push(bookInfo);
	} else {
		result.high.push(bookInfo);
	}
}

function analyzeBestChoices(books, results) {
	const analysis = {
		googleBest: [],
		isbndbBest: [],
		openlibBest: [],
		multiWayTie: [],
		allFailed: []
	};

	for (const book of books) {
		const sources = {
			google: [...results.google.low, ...results.google.medium, ...results.google.high].find(b => b.isbn13 === book.isbn13),
			isbndb: [...results.isbndb.low, ...results.isbndb.medium, ...results.isbndb.high].find(b => b.isbn13 === book.isbn13),
			openlib: [...results.openlib.low, ...results.openlib.medium, ...results.openlib.high].find(b => b.isbn13 === book.isbn13)
		};

		const widths = {
			google: sources.google?.width || 0,
			isbndb: sources.isbndb?.width || 0,
			openlib: sources.openlib?.width || 0
		};

		const max = Math.max(widths.google, widths.isbndb, widths.openlib);

		if (max === 0) {
			analysis.allFailed.push(book);
		} else {
			const winners = Object.entries(widths).filter(([_, w]) => w === max).map(([k]) => k);

			if (winners.length > 1) {
				analysis.multiWayTie.push({ ...book, winners, width: max });
			} else if (winners[0] === 'google') {
				analysis.googleBest.push({ ...book, ...sources.google });
			} else if (winners[0] === 'isbndb') {
				analysis.isbndbBest.push({ ...book, ...sources.isbndb, googleWidth: widths.google });
			} else {
				analysis.openlibBest.push({ ...book, ...sources.openlib, googleWidth: widths.google });
			}
		}
	}

	return analysis;
}

function generateComprehensiveReport(results, bestChoices) {
	const lines = [];

	lines.push('# Complete Cover Source Comparison');
	lines.push('');
	lines.push(`**Generated:** ${new Date().toLocaleString()}`);
	lines.push('');
	lines.push('Comparing Google Books (current), ISBNdb, and Open Library cover quality.');
	lines.push('');
	lines.push('---');
	lines.push('');

	// Summary stats
	lines.push('## Summary Statistics');
	lines.push('');
	lines.push(`**Total books:** ${results.total}`);
	lines.push('');

	const sources = [
		{ name: 'Google Books', key: 'google' },
		{ name: 'ISBNdb', key: 'isbndb' },
		{ name: 'Open Library', key: 'openlib' }
	];

	for (const source of sources) {
		const r = results[source.key];
		const total = r.high.length + r.medium.length + r.low.length;
		lines.push(`### ${source.name}`);
		lines.push('');
		lines.push(`- 🟢 High quality (>600px): ${r.high.length} (${((r.high.length / results.total) * 100).toFixed(1)}%)`);
		lines.push(`- 🟡 Medium quality (300-600px): ${r.medium.length} (${((r.medium.length / results.total) * 100).toFixed(1)}%)`);
		lines.push(`- 🔴 Low quality (<300px): ${r.low.length} (${((r.low.length / results.total) * 100).toFixed(1)}%)`);
		if (r.notFound) {
			lines.push(`- ⚪ No image: ${r.notFound.length} (${((r.notFound.length / results.total) * 100).toFixed(1)}%)`);
		}
		lines.push(`- ❌ Errors: ${r.errors.length} (${((r.errors.length / results.total) * 100).toFixed(1)}%)`);
		lines.push(`- **Success rate:** ${((total / results.total) * 100).toFixed(1)}%`);
		lines.push('');
	}

	lines.push('---');
	lines.push('');

	// Best source analysis
	lines.push('## Best Source for Each Book');
	lines.push('');
	lines.push(`- ✅ **Google Books is best:** ${bestChoices.googleBest.length} books (${((bestChoices.googleBest.length / results.total) * 100).toFixed(1)}%)`);
	lines.push(`- ✅ **ISBNdb is best:** ${bestChoices.isbndbBest.length} books (${((bestChoices.isbndbBest.length / results.total) * 100).toFixed(1)}%)`);
	lines.push(`- ✅ **Open Library is best:** ${bestChoices.openlibBest.length} books (${((bestChoices.openlibBest.length / results.total) * 100).toFixed(1)}%)`);
	lines.push(`- 🟰 **Tie (multiple equally good):** ${bestChoices.multiWayTie.length} books`);
	lines.push(`- ❌ **All sources failed:** ${bestChoices.allFailed.length} books`);
	lines.push('');

	lines.push('---');
	lines.push('');

	// Recommendations
	lines.push('## Recommendations');
	lines.push('');

	const switchCount = bestChoices.isbndbBest.length + bestChoices.openlibBest.length;
	if (switchCount > 0) {
		lines.push(`### Consider Alternative Sources for ${switchCount} Books`);
		lines.push('');
		if (bestChoices.openlibBest.length > 0) {
			lines.push(`Open Library provides better covers for **${bestChoices.openlibBest.length} books**.`);
		}
		if (bestChoices.isbndbBest.length > 0) {
			lines.push(`ISBNdb provides better covers for **${bestChoices.isbndbBest.length} books**.`);
		}
		lines.push('');
		lines.push('**Note:** Open Library is already integrated as a fallback, so these may already be in use.');
		lines.push('');
	}

	const mediumCount = results.google.medium.length;
	if (mediumCount > switchCount) {
		lines.push('### User-Provided URLs Still Recommended');
		lines.push('');
		lines.push(`Even with all three sources, **${mediumCount - switchCount}** books remain at medium quality.`);
		lines.push('');
		lines.push('Implement custom URL replacement for users to provide high-quality images from Amazon, Goodreads, or publisher sites.');
		lines.push('');
	}

	// Detailed breakdowns
	lines.push('---');
	lines.push('');
	lines.push('## Detailed Results');
	lines.push('');

	if (bestChoices.openlibBest.length > 0) {
		lines.push('### Books Where Open Library Is Best');
		lines.push('');
		lines.push('| Title | Author | Google | Open Library | Improvement |');
		lines.push('|-------|--------|--------|--------------|-------------|');

		for (const book of bestChoices.openlibBest.slice(0, 50)) {
			const title = book.title.substring(0, 40).replace(/\|/g, '\\|');
			const author = (book.author?.[0] || 'Unknown').substring(0, 30).replace(/\|/g, '\\|');
			const googleSize = book.googleWidth ? `${book.googleWidth}px` : 'N/A';
			const olSize = `${book.width}px`;
			const improvement = book.googleWidth ? `+${book.width - book.googleWidth}px` : 'New';

			lines.push(`| ${title} | ${author} | ${googleSize} | ${olSize} | ${improvement} |`);
		}

		lines.push('');
	}

	if (bestChoices.isbndbBest.length > 0) {
		lines.push('### Books Where ISBNdb Is Best');
		lines.push('');
		lines.push('| Title | Author | Google | ISBNdb | Improvement |');
		lines.push('|-------|--------|--------|--------|-------------|');

		for (const book of bestChoices.isbndbBest.slice(0, 50)) {
			const title = book.title.substring(0, 40).replace(/\|/g, '\\|');
			const author = (book.author?.[0] || 'Unknown').substring(0, 30).replace(/\|/g, '\\|');
			const googleSize = book.googleWidth ? `${book.googleWidth}px` : 'N/A';
			const isbndbSize = `${book.width}px`;
			const improvement = book.googleWidth ? `+${book.width - book.googleWidth}px` : 'New';

			lines.push(`| ${title} | ${author} | ${googleSize} | ${isbndbSize} | ${improvement} |`);
		}

		lines.push('');
	}

	fs.writeFileSync('scripts/all-sources-report.md', lines.join('\n'));
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
			res.on('data', (chunk) => { data += chunk; });
			res.on('end', () => {
				if (res.statusCode === 200) {
					try {
						const json = JSON.parse(data);
						resolve(json.book || null);
					} catch {
						resolve(null);
					}
				} else {
					resolve(null);
				}
			});
		});

		req.on('error', () => resolve(null));
		req.setTimeout(10000, () => {
			req.destroy();
			resolve(null);
		});

		req.end();
	});
}

function getImageDimensions(url) {
	return new Promise((resolve, reject) => {
		const client = url.startsWith('https:') ? https : http;

		const request = client.get(url, (response) => {
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

				if (bytesRead >= 1024) {
					const buffer = Buffer.concat(chunks);
					const dimensions = extractDimensions(buffer);

					if (dimensions) {
						response.destroy();
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
	if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
		return extractJPEGDimensions(buffer);
	}

	if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
		return extractPNGDimensions(buffer);
	}

	return null;
}

function extractJPEGDimensions(buffer) {
	let offset = 2;

	while (offset < buffer.length) {
		if (buffer[offset] !== 0xFF) break;

		const marker = buffer[offset + 1];
		offset += 2;

		if ((marker >= 0xC0 && marker <= 0xCF) && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
			const height = buffer.readUInt16BE(offset + 3);
			const width = buffer.readUInt16BE(offset + 5);
			return { width, height };
		}

		const segmentLength = buffer.readUInt16BE(offset);
		offset += segmentLength;
	}

	return null;
}

function extractPNGDimensions(buffer) {
	if (buffer.length < 24) return null;

	const width = buffer.readUInt32BE(16);
	const height = buffer.readUInt32BE(20);
	return { width, height };
}

compareAllSources().catch(console.error);
