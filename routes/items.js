const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { calculateInventoryEfficiency } = require('../lib/inventory');

// List all items
router.get('/', (req, res) => {
  const items = db.getAllItems();
  res.render('items/index', { items, categories: db.CATEGORIES });
});

// New item form
router.get('/new', (req, res) => {
  const craftingMaterials = db.getCraftingMaterials();
  res.render('items/new', {
    categories: db.CATEGORIES,
    craftingMaterials,
    error: null
  });
});

// Create item
router.post('/', (req, res) => {
  const { name, stack_size, category, material_ids, quantities } = req.body;

  // Validate
  if (!name || !stack_size || !category) {
    const craftingMaterials = db.getCraftingMaterials();
    return res.render('items/new', {
      categories: db.CATEGORIES,
      craftingMaterials,
      error: 'Name, stack size, and category are required'
    });
  }

  if (!db.CATEGORIES.includes(category)) {
    const craftingMaterials = db.getCraftingMaterials();
    return res.render('items/new', {
      categories: db.CATEGORIES,
      craftingMaterials,
      error: 'Invalid category'
    });
  }

  try {
    const itemId = db.createItem(name.trim(), parseInt(stack_size), category);

    // Save recipe if materials provided
    if (material_ids && quantities) {
      const materialIdsArr = Array.isArray(material_ids) ? material_ids : [material_ids];
      const quantitiesArr = Array.isArray(quantities) ? quantities : [quantities];

      const materials = materialIdsArr.map((matId, i) => ({
        materialId: parseInt(matId),
        quantity: parseInt(quantitiesArr[i]) || 0
      })).filter(m => m.materialId && m.quantity > 0);

      if (materials.length > 0) {
        db.saveRecipe(itemId, materials);
      }
    }

    res.redirect(`/items/${itemId}`);
  } catch (err) {
    const craftingMaterials = db.getCraftingMaterials();
    res.render('items/new', {
      categories: db.CATEGORIES,
      craftingMaterials,
      error: err.message
    });
  }
});

// Show item
router.get('/:id', (req, res) => {
  const item = db.getItemById(req.params.id);
  if (!item) {
    return res.status(404).send('Item not found');
  }
  const recipe = db.getRecipeByItemId(item.id);
  const inventoryAnalysis = calculateInventoryEfficiency(item, recipe);

  res.render('items/show', { item, recipe, inventoryAnalysis });
});

// Edit item form
router.get('/:id/edit', (req, res) => {
  const item = db.getItemById(req.params.id);
  if (!item) {
    return res.status(404).send('Item not found');
  }
  const recipe = db.getRecipeByItemId(item.id);
  const craftingMaterials = db.getCraftingMaterials();
  res.render('items/edit', {
    item,
    recipe,
    categories: db.CATEGORIES,
    craftingMaterials,
    error: null
  });
});

// Update item
router.post('/:id', (req, res) => {
  const { name, stack_size, category, material_ids, quantities } = req.body;
  const itemId = parseInt(req.params.id);

  const item = db.getItemById(itemId);
  if (!item) {
    return res.status(404).send('Item not found');
  }

  // Validate
  if (!name || !stack_size || !category) {
    const recipe = db.getRecipeByItemId(itemId);
    const craftingMaterials = db.getCraftingMaterials();
    return res.render('items/edit', {
      item,
      recipe,
      categories: db.CATEGORIES,
      craftingMaterials,
      error: 'Name, stack size, and category are required'
    });
  }

  try {
    db.updateItem(itemId, name.trim(), parseInt(stack_size), category);

    // Update recipe
    const materialIdsArr = material_ids ? (Array.isArray(material_ids) ? material_ids : [material_ids]) : [];
    const quantitiesArr = quantities ? (Array.isArray(quantities) ? quantities : [quantities]) : [];

    const materials = materialIdsArr.map((matId, i) => ({
      materialId: parseInt(matId),
      quantity: parseInt(quantitiesArr[i]) || 0
    })).filter(m => m.materialId && m.quantity > 0);

    db.saveRecipe(itemId, materials);

    res.redirect(`/items/${itemId}`);
  } catch (err) {
    const recipe = db.getRecipeByItemId(itemId);
    const craftingMaterials = db.getCraftingMaterials();
    res.render('items/edit', {
      item,
      recipe,
      categories: db.CATEGORIES,
      craftingMaterials,
      error: err.message
    });
  }
});

// Delete item
router.post('/:id/delete', (req, res) => {
  const itemId = parseInt(req.params.id);
  try {
    db.deleteItem(itemId);
    res.redirect('/items');
  } catch (err) {
    res.status(400).send(`Cannot delete item: ${err.message}`);
  }
});

module.exports = router;
