# Agent Instructions

## Project Overview

This is an ARC Raiders item tracking web application built with Node.js, Express, EJS, and SQLite.

## Key Files

- `app.js` - Express server entry point
- `db/database.js` - Database queries and connection
- `db/schema.sql` - SQLite schema
- `routes/items.js` - CRUD routes for items
- `lib/inventory.js` - Inventory efficiency analysis utilities

## Database Schema

Two tables:
- `items` - id, name, stack_size, category, created_at
- `recipes` - id, item_id, material_id, quantity

Categories: gun, gun mod, augment, quick use, crafting material, ammunition, shield

## Common Tasks

### Adding items via code
```javascript
const db = require('./db/database');
db.createItem('Item Name', stackSize, 'category');
```

### Adding recipes
```javascript
db.saveRecipe(itemId, [
  { materialId: 1, quantity: 5 },
  { materialId: 2, quantity: 3 }
]);
```

### Running the app
```bash
npm start
```

## Inventory Efficiency Analysis

The `lib/inventory.js` module provides utilities for calculating whether it's more space-efficient to hold crafted items or their raw materials.

### calculateInventoryEfficiency(item, recipe)

Compares inventory slots needed for crafted items vs materials.

**Parameters:**
- `item` - Item object with `stack_size` property
- `recipe` - Array of recipe entries with `quantity` and `material_stack_size`

**Returns:** Object with analysis or `null` if not calculable

```javascript
const { calculateInventoryEfficiency } = require('./lib/inventory');

const item = { stack_size: 5 };
const recipe = [
  { quantity: 2, material_stack_size: 10 },
  { quantity: 3, material_stack_size: 15 }
];

const analysis = calculateInventoryEfficiency(item, recipe);
// Returns:
// {
//   recommendation: 'craft' | 'materials' | 'equal',
//   ratio: '2.50',
//   slotsPerItem: '0.200',
//   slotsForMaterials: '0.400',
//   message: 'Craft ahead of time. Holding crafted items is 2.0x more space-efficient...'
// }
```

**Calculation logic:**
- Slots per crafted item = `1 / item.stack_size`
- Slots for materials = `sum(quantity / material_stack_size)` for each material
- If crafted slots < material slots: recommend crafting ahead
- If material slots < crafted slots: recommend holding materials

## Data Source

Item data from https://arcraiders.wiki/
