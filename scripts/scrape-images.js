#!/usr/bin/env node

/**
 * Scrape item images from arcraiders.wiki
 *
 * For each item in the database:
 * 1. Fetch the wiki page at https://arcraiders.wiki/wiki/{Item_Name}
 * 2. Find the main item image in the infobox
 * 3. Download the image to public/images/items/{slug}.png
 * 4. Update the database with the image path
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const db = require('../db/database');

// Initialize database (adds image_path column if needed)
db.init();

const WIKI_BASE = 'https://arcraiders.wiki';
const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images', 'items');
const DELAY_MS = 500; // Be nice to the wiki server

// Stats
let success = 0;
let failed = 0;
let skipped = 0;
const warnings = [];

/**
 * Convert item name to URL-safe wiki path
 * "Raider Hatch Key" -> "Raider_Hatch_Key"
 */
function toWikiPath(name) {
  return name.replace(/ /g, '_');
}

/**
 * Convert item name to slug for filename
 * "Raider Hatch Key" -> "raider-hatch-key"
 */
function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Fetch a URL and return the response body as a string
 */
function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith('/')) {
          redirectUrl = WIKI_BASE + redirectUrl;
        }
        return fetch(redirectUrl).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Download a file from URL to disk
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);

    https.get(url, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(destPath);
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith('/')) {
          redirectUrl = WIKI_BASE + redirectUrl;
        }
        return downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
      file.on('error', (err) => {
        fs.unlinkSync(destPath);
        reject(err);
      });
    }).on('error', (err) => {
      file.close();
      fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

/**
 * Extract the main item image URL from wiki HTML
 * Looks for the image in the infobox or main content
 */
function extractImageUrl(html, itemName) {
  // Look for infobox image first (most reliable)
  // Pattern: <img ... src="/w/images/..." alt="Item Name" ...>
  const wikiPath = toWikiPath(itemName);

  // Try to find image with matching alt text or in infobox
  const patterns = [
    // Infobox image (usually the main item image)
    /<a[^>]*class="[^"]*image[^"]*"[^>]*href="[^"]*"[^>]*>\s*<img[^>]*src="([^"]+)"[^>]*>/gi,
    // Any image with matching name
    new RegExp(`<img[^>]*src="([^"]+${wikiPath}[^"]*)"[^>]*>`, 'i'),
    // Thumbnail images
    /<img[^>]*class="[^"]*thumbimage[^"]*"[^>]*src="([^"]+)"[^>]*>/gi,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match && match[1]) {
      let imgUrl = match[1];
      // Convert relative URL to absolute
      if (imgUrl.startsWith('/')) {
        imgUrl = WIKI_BASE + imgUrl;
      }
      // Skip placeholder/icon images
      if (imgUrl.includes('placeholder') || imgUrl.includes('icon') && imgUrl.includes('16px')) {
        continue;
      }
      return imgUrl;
    }
    pattern.lastIndex = 0; // Reset regex
  }

  // Fallback: find any image in /w/images/ that looks like item image
  const imgMatch = html.match(/<img[^>]*src="(\/w\/images\/[^"]+)"[^>]*>/i);
  if (imgMatch) {
    return WIKI_BASE + imgMatch[1];
  }

  return null;
}

/**
 * Get file extension from URL or content-type
 */
function getExtension(url) {
  const match = url.match(/\.(png|jpg|jpeg|gif|webp)(\?|$)/i);
  return match ? match[1].toLowerCase() : 'png';
}

/**
 * Process a single item
 */
async function processItem(item) {
  const wikiPath = toWikiPath(item.name);
  const wikiUrl = `${WIKI_BASE}/wiki/${encodeURIComponent(wikiPath)}`;
  const slug = toSlug(item.name);

  try {
    // Fetch wiki page
    const html = await fetch(wikiUrl);

    // Extract image URL
    const imageUrl = extractImageUrl(html, item.name);
    if (!imageUrl) {
      warnings.push(`No image found for: ${item.name}`);
      failed++;
      return;
    }

    // Determine file extension and path
    const ext = getExtension(imageUrl);
    const filename = `${slug}.${ext}`;
    const filepath = path.join(IMAGES_DIR, filename);
    const dbPath = `/images/items/${filename}`;

    // Download image
    await downloadFile(imageUrl, filepath);

    // Update database
    db.updateItemImage(item.id, dbPath);

    console.log(`  [OK] ${item.name} -> ${filename}`);
    success++;

  } catch (err) {
    warnings.push(`Failed for ${item.name}: ${err.message}`);
    failed++;
  }
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main entry point
 */
async function main() {
  console.log('ARC Raiders Wiki Image Scraper');
  console.log('==============================\n');

  // Ensure images directory exists
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  // Get all items
  const items = db.getAllItems();
  console.log(`Found ${items.length} items in database\n`);

  // Process each item
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // Skip if already has image
    if (item.image_path) {
      console.log(`  [SKIP] ${item.name} (already has image)`);
      skipped++;
      continue;
    }

    process.stdout.write(`[${i + 1}/${items.length}] Processing ${item.name}...`);
    await processItem(item);

    // Rate limiting
    if (i < items.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  // Summary
  console.log('\n==============================');
  console.log('Summary:');
  console.log(`  Success: ${success}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Skipped: ${skipped}`);

  if (warnings.length > 0) {
    console.log('\nWarnings:');
    warnings.forEach(w => console.log(`  - ${w}`));
  }

  console.log('\nDone!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
