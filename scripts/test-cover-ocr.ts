#!/usr/bin/env npx ts-node

/**
 * Cover Photo OCR Prototype Tester
 *
 * Tests Vision API documentTextDetection on cover photos to evaluate
 * feasibility of cover-based book recognition.
 *
 * Usage:
 *   npx ts-node scripts/test-cover-ocr.ts <image-path-or-directory>
 *
 * Examples:
 *   npx ts-node scripts/test-cover-ocr.ts ./test-covers/
 *   npx ts-node scripts/test-cover-ocr.ts ./test-covers/hobbit.jpg
 *
 * Output:
 *   - Per-image analysis with extracted text blocks
 *   - Summary statistics for go/no-go decision
 *   - Results saved to ./cover-ocr-results.json
 *
 * Requirements:
 *   - GOOGLE_APPLICATION_CREDENTIALS env var set
 *   - @google-cloud/vision installed
 */

import * as fs from 'fs';
import * as path from 'path';
import vision from '@google-cloud/vision';

interface TextBlock {
  text: string;
  relativeHeight: number;
  relativeY: number;
  confidence: number;
}

interface ParsedCover {
  likelyTitle: string;
  likelyAuthor: string | null;
  confidence: 'high' | 'medium' | 'low';
}

interface ImageResult {
  file: string;
  success: boolean;
  rawText: string;
  blocks: TextBlock[];
  parsed: ParsedCover | null;
  error?: string;
  processingTimeMs: number;
}

interface Summary {
  totalImages: number;
  successful: number;
  failed: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  successRate: string;
  highConfidenceRate: string;
  recommendation: string;
}

// Noise patterns to filter from cover text
const NOISE_PATTERNS = [
  /^(a\s+)?novel$/i,
  /new\s*york\s*times\s*(#\d+\s*)?bestseller/i,
  /international\s*bestseller/i,
  /winner\s+of\s+the\s+.+\s+award/i,
  /^the\s+author\s+of$/i,
  /^from\s+the\s+author/i,
  /book\s+\d+\s+(of|in)\s+the/i,
  /^\d+\s*million\s*copies/i,
  /now\s+a\s+(major\s+)?(motion\s+picture|movie|film|tv|series)/i,
];

function cleanText(text: string): string {
  let cleaned = text
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const pattern of NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, '').trim();
  }

  return cleaned;
}

function parseCoverText(rawText: string, blocks: TextBlock[]): ParsedCover {
  // Strategy 1: Look for "by" delimiter
  const byMatch = rawText.match(/(.+?)\s+by\s+(.+)/i);
  if (byMatch) {
    return {
      likelyTitle: cleanText(byMatch[1]),
      likelyAuthor: cleanText(byMatch[2]),
      confidence: 'high'
    };
  }

  // Strategy 2: Tallest block = title, bottom block = author
  const sortedByHeight = [...blocks].sort((a, b) => b.relativeHeight - a.relativeHeight);
  const bottomBlocks = blocks.filter(b => b.relativeY > 0.6);
  const possibleAuthor = bottomBlocks.length > 0
    ? bottomBlocks.sort((a, b) => b.relativeHeight - a.relativeHeight)[0]
    : null;

  if (sortedByHeight.length >= 1) {
    const title = cleanText(sortedByHeight[0].text);
    const author = possibleAuthor ? cleanText(possibleAuthor.text) : null;

    return {
      likelyTitle: title,
      likelyAuthor: author,
      confidence: author ? 'medium' : 'low'
    };
  }

  return {
    likelyTitle: cleanText(rawText.slice(0, 100)),
    likelyAuthor: null,
    confidence: 'low'
  };
}

async function analyzeImage(client: vision.ImageAnnotatorClient, imagePath: string): Promise<ImageResult> {
  const startTime = Date.now();
  const fileName = path.basename(imagePath);

  try {
    const imageBuffer = fs.readFileSync(imagePath);

    // Skip tiny images
    if (imageBuffer.length < 10 * 1024) {
      return {
        file: fileName,
        success: false,
        rawText: '',
        blocks: [],
        parsed: null,
        error: 'Image too small (<10KB)',
        processingTimeMs: Date.now() - startTime
      };
    }

    const [result] = await client.documentTextDetection({
      image: { content: imageBuffer.toString('base64') }
    });

    const fullText = result.fullTextAnnotation;
    if (!fullText?.pages?.[0]) {
      return {
        file: fileName,
        success: false,
        rawText: '',
        blocks: [],
        parsed: null,
        error: 'No text detected',
        processingTimeMs: Date.now() - startTime
      };
    }

    const page = fullText.pages[0];
    const imageHeight = page.height || 1;

    const blocks: TextBlock[] = (page.blocks || [])
      .filter(block => block.blockType === 'TEXT')
      .map(block => {
        const vertices = block.boundingBox?.vertices || [];
        const ys = vertices.map(v => v.y || 0);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const blockHeight = maxY - minY;

        const text = (block.paragraphs || [])
          .flatMap(p => (p.words || []))
          .map(w => (w.symbols || []).map(s => s.text || '').join(''))
          .join(' ');

        return {
          text,
          relativeHeight: blockHeight / imageHeight,
          relativeY: minY / imageHeight,
          confidence: block.confidence || 0
        };
      })
      .filter(b => b.text.length > 2);

    const rawText = fullText.text || '';
    const parsed = parseCoverText(rawText, blocks);

    return {
      file: fileName,
      success: true,
      rawText: rawText.slice(0, 500),
      blocks,
      parsed,
      processingTimeMs: Date.now() - startTime
    };

  } catch (error) {
    return {
      file: fileName,
      success: false,
      rawText: '',
      blocks: [],
      parsed: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTimeMs: Date.now() - startTime
    };
  }
}

function printResult(result: ImageResult): void {
  console.log('\n' + '='.repeat(60));
  console.log(`File: ${result.file}`);
  console.log(`Status: ${result.success ? '✓ Success' : '✗ Failed'}`);
  console.log(`Time: ${result.processingTimeMs}ms`);

  if (result.error) {
    console.log(`Error: ${result.error}`);
    return;
  }

  if (result.parsed) {
    console.log(`\nParsed Result (${result.parsed.confidence} confidence):`);
    console.log(`  Title:  "${result.parsed.likelyTitle}"`);
    console.log(`  Author: ${result.parsed.likelyAuthor ? `"${result.parsed.likelyAuthor}"` : '(not detected)'}`);
  }

  console.log(`\nText Blocks (${result.blocks.length}):`);
  result.blocks.slice(0, 5).forEach((block, i) => {
    console.log(`  ${i + 1}. [h=${(block.relativeHeight * 100).toFixed(1)}%, y=${(block.relativeY * 100).toFixed(1)}%] "${block.text.slice(0, 50)}${block.text.length > 50 ? '...' : ''}"`);
  });
  if (result.blocks.length > 5) {
    console.log(`  ... and ${result.blocks.length - 5} more blocks`);
  }
}

function printSummary(results: ImageResult[]): Summary {
  const successful = results.filter(r => r.success);
  const highConf = successful.filter(r => r.parsed?.confidence === 'high');
  const medConf = successful.filter(r => r.parsed?.confidence === 'medium');
  const lowConf = successful.filter(r => r.parsed?.confidence === 'low');

  const successRate = ((successful.length / results.length) * 100).toFixed(1);
  const highConfRate = ((highConf.length / results.length) * 100).toFixed(1);

  let recommendation: string;
  if (parseFloat(successRate) < 40) {
    recommendation = '❌ DEFER - Success rate too low for viable feature';
  } else if (parseFloat(highConfRate) < 20) {
    recommendation = '⚠️  CAUTION - Low high-confidence rate, expect heavy user confirmation flow';
  } else {
    recommendation = '✅ PROCEED - Rates acceptable for MVP with confirmation UX';
  }

  const summary: Summary = {
    totalImages: results.length,
    successful: successful.length,
    failed: results.length - successful.length,
    highConfidence: highConf.length,
    mediumConfidence: medConf.length,
    lowConfidence: lowConf.length,
    successRate: `${successRate}%`,
    highConfidenceRate: `${highConfRate}%`,
    recommendation
  };

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total images:      ${summary.totalImages}`);
  console.log(`Successful:        ${summary.successful} (${summary.successRate})`);
  console.log(`Failed:            ${summary.failed}`);
  console.log(`High confidence:   ${summary.highConfidence} (${summary.highConfidenceRate})`);
  console.log(`Medium confidence: ${summary.mediumConfidence}`);
  console.log(`Low confidence:    ${summary.lowConfidence}`);
  console.log('');
  console.log(`RECOMMENDATION: ${summary.recommendation}`);

  return summary;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: npx ts-node scripts/test-cover-ocr.ts <image-path-or-directory>');
    console.log('');
    console.log('Examples:');
    console.log('  npx ts-node scripts/test-cover-ocr.ts ./test-covers/');
    console.log('  npx ts-node scripts/test-cover-ocr.ts ./test-covers/hobbit.jpg');
    process.exit(1);
  }

  const inputPath = args[0];

  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Path not found: ${inputPath}`);
    process.exit(1);
  }

  // Collect image files
  let imageFiles: string[] = [];
  const stat = fs.statSync(inputPath);

  if (stat.isDirectory()) {
    const files = fs.readdirSync(inputPath);
    imageFiles = files
      .filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f))
      .map(f => path.join(inputPath, f));
  } else {
    imageFiles = [inputPath];
  }

  if (imageFiles.length === 0) {
    console.error('No image files found');
    process.exit(1);
  }

  console.log(`Found ${imageFiles.length} image(s) to analyze`);
  console.log('Initializing Vision API client...');

  const client = new vision.ImageAnnotatorClient();
  const results: ImageResult[] = [];

  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    console.log(`\nProcessing ${i + 1}/${imageFiles.length}: ${path.basename(file)}`);

    const result = await analyzeImage(client, file);
    results.push(result);
    printResult(result);

    // Small delay to avoid rate limiting
    if (i < imageFiles.length - 1) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  const summary = printSummary(results);

  // Save results to JSON
  const outputPath = './cover-ocr-results.json';
  const output = {
    timestamp: new Date().toISOString(),
    summary,
    results
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nResults saved to ${outputPath}`);
}

main().catch(console.error);
