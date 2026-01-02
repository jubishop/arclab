const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { Category } = db;

// Get all craftable items for the planner
function getCraftableItems() {
  return db.db.prepare(`
    SELECT DISTINCT i.*, c.name AS category
    FROM items i
    JOIN categories c ON i.category_id = c.id
    WHERE EXISTS (SELECT 1 FROM recipes WHERE item_id = i.id)
    ORDER BY c.name, i.name
  `).all();
}

// Calculate optimal inventory for a set of desired items
// Input: stacks (not individual items)
function calculateOptimalInventory(desiredItems) {
  // Aggregate: { itemId: { item: {...}, quantity: number, reason: string } }
  const inventory = {};

  for (const { itemId, stacks } of desiredItems) {
    const item = db.getItemById(itemId);
    if (!item || stacks <= 0) continue;

    // Convert stacks to actual item quantity
    const quantity = stacks * item.stack_size;
    const recipe = db.getRecipeByItemId(itemId);

    const stackWord = stacks === 1 ? 'stack' : 'stacks';

    if (!recipe || recipe.length === 0) {
      // Not craftable, just hold the item itself
      addToInventory(inventory, item, quantity, `${stacks} ${stackWord} base item`);
      continue;
    }

    // Calculate efficiency (slots per item)
    const slotsPerCraftedItem = 1 / item.stack_size;
    const slotsForMaterials = recipe.reduce((total, r) => {
      return total + (r.quantity / r.material_stack_size);
    }, 0);

    if (slotsPerCraftedItem < slotsForMaterials) {
      // Crafted item is more efficient, hold the item
      addToInventory(inventory, item, quantity, `${stacks} ${stackWord} craft ahead`);
    } else {
      // Materials are more efficient (or equal), hold the materials
      for (const r of recipe) {
        const material = db.getItemById(r.material_id);
        const materialQty = r.quantity * quantity;
        addToInventory(inventory, material, materialQty, `for ${stacks} ${stackWord} ${item.name}`);
      }
    }
  }

  // Convert to array and round up to stack sizes
  const result = Object.values(inventory).map(entry => {
    const stacks = Math.ceil(entry.quantity / entry.item.stack_size);
    const roundedQty = stacks * entry.item.stack_size;
    return {
      item: entry.item,
      rawQuantity: entry.quantity,
      stacks: stacks,
      roundedQuantity: roundedQty,
      reasons: entry.reasons
    };
  });

  // Sort by rarity (highest first), then alphabetically by name
  result.sort(sortByRarityThenName);

  return result;
}

function addToInventory(inventory, item, quantity, reason) {
  if (!inventory[item.id]) {
    inventory[item.id] = {
      item: item,
      quantity: 0,
      reasons: []
    };
  }
  inventory[item.id].quantity += quantity;
  if (!inventory[item.id].reasons.includes(reason)) {
    inventory[item.id].reasons.push(reason);
  }
}

// Sort by rarity (highest first), then alphabetically by name
function sortByRarityThenName(a, b) {
  const aRarity = a.item.rarity_id || 0;
  const bRarity = b.item.rarity_id || 0;
  if (aRarity !== bRarity) {
    return bRarity - aRarity; // Higher rarity first (legendary=5 before common=1)
  }
  return a.item.name.localeCompare(b.item.name);
}

// Show planner page (load saved stash and auto-calculate)
router.get('/', (req, res) => {
  const craftableItems = getCraftableItems();
  // Get all items for the modal selector (no filtering - let client filter by category tabs)
  const allItems = db.getAllItems();

  // Load saved stash configuration (stored as stacks)
  const savedStash = db.getStash();
  const selectedItems = savedStash.map(s => {
    const item = db.getItemById(s.item_id);
    return { item, stacks: s.quantity };
  }).sort(sortByRarityThenName);

  // Auto-calculate if there are saved items
  let results = null;
  let totalSlots = 0;
  if (savedStash.length > 0) {
    const desiredItems = savedStash.map(s => ({
      itemId: s.item_id,
      stacks: s.quantity
    }));
    results = calculateOptimalInventory(desiredItems);
    totalSlots = results.reduce((sum, r) => sum + r.stacks, 0);
  }

  res.render('stash/index', {
    craftableItems,
    allItems,
    results,
    selectedItems,
    totalSlots
  });
});

// Calculate stash and save configuration
router.post('/', (req, res) => {
  const { item_ids, quantities } = req.body;

  const craftableItems = getCraftableItems();
  // Get all items for the modal selector (no filtering - let client filter by category tabs)
  const allItems = db.getAllItems();

  // Parse input (quantities represent stacks)
  const itemIdsArr = item_ids ? (Array.isArray(item_ids) ? item_ids : [item_ids]) : [];
  const stacksArr = quantities ? (Array.isArray(quantities) ? quantities : [quantities]) : [];

  const desiredItems = itemIdsArr.map((id, i) => ({
    itemId: parseInt(id),
    stacks: parseInt(stacksArr[i]) || 0
  })).filter(d => d.itemId && d.stacks > 0);

  // Save the stash configuration (stores stacks)
  db.saveStash(desiredItems.map(d => ({ itemId: d.itemId, quantity: d.stacks })));

  // Track selected items for re-rendering
  const selectedItems = desiredItems.map(d => {
    const item = db.getItemById(d.itemId);
    return { item, stacks: d.stacks };
  }).sort(sortByRarityThenName);

  const results = calculateOptimalInventory(desiredItems);

  // Calculate total slots
  const totalSlots = results.reduce((sum, r) => sum + r.stacks, 0);

  res.render('stash/index', {
    craftableItems,
    allItems,
    results,
    selectedItems,
    totalSlots
  });
});

module.exports = router;
