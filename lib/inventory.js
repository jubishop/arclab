/**
 * Inventory efficiency analysis utilities
 * Calculates whether it's more space-efficient to hold crafted items or materials
 */

/**
 * Calculate inventory efficiency for a craftable item
 * @param {Object} item - The craftable item with stack_size property
 * @param {Array} recipe - Array of recipe entries with quantity and material_stack_size
 * @returns {Object|null} Analysis result or null if not calculable
 */
function calculateInventoryEfficiency(item, recipe) {
  if (!recipe || recipe.length === 0 || !item.stack_size || item.stack_size <= 0) {
    return null;
  }

  // Slots needed for 1 crafted item
  const slotsPerCraftedItem = 1 / item.stack_size;

  // Slots needed for materials to craft 1 item
  const slotsForMaterials = recipe.reduce((total, r) => {
    return total + (r.quantity / r.material_stack_size);
  }, 0);

  // Determine which is more efficient
  if (slotsPerCraftedItem < slotsForMaterials) {
    // Crafted items are more space-efficient
    const ratio = slotsForMaterials / slotsPerCraftedItem;
    return {
      recommendation: 'craft',
      ratio: ratio.toFixed(2),
      slotsPerItem: slotsPerCraftedItem.toFixed(3),
      slotsForMaterials: slotsForMaterials.toFixed(3),
      message: `Craft ahead of time. Holding crafted items is ${ratio.toFixed(1)}x more space-efficient than holding materials.`
    };
  } else if (slotsForMaterials < slotsPerCraftedItem) {
    // Materials are more space-efficient
    const ratio = slotsPerCraftedItem / slotsForMaterials;
    return {
      recommendation: 'materials',
      ratio: ratio.toFixed(2),
      slotsPerItem: slotsPerCraftedItem.toFixed(3),
      slotsForMaterials: slotsForMaterials.toFixed(3),
      message: `Hold materials. Keeping materials is ${ratio.toFixed(1)}x more space-efficient than holding crafted items.`
    };
  } else {
    return {
      recommendation: 'equal',
      ratio: 1,
      slotsPerItem: slotsPerCraftedItem.toFixed(3),
      slotsForMaterials: slotsForMaterials.toFixed(3),
      message: 'No difference. Crafted items and materials take the same inventory space.'
    };
  }
}

module.exports = {
  calculateInventoryEfficiency
};
