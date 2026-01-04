const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Show gun detail
router.get('/:id', (req, res) => {
  const gun = db.getGunById(parseInt(req.params.id));
  if (!gun) {
    return res.status(404).send('Gun not found');
  }

  // Get recipes for each level
  const levelRecipes = {};
  for (const level of gun.levels) {
    levelRecipes[level.level] = db.getGunLevelRecipe(gun.id, level.level);
  }

  res.render('guns/show', { gun, levelRecipes });
});

module.exports = router;
