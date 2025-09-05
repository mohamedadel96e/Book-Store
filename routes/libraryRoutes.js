const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const {
  purchaseBook,
  borrowBook,
  returnBook,
  getMyBooks,
  getBookAccess,
  cleanupExpiredBooks
} = require('../controllers/libraryController');
const { protect, watcher } = require('../middlewares/authMiddleware');

// Validation middleware for book ID
const validateBookId = (req, res, next) => {
  const { bookId } = req.params;
  if (!bookId || !mongoose.Types.ObjectId.isValid(bookId)) {
    return res.status(400).json({ error: 'Invalid book ID format' });
  }
  next();
};

// User library operations
router.get('/my-books', protect, getMyBooks);
router.get('/access/:bookId', protect, validateBookId, getBookAccess);

// Book transactions
router.post('/:bookId/purchase', protect, validateBookId, purchaseBook);
router.post('/:bookId/borrow', protect, validateBookId, borrowBook);
router.post('/:bookId/return', protect, validateBookId, returnBook);

// Admin operations
router.post('/cleanup-expired', protect, watcher, cleanupExpiredBooks);

module.exports = router;