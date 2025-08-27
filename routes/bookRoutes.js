const express = require("express");
const router = express.Router();
const {
  getBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  downloadBook,
  getBookCover,
  rateBook,
  searchBooks
} = require("../controllers/bookController");
const {protect, watcher, checkBookAccess} = require("../middlewares/authMiddleware");

const {upload} = require("../utils/uploadService");

// Public routes
router.get("/", getBooks);
router.get("/search", searchBooks);
router.get("/:id", getBookById);
router.get('/:id/cover', getBookCover);

router.post('/:id/rate', protect, rateBook);

router.get('/:id/download', protect, checkBookAccess, downloadBook);

router.post("/", protect, watcher, upload.single("content"), createBook);
router.put("/:id", protect, watcher, upload.single("content"), updateBook);
router.delete("/:id", protect, watcher, deleteBook);

router.post("/:id/purchase", protect, purchaseBook);
router.get("/:id/download", protect, purchaser, downloadBook);

router.post("/:id/borrow", protect, borrowBook);

module.exports = router;
