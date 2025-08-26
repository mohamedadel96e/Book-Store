const express = require('express');
const router = express.Router();
const {
  getCategories,
  getCategoryById,
  getBooksByCategory,
  createCategory,
  updateCategory,
  deleteCategory
} = require('../controllers/categoryController');
const { protect, watcher } = require('../middlewares/authMiddleware');

router.route('/')
  .get(getCategories)
  .post(protect, watcher, createCategory);

router.route('/:id')
  .get(getCategoryById)
  .put(protect, watcher, updateCategory)
  .delete(protect, watcher, deleteCategory);

router.get('/:id/books', getBooksByCategory);

module.exports = router;