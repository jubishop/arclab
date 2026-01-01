const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Get all craftable items for the planner
function getCraftableItems() {
  return db.db.prepare(`
    SELECT DISTINCT i.*
    FROM items i
    WHERE EXISTS (SELECT 1 FROM recipes WHERE item_id = i.id)
    ORDER BY i.category, i.name
  `).all();
}

// Calculate optimal inventory for a set of desired items
function calculateOptimalInventory(desiredItems) {
  // Aggregate: { itemId: { item: {...}, quantity: number, reason: string } }
  const inventory = {};

  for (const { itemId, quantity } of desiredItems) {
    const item = db.getItemById(itemId);
    if (!item || quantity <= 0) continue;

    const recipe = db.getRecipeByItemId(itemId);

    if (!recipe || recipe.length === 0) {
      // Not craftable, just hold the item itself
      addToInventory(inventory, item, quantity, 'base item');
      continue;
    }

    // Calculate efficiency
    const slotsPerCraftedItem = 1 / item.stack_size;
    const slotsForMaterials = recipe.reduce((total, r) => {
      return total + (r.quantity / r.material_stack_size);
    }, 0);

    if (slotsPerCraftedItem <= slotsForMaterials) {
      // Crafted item is more efficient (or equal), hold the item
      addToInventory(inventory, item, quantity, 'craft ahead');
    } else {
      // Materials are more efficient, hold the materials
      for (const r of recipe) {
        const material = db.getItemById(r.material_id);
        const materialQty = r.quantity * quantity;
        addToInventory(inventory, material, materialQty, `for ${item.name}`);
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

  // Sort by category then name
  result.sort((a, b) => {
    if (a.item.category !== b.item.category) {
      return a.item.category.localeCompare(b.item.category);
    }
    return a.item.name.localeCompare(b.item.name);
  });

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

// Show planner page
router.get('/', (req, res) => {
  const craftableItems = getCraftableItems();
  const allItems = db.getAllItems();
  res.render('loadout/index', {
    craftableItems,
    allItems,
    results: null,
    selectedItems: []
  });
});

// Calculate loadout
router.post('/', (req, res) => {
  const { item_ids, quantities } = req.body;

  const craftableItems = getCraftableItems();
  const allItems = db.getAllItems();

  // Parse input
  const itemIdsArr = item_ids ? (Array.isArray(item_ids) ? item_ids : [item_ids]) : [];
  const quantitiesArr = quantities ? (Array.isArray(quantities) ? quantities : [quantities]) : [];

  const desiredItems = itemIdsArr.map((id, i) => ({
    itemId: parseInt(id),
    quantity: parseInt(quantitiesArr[i]) || 0
  })).filter(d => d.itemId && d.quantity > 0);

  // Track selected items for re-rendering
  const selectedItems = desiredItems.map(d => {
    const item = db.getItemById(d.itemId);
    return { item, quantity: d.quantity };
  });

  const results = calculateOptimalInventory(desiredItems);

  // Calculate total slots
  const totalSlots = results.reduce((sum, r) => sum + r.stacks, 0);

  res.render('loadout/index', {
    craftableItems,
    allItems,
    results,
    selectedItems,
    totalSlots
  });
});

module.exports = router;
