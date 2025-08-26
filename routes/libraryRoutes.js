const express = require('express');
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

// User library operations
router.get('/my-books', protect, getMyBooks);
router.get('/access/:bookId', protect, getBookAccess);

// Book transactions
router.post('/purchase/:bookId', protect, purchaseBook);
router.post('/borrow/:bookId', protect, borrowBook);
router.post('/return/:bookId', protect, returnBook);

// Admin operations
router.post('/cleanup-expired', protect, watcher, cleanupExpiredBooks);

module.exports = router;