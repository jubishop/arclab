# Agent Instructions

## Project Overview

This is an ARC Raiders item tracking web application built with Node.js, Express, EJS, and SQLite.

## Key Files

- `app.js` - Express server entry point
- `db/database.js` - Database queries and connection
- `db/schema.sql` - SQLite schema
- `routes/items.js` - CRUD routes for items

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

## Data Source

Item data from https://arcraiders.wiki/
