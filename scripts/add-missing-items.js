#!/usr/bin/env node

/**
 * Add missing items to database and scrape their metadata/images from wiki
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const db = require('../db/database');

db.init();

const WIKI_BASE = 'https://arcraiders.wiki';
const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images', 'items');
const DELAY_MS = 600;

// Missing items to add with their wiki page names and default stack sizes
// Format: [name, stackSize, wikiPageName (optional if different from name)]
const MISSING_ITEMS = [
  // Keys (26 missing)
  ['Ancient Fort Security Code', 1],
  ['Pilgrim\'s Peak Security Code', 1],
  ['Blue Gate Cellar Key', 1],
  ['Blue Gate Communication Tower Key', 1],
  ['Blue Gate Confiscation Room Key', 1],
  ['Blue Gate Village Key', 1],
  ['Buried City Hospital Key', 1],
  ['Buried City JKV Employee Access Card', 1],
  ['Buried City Residential Master Key', 1],
  ['Buried City Town Hall Key', 1],
  ['Dam Control Tower Key', 1],
  ['Dam Staff Room Key', 1],
  ['Dam Surveillance Key', 1],
  ['Dam Testing Annex Key', 1],
  ['Dam Utility Key', 1],
  ['Patrol Car Key', 1],
  ['Raider\'s Refuge Security Code', 1],
  ['Reinforced Reception Security Code', 1],
  ['Spaceport Container Storage Key', 1],
  ['Spaceport Control Tower Key', 1],
  ['Spaceport Trench Tower Key', 1],
  ['Spaceport Warehouse Key', 1],
  ['Stella Montis Archives Key', 1],
  ['Stella Montis Assembly Admin Key', 1],
  ['Stella Montis Medical Storage Key', 1],
  ['Stella Montis Security Checkpoint Key', 1],

  // Trinkets (28)
  ['Air Freshener', 1],
  ['Bloated Tuna Can', 1],
  ['Breathtaking Snow Globe', 1],
  ['Burnt-Out Candles', 1],
  ['Cat Bed', 1],
  ['Coffee Pot', 1],
  ['Dart Board', 1],
  ['Empty Wine Bottle', 1],
  ['Expired Pasta', 1],
  ['Faded Photograph', 1],
  ['Film Reel', 1],
  ['Fine Wristwatch', 1],
  ['Lance\'s Mixtape (5th Edition)', 1],
  ['Light Bulb', 1],
  ['Music Album', 1],
  ['Music Box', 1],
  ['Painted Box', 1],
  ['Playing Cards', 1],
  ['Poster Of Natural Wonders', 1],
  ['Pottery', 1],
  ['Red Coral Jewelry', 1],
  ['Rosary', 1],
  ['Rubber Duck', 1],
  ['Silver Teaspoon Set', 1],
  ['Statuette', 1],
  ['Torn Book', 1],
  ['Vase', 1],
  ['Very Comfortable Pillow', 1],

  // Recyclables/Misc (111 - many are useful crafting items)
  ['Alarm Clock', 5],
  ['ARC Coolant', 10],
  ['ARC Flex Rubber', 10],
  ['ARC Performance Steel', 10],
  ['ARC Synthetic Resin', 10],
  ['ARC Thermo Lining', 10],
  ['Bastion Cell', 5],
  ['Bicycle Pump', 5],
  ['Bombardier Cell', 5],
  ['Broken Flashlight', 5],
  ['Broken Guidance System', 5],
  ['Broken Handheld Radio', 5],
  ['Broken Taser', 5],
  ['Burned ARC Circuitry', 10],
  ['Camera Lens', 5],
  ['Candle Holder', 5],
  ['Coolant', 10],
  ['Cooling Coil', 5],
  ['Cooling Fan', 5],
  ['Cracked Bioscanner', 5],
  ['Crumpled Plastic Bottle', 10],
  ['Damaged ARC Motion Core', 5],
  ['Damaged ARC Powercell', 5],
  ['Damaged Fireball Burner', 5],
  ['Damaged Heat Sink', 5],
  ['Damaged Hornet Driver', 5],
  ['Damaged Rocketeer Driver', 5],
  ['Damaged Snitch Scanner', 5],
  ['Damaged Tick Pod', 5],
  ['Damaged Wasp Driver', 5],
  ['Deflated Football', 5],
  ['Degraded ARC Rubber', 10],
  ['Diving Goggles', 5],
  ['Dog Collar', 5],
  ['Dried-Out ARC Resin', 10],
  ['Expired Respirator', 5],
  ['Fireball Burner', 5],
  ['Flow Controller', 5],
  ['Frequency Modulation Box', 5],
  ['Fried Motherboard', 5],
  ['Frying Pan', 5],
  ['Garlic Press', 5],
  ['Geiger Counter', 5],
  ['Headphones', 5],
  ['Hornet Driver', 5],
  ['Household Cleaner', 10],
  ['Humidifier', 5],
  ['Ice Cream Scooper', 5],
  ['Impure ARC Coolant', 10],
  ['Industrial Battery', 5],
  ['Industrial Charger', 5],
  ['Industrial Magnet', 5],
  ['Ion Sputter', 5],
  ['Laboratory Reagents', 10],
  ['Leaper Pulse Unit', 5],
  ['Magnetron', 5],
  ['Metal Brackets', 10],
  ['Microscope', 5],
  ['Mini Centrifuge', 5],
  ['Motor', 5],
  ['Number Plate', 10],
  ['Polluted Air Filter', 5],
  ['Portable TV', 5],
  ['Power Bank', 5],
  ['Power Cable', 10],
  ['Projector', 5],
  ['Radio', 5],
  ['Radio Relay', 5],
  ['Remote Control', 5],
  ['Ripped Safety Vest', 5],
  ['Rocket Thruster', 5],
  ['Rocketeer Driver', 5],
  ['Rotary Encoder', 5],
  ['Rubber Pad', 10],
  ['Ruined Accordion', 5],
  ['Ruined Augment', 5],
  ['Ruined Baton', 5],
  ['Ruined Handcuffs', 5],
  ['Ruined Parachute', 5],
  ['Ruined Riot Shield', 5],
  ['Ruined Tactical Vest', 5],
  ['Rusted Bolts', 10],
  ['Rusted Gear', 10],
  ['Rusted Shut Medical Kit', 5],
  ['Rusted Tools', 5],
  ['Rusty ARC Steel', 10],
  ['Sample Cleaner', 5],
  ['Sentinel Firing Core', 5],
  ['Shredder Gyro', 5],
  ['Signal Amplifier', 5],
  ['Snitch Scanner', 5],
  ['Spectrometer', 5],
  ['Spectrum Analyzer', 5],
  ['Spotter Relay', 5],
  ['Spring Cushion', 5],
  ['Surveyor Vault', 5],
  ['Tattered ARC Lining', 10],
  ['Tattered Clothes', 10],
  ['Telemetry Transceiver', 5],
  ['Thermostat', 5],
  ['Tick Pod', 5],
  ['Toaster', 5],
  ['Torn Blanket', 10],
  ['Turbo Pump', 5],
  ['Unusable Weapon', 5],
  ['Wasp Driver', 5],
  ['Water Filter', 5],
  ['Water Pump', 5],

  // Nature items
  ['Apricot', 10],
  ['Assorted Seeds', 10],
  ['Fertilizer', 10],
  ['Lemon', 10],
  ['Olives', 10],
  ['Prickly Pear', 10],
  ['Resin', 10],
  ['Roots', 10],
];

// Category mappings for wiki scraping
const CATEGORY_MAP = {
  'basic material': db.Category.BASIC_MATERIAL,
  'topside material': db.Category.TOPSIDE_MATERIAL,
  'advanced material': db.Category.ADVANCED_MATERIAL,
  'refined material': db.Category.REFINED_MATERIAL,
  'quick use': db.Category.QUICK_USE,
  'gadget': db.Category.QUICK_USE,
  'gadgets': db.Category.QUICK_USE,
  'regenerative': db.Category.QUICK_USE,
  'grenade': db.Category.QUICK_USE,
  'grenades': db.Category.QUICK_USE,
  'trap': db.Category.QUICK_USE,
  'traps': db.Category.QUICK_USE,
  'utility': db.Category.QUICK_USE,
  'utilities': db.Category.QUICK_USE,
  'key': db.Category.KEY,
  'keys': db.Category.KEY,
  'augment': db.Category.AUGMENT,
  'augments': db.Category.AUGMENT,
  'ammunition': db.Category.AMMUNITION,
  'ammo': db.Category.AMMUNITION,
  'shield': db.Category.SHIELD,
  'shields': db.Category.SHIELD,
  'trinket': db.Category.TRINKET,
  'trinkets': db.Category.TRINKET,
  'misc': db.Category.MISC,
  'recyclable': db.Category.MISC,
  'recyclables': db.Category.MISC,
  'nature': db.Category.MISC,
  'weapon': db.Category.WEAPON,
  'weapons': db.Category.WEAPON,
  'modification': db.Category.MODIFICATION,
  'modifications': db.Category.MODIFICATION,
  'muzzle': db.Category.MODIFICATION,
  'underbarrel': db.Category.MODIFICATION,
  'stock': db.Category.MODIFICATION,
  'magazine': db.Category.MODIFICATION,
  'grip': db.Category.MODIFICATION,
  'barrel': db.Category.MODIFICATION,
  'light-mag': db.Category.MODIFICATION,
  'medium-mag': db.Category.MODIFICATION,
  'shotgun-mag': db.Category.MODIFICATION,
  'shotgun-muzzle': db.Category.MODIFICATION,
};

const RARITY_MAP = {
  'common': db.Rarity.COMMON,
  'uncommon': db.Rarity.UNCOMMON,
  'rare': db.Rarity.RARE,
  'epic': db.Rarity.EPIC,
  'legendary': db.Rarity.LEGENDARY,
};

let added = 0;
let updated = 0;
let failed = 0;
const warnings = [];

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
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

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (res) => {
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
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', (err) => { fs.unlinkSync(destPath); reject(err); });
    }).on('error', (err) => { file.close(); try { fs.unlinkSync(destPath); } catch(e) {} reject(err); });
  });
}

function toWikiPath(name) {
  return name.replace(/ /g, '_');
}

function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function extractCategory(html) {
  const wgCategoriesMatch = html.match(/"wgCategories":\[([^\]]+)\]/);
  if (wgCategoriesMatch) {
    const categories = wgCategoriesMatch[1].split(',').map(c => c.replace(/"/g, '').trim().toLowerCase());
    for (const cat of categories) {
      if (CATEGORY_MAP[cat]) {
        return CATEGORY_MAP[cat];
      }
    }
  }
  return null;
}

function extractRarity(html) {
  const wgCategoriesMatch = html.match(/"wgCategories":\[([^\]]+)\]/);
  if (wgCategoriesMatch) {
    const categories = wgCategoriesMatch[1].split(',').map(c => c.replace(/"/g, '').trim().toLowerCase());
    for (const cat of categories) {
      if (RARITY_MAP[cat]) {
        return RARITY_MAP[cat];
      }
    }
  }
  return null;
}

function extractImageUrl(html, itemName) {
  const wikiPath = toWikiPath(itemName);
  const patterns = [
    /<a[^>]*class="[^"]*image[^"]*"[^>]*href="[^"]*"[^>]*>\s*<img[^>]*src="([^"]+)"[^>]*>/gi,
    new RegExp(`<img[^>]*src="([^"]+${wikiPath}[^"]*)"[^>]*>`, 'i'),
    /<img[^>]*class="[^"]*thumbimage[^"]*"[^>]*src="([^"]+)"[^>]*>/gi,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match && match[1]) {
      let imgUrl = match[1];
      if (imgUrl.startsWith('/')) {
        imgUrl = WIKI_BASE + imgUrl;
      }
      if (imgUrl.includes('placeholder') || (imgUrl.includes('icon') && imgUrl.includes('16px'))) {
        continue;
      }
      return imgUrl;
    }
    pattern.lastIndex = 0;
  }

  const imgMatch = html.match(/<img[^>]*src="(\/w\/images\/[^"]+)"[^>]*>/i);
  if (imgMatch) {
    return WIKI_BASE + imgMatch[1];
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

async function processItem(name, stackSize, wikiName) {
  const wikiPath = toWikiPath(wikiName || name);
  const wikiUrl = `${WIKI_BASE}/wiki/${encodeURIComponent(wikiPath)}`;
  const slug = toSlug(name);

  try {
    const html = await fetch(wikiUrl);

    // Extract metadata
    let categoryId = extractCategory(html);
    const rarityId = extractRarity(html);

    // Default to KEY for key items
    if (!categoryId && (name.includes('Key') || name.includes('Security Code') ||
        name.includes('Access Card'))) {
      categoryId = db.Category.KEY;
    }

    // Default to MODIFICATION for modification items if wiki doesn't have it
    if (!categoryId && (name.includes('Grip') || name.includes('Mag') || name.includes('Stock') ||
        name.includes('Compensator') || name.includes('Muzzle') || name.includes('Silencer') ||
        name.includes('Choke') || name.includes('Barrel') || name.includes('Splitter') ||
        name.includes('Converter'))) {
      categoryId = db.Category.MODIFICATION;
    }

    // Default to QUICK_USE for gadgets/consumables
    if (!categoryId && (name.includes('Grenade') || name.includes('Mine') || name.includes('Trap') ||
        name.includes('Bandage') || name.includes('Shot') || name.includes('Spray') ||
        name.includes('Guitar') || name.includes('Juice') || name.includes('Mix') ||
        name.includes('Binoculars') || name.includes('Shield Recharger') || name.includes('Recorder') ||
        name.includes('Firecracker') || name.includes('Noisemaker') || name.includes('Barricade') ||
        name.includes('Shaker'))) {
      categoryId = db.Category.QUICK_USE;
    }

    // Default to AUGMENT
    if (!categoryId && name.includes('Augment')) {
      categoryId = db.Category.AUGMENT;
    }

    // Default to AMMUNITION
    if (!categoryId && (name === 'Ammo' || name.includes('Ammo'))) {
      categoryId = db.Category.AMMUNITION;
    }

    if (!categoryId) {
      categoryId = db.Category.MISC;
    }

    // Check if item exists
    const existing = db.db.prepare('SELECT id FROM items WHERE name = ?').get(name);
    let itemId;

    if (existing) {
      itemId = existing.id;
      db.updateItemCategoryAndRarity(itemId, categoryId, rarityId);
      updated++;
      console.log(`  [UPDATE] ${name}`);
    } else {
      itemId = db.createItem(name, stackSize, categoryId);
      if (rarityId) {
        db.updateItemCategoryAndRarity(itemId, categoryId, rarityId);
      }
      added++;
      console.log(`  [ADD] ${name}`);
    }

    // Download image
    const imageUrl = extractImageUrl(html, wikiName || name);
    if (imageUrl) {
      const ext = getExtension(imageUrl);
      const filename = `${slug}.${ext}`;
      const filepath = path.join(IMAGES_DIR, filename);
      const dbPath = `/images/items/${filename}`;

      await downloadFile(imageUrl, filepath);
      db.updateItemImage(itemId, dbPath);
      console.log(`    -> Image: ${filename}`);
    } else {
      warnings.push(`No image for: ${name}`);
    }

    const categoryName = db.CategoryNames[categoryId] || 'Unknown';
    const rarityName = db.RarityNames[rarityId] || 'Unknown';
    console.log(`    -> ${categoryName} / ${rarityName}`);

  } catch (err) {
    warnings.push(`Failed: ${name} - ${err.message}`);
    failed++;

    // Try to add anyway with defaults
    const existing = db.db.prepare('SELECT id FROM items WHERE name = ?').get(name);
    if (!existing) {
      let categoryId = db.Category.MISC;
      if (name.includes('Key') || name.includes('Security Code') || name.includes('Access Card')) {
        categoryId = db.Category.KEY;
      } else if (name.includes('Grip') || name.includes('Mag') || name.includes('Stock') ||
          name.includes('Compensator') || name.includes('Muzzle') || name.includes('Silencer') ||
          name.includes('Choke') || name.includes('Barrel') || name.includes('Splitter') ||
          name.includes('Converter')) {
        categoryId = db.Category.MODIFICATION;
      } else if (name.includes('Grenade') || name.includes('Mine') || name.includes('Trap') ||
                 name.includes('Shot') || name.includes('Spray') || name.includes('Guitar') ||
                 name.includes('Juice') || name.includes('Binoculars')) {
        categoryId = db.Category.QUICK_USE;
      } else if (name.includes('Augment')) {
        categoryId = db.Category.AUGMENT;
      } else if (name.includes('Ammo')) {
        categoryId = db.Category.AMMUNITION;
      }

      db.createItem(name, stackSize, categoryId);
      console.log(`  [ADD-FALLBACK] ${name} (no wiki data)`);
      added++;
    }
  }
}

async function main() {
  console.log('Adding Missing Items to ARC Raiders Database');
  console.log('=============================================\n');

  // Ensure images directory exists
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  console.log(`Processing ${MISSING_ITEMS.length} items...\n`);

  for (let i = 0; i < MISSING_ITEMS.length; i++) {
    const [name, stackSize, wikiName] = MISSING_ITEMS[i];
    process.stdout.write(`[${i + 1}/${MISSING_ITEMS.length}] `);
    await processItem(name, stackSize, wikiName);

    if (i < MISSING_ITEMS.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log('\n=============================================');
  console.log('Summary:');
  console.log(`  Added:   ${added}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Failed:  ${failed}`);

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
