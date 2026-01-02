#!/usr/bin/env node

/**
 * Scrape item category and rarity from arcraiders.wiki
 *
 * For each item in the database:
 * 1. Fetch the wiki page at https://arcraiders.wiki/wiki/{Item_Name}
 * 2. Extract category and rarity from the infobox
 * 3. Update the database with the new values
 */

const https = require('https');
const db = require('../db/database');

// Initialize database
db.init();

const WIKI_BASE = 'https://arcraiders.wiki';
const DELAY_MS = 500; // Be nice to the wiki server

// Stats
let success = 0;
let failed = 0;
let skipped = 0;
const warnings = [];

// Category mapping from wiki text to our enum
const CATEGORY_MAP = {
  // Materials
  'basic material': db.Category.BASIC_MATERIAL,
  'topside material': db.Category.TOPSIDE_MATERIAL,
  'advanced material': db.Category.ADVANCED_MATERIAL,
  'refined material': db.Category.REFINED_MATERIAL,
  // Quick Use / Gadgets
  'quick use': db.Category.QUICK_USE,
  'gadget': db.Category.QUICK_USE,
  'gadgets': db.Category.QUICK_USE,
  // Keys
  'key': db.Category.KEY,
  'keys': db.Category.KEY,
  // Augments
  'augment': db.Category.AUGMENT,
  'augments': db.Category.AUGMENT,
  // Ammunition
  'ammunition': db.Category.AMMUNITION,
  'ammo': db.Category.AMMUNITION,
  // Shields
  'shield': db.Category.SHIELD,
  'shields': db.Category.SHIELD,
  // Trinkets
  'trinket': db.Category.TRINKET,
  'trinkets': db.Category.TRINKET,
  // Misc
  'misc': db.Category.MISC,
  // Weapons (singular and plural forms)
  'weapon': db.Category.WEAPON,
  'weapons': db.Category.WEAPON,
  'hand cannon': db.Category.WEAPON,
  'hand cannons': db.Category.WEAPON,
  'assault rifle': db.Category.WEAPON,
  'assault rifles': db.Category.WEAPON,
  'submachine gun': db.Category.WEAPON,
  'submachine guns': db.Category.WEAPON,
  'shotgun': db.Category.WEAPON,
  'shotguns': db.Category.WEAPON,
  'sniper rifle': db.Category.WEAPON,
  'sniper rifles': db.Category.WEAPON,
  'light machine gun': db.Category.WEAPON,
  'light machine guns': db.Category.WEAPON,
  'pistol': db.Category.WEAPON,
  'pistols': db.Category.WEAPON,
  'marksman rifle': db.Category.WEAPON,
  'marksman rifles': db.Category.WEAPON,
  // Modifications
  'modification': db.Category.MODIFICATION,
  'modifications': db.Category.MODIFICATION,
  'barrel': db.Category.MODIFICATION,
  'barrels': db.Category.MODIFICATION,
  'grip': db.Category.MODIFICATION,
  'grips': db.Category.MODIFICATION,
  'magazine': db.Category.MODIFICATION,
  'magazines': db.Category.MODIFICATION,
  'muzzle': db.Category.MODIFICATION,
  'muzzles': db.Category.MODIFICATION,
  'optic': db.Category.MODIFICATION,
  'optics': db.Category.MODIFICATION,
  'stock': db.Category.MODIFICATION,
  'stocks': db.Category.MODIFICATION,
  'underbarrel': db.Category.MODIFICATION,
  'underbarrels': db.Category.MODIFICATION,
  'laser': db.Category.MODIFICATION,
  'lasers': db.Category.MODIFICATION,
};

// Rarity mapping
const RARITY_MAP = {
  'common': db.Rarity.COMMON,
  'uncommon': db.Rarity.UNCOMMON,
  'rare': db.Rarity.RARE,
  'epic': db.Rarity.EPIC,
  'legendary': db.Rarity.LEGENDARY,
};

// Known weapon base names (these have Roman numeral variants that share a wiki page)
const WEAPON_BASE_NAMES = new Set([
  'Anvil', 'Aphelion', 'Arpeggio', 'Bettina', 'Bobcat', 'Burletta', 'Equalizer',
  'Ferro', 'Hairpin', 'Hullcracker', 'Il Toro', 'Jupiter', 'Kettle', 'Osprey',
  'Rattler', 'Renegade', 'Stitcher', 'Tempest', 'Torrente', 'Venator', 'Vulcano'
]);

/**
 * Convert item name to URL-safe wiki path
 * Only strips Roman numeral suffixes for known weapon variants
 */
function toWikiPath(name) {
  // Check if this is a known weapon variant
  const romanMatch = name.match(/^(.+)\s+(I{1,3}|IV)$/);
  if (romanMatch && WEAPON_BASE_NAMES.has(romanMatch[1])) {
    // It's a weapon variant - use base name
    return romanMatch[1].replace(/ /g, '_');
  }
  // Otherwise keep the full name
  return name.replace(/ /g, '_');
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
 * Extract category from wiki HTML
 * Uses wgCategories from MediaWiki or infobox data-tag
 */
function extractCategory(html) {
  // Try wgCategories first (most reliable)
  const wgCategoriesMatch = html.match(/"wgCategories":\[([^\]]+)\]/);
  if (wgCategoriesMatch) {
    const categories = wgCategoriesMatch[1].split(',').map(c => c.replace(/"/g, '').trim().toLowerCase());
    for (const cat of categories) {
      if (CATEGORY_MAP[cat]) {
        return CATEGORY_MAP[cat];
      }
    }
  }

  // Fallback: look in infobox data-tag rows
  // Pattern: <tr class="data-tag..."><td colspan="2">Category Name</td></tr>
  const dataTagMatches = html.matchAll(/<tr[^>]*class="data-tag[^"]*"[^>]*>[\s\S]*?<td[^>]*>([^<]+)<\/td>/gi);
  for (const match of dataTagMatches) {
    const text = match[1].trim().toLowerCase();
    if (CATEGORY_MAP[text]) {
      return CATEGORY_MAP[text];
    }
  }

  return null;
}

/**
 * Extract stack size from wiki HTML
 */
function extractStackSize(html) {
  // Look for the stack size in the infobox (class is "data-stackstize" - typo in wiki HTML)
  const stackMatch = html.match(/<tr[^>]*class="data-stackstize[^"]*"[^>]*>[\s\S]*?<td>(\d+)<\/td>/i);
  if (stackMatch) {
    return parseInt(stackMatch[1], 10);
  }

  // Fallback: look for "Stack Size" label
  const labelMatch = html.match(/Stack\s*Size[\s\S]*?<td>(\d+)<\/td>/i);
  if (labelMatch) {
    return parseInt(labelMatch[1], 10);
  }

  return null;
}

/**
 * Extract rarity from wiki HTML
 */
function extractRarity(html) {
  // Try wgCategories first (most reliable)
  const wgCategoriesMatch = html.match(/"wgCategories":\[([^\]]+)\]/);
  if (wgCategoriesMatch) {
    const categories = wgCategoriesMatch[1].split(',').map(c => c.replace(/"/g, '').trim().toLowerCase());
    for (const cat of categories) {
      if (RARITY_MAP[cat]) {
        return RARITY_MAP[cat];
      }
    }
  }

  // Fallback: look in infobox data-tag rows
  const dataTagMatches = html.matchAll(/<tr[^>]*class="data-tag[^"]*"[^>]*>[\s\S]*?<td[^>]*>([^<]+)<\/td>/gi);
  for (const match of dataTagMatches) {
    const text = match[1].trim().toLowerCase();
    if (RARITY_MAP[text]) {
      return RARITY_MAP[text];
    }
  }

  return null;
}

/**
 * Process a single item
 */
async function processItem(item) {
  const wikiPath = toWikiPath(item.name);
  const wikiUrl = `${WIKI_BASE}/wiki/${encodeURIComponent(wikiPath)}`;

  try {
    // Fetch wiki page
    const html = await fetch(wikiUrl);

    // Extract category, rarity, and stack size
    const categoryId = extractCategory(html);
    const rarityId = extractRarity(html);
    const stackSize = extractStackSize(html);

    if (!categoryId && !rarityId && !stackSize) {
      warnings.push(`No metadata found for: ${item.name}`);
      failed++;
      return;
    }

    // Update database - only update if we found new values
    const newCategoryId = categoryId || item.category_id;
    const newRarityId = rarityId || item.rarity_id;

    db.updateItemCategoryAndRarity(item.id, newCategoryId, newRarityId);

    // Update stack size if found and different from current
    if (stackSize && stackSize !== item.stack_size) {
      db.updateItemStackSize(item.id, stackSize);
    }

    const categoryName = db.CategoryNames[newCategoryId] || 'Unknown';
    const rarityName = db.RarityNames[newRarityId] || 'Unknown';
    const stackInfo = stackSize ? ` (stack: ${stackSize})` : '';
    console.log(`  [OK] ${item.name} -> ${categoryName} / ${rarityName}${stackInfo}`);
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
  console.log('ARC Raiders Wiki Metadata Scraper');
  console.log('=================================\n');

  // Get all items
  const items = db.getAllItems();
  console.log(`Found ${items.length} items in database\n`);

  // Process each item
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // Skip if already has rarity (pass --force to override)
    if (item.rarity_id && !process.argv.includes('--force')) {
      console.log(`  [SKIP] ${item.name} (already has rarity)`);
      skipped++;
      continue;
    }

    process.stdout.write(`[${i + 1}/${items.length}] Processing ${item.name}... `);
    await processItem(item);

    // Rate limiting
    if (i < items.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  // Summary
  console.log('\n=================================');
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
