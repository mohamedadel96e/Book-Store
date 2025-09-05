const express = require("express");
const router = express.Router();
const {
  getBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  downloadBook,
  streamBook,
  getBookCover,
  rateBook,
  searchBooks
} = require("../controllers/bookController");
const {protect, watcher, checkBookAccess, checkPurchaseAccess} = require("../middlewares/authMiddleware");

const {upload} = require("../utils/uploadService");

// Public routes
router.get("/", getBooks);
router.get("/search", searchBooks);
router.get("/:id", getBookById);
router.get('/:id/cover', getBookCover);

router.post('/:id/rate', protect, rateBook);

// Download route - requires purchase access only
router.get('/:id/download', protect, checkPurchaseAccess, downloadBook);

// Stream route - allows both purchased and borrowed access
router.get('/:id/stream', protect, checkBookAccess, streamBook);

router.post("/", protect, watcher, upload.single("content"), createBook);
router.put("/:id", protect, watcher, upload.single("content"), updateBook);
router.delete("/:id", protect, watcher, deleteBook);

module.exports = router;
