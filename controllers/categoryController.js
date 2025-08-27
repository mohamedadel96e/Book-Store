const asyncHandler = require('express-async-handler');
const Category = require('../models/Category');
const Book = require('../models/Book');

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
const getCategories = asyncHandler(async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @desc    Get single category
// @route   GET /api/categories/:id
// @access  Public
const getCategoryById = asyncHandler(async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      res.status(404);
      throw new Error('Category not found');
    }
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @desc    Get books by category
// @route   GET /api/categories/:id/books
// @access  Public
const getBooksByCategory = asyncHandler(async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      res.status(404);
      throw new Error('Category not found');
    }

    const books = await Book.find({ categories: req.params.id })
      .populate('categories', 'name')
      .sort({ createdAt: -1 });

    res.json({
      category: category.name,
      books: books,
      count: books.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @desc    Create new category
// @route   POST /api/categories
// @access  Private/Watcher
const createCategory = asyncHandler(async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      res.status(400);
      throw new Error('Category name is required');
    }

    // Check if category already exists
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      res.status(400);
      throw new Error('Category already exists');
    }

    const category = await Category.create({
      name,
      description
    });

    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private/Watcher
const updateCategory = asyncHandler(async (req, res) => {
  try {
    const { name, description } = req.body;

    const category = await Category.findById(req.params.id);
    if (!category) {
      res.status(404);
      throw new Error('Category not found');
    }

    // Check if new name conflicts with existing category
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({ name });
      if (existingCategory) {
        res.status(400);
        throw new Error('Category name already exists');
      }
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      req.params.id,
      { name: name || category.name, description: description || category.description },
      { new: true }
    );

    res.json(updatedCategory);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private/Watcher
const deleteCategory = asyncHandler(async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      res.status(404);
      throw new Error('Category not found');
    }

    // Check if any books are using this category
    const booksUsingCategory = await Book.find({ categories: req.params.id });
    if (booksUsingCategory.length > 0) {
      res.status(400);
      throw new Error('Cannot delete category that is being used by books');
    }

    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = {
  getCategories,
  getCategoryById,
  getBooksByCategory,
  createCategory,
  updateCategory,
  deleteCategory
};