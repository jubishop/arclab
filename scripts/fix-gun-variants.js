#!/usr/bin/env node

/**
 * Fix gun variant images by fetching base gun images from wiki
 * e.g., "Anvil I", "Anvil II", etc. will use the image from wiki.com/wiki/Anvil
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const db = require('../db/database');

db.init();

const WIKI_BASE = 'https://arcraiders.wiki';
const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images', 'items');
const DELAY_MS = 500;

/**
 * Convert name to slug for filename
 */
function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Fetch URL content
 */
function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith('/')) redirectUrl = WIKI_BASE + redirectUrl;
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
 * Download file from URL
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(destPath);
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith('/')) redirectUrl = WIKI_BASE + redirectUrl;
        return downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', (err) => { fs.unlinkSync(destPath); reject(err); });
    }).on('error', (err) => { file.close(); fs.unlinkSync(destPath); reject(err); });
  });
}

/**
 * Extract image URL from wiki HTML
 */
function extractImageUrl(html) {
  // Look for infobox/main image
  const patterns = [
    /<a[^>]*class="[^"]*image[^"]*"[^>]*>\s*<img[^>]*src="([^"]+)"[^>]*>/i,
    /<img[^>]*src="(\/w\/images\/[^"]+)"[^>]*>/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      let imgUrl = match[1];
      if (imgUrl.startsWith('/')) imgUrl = WIKI_BASE + imgUrl;
      if (imgUrl.includes('placeholder')) continue;
      return imgUrl;
    }
  }
  return null;
}

function getExtension(url) {
  const match = url.match(/\.(png|jpg|jpeg|gif|webp)(\?|$)/i);
  return match ? match[1].toLowerCase() : 'png';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('Fixing gun variant images...\n');

  const items = db.getAllItems();
  const variantPattern = /^(.+)\s+(I|II|III|IV)$/;

  // Group variants by base name
  const baseGroups = {};
  for (const item of items) {
    if (item.image_path) continue; // Skip items with images
    const match = item.name.match(variantPattern);
    if (!match) continue;
    const baseName = match[1];
    if (!baseGroups[baseName]) baseGroups[baseName] = [];
    baseGroups[baseName].push(item);
  }

  const baseNames = Object.keys(baseGroups);
  console.log(`Found ${baseNames.length} base guns needing images\n`);

  let fixed = 0;
  let failed = 0;

  for (let i = 0; i < baseNames.length; i++) {
    const baseName = baseNames[i];
    const variants = baseGroups[baseName];
    const wikiPath = baseName.replace(/ /g, '_');
    const wikiUrl = `${WIKI_BASE}/wiki/${encodeURIComponent(wikiPath)}`;

    process.stdout.write(`[${i + 1}/${baseNames.length}] ${baseName}... `);

    try {
      // Fetch wiki page
      const html = await fetch(wikiUrl);
      const imageUrl = extractImageUrl(html);

      if (!imageUrl) {
        console.log('no image found');
        failed += variants.length;
        continue;
      }

      // Download image
      const ext = getExtension(imageUrl);
      const slug = toSlug(baseName);
      const filename = `${slug}.${ext}`;
      const filepath = path.join(IMAGES_DIR, filename);
      const dbPath = `/images/items/${filename}`;

      await downloadFile(imageUrl, filepath);

      // Update all variants
      for (const variant of variants) {
        db.updateItemImage(variant.id, dbPath);
      }

      console.log(`OK -> ${variants.length} variants updated`);
      fixed += variants.length;

    } catch (err) {
      console.log(`failed: ${err.message}`);
      failed += variants.length;
    }

    if (i < baseNames.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\nDone! Fixed: ${fixed}, Failed: ${failed}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
