const express = require("express");
const router = express.Router();
const {
  getBooks,
  createBook,
  getBookById,
  updateBook,
  deleteBook,
  purchaseBook,
  downloadBook,
  borrowBook

} = require("../controllers/bookController");
const {protect, watcher , purchaser} = require("../middlewares/authMiddleware");
const {upload} = require("../utils/uploadService");

router.get("/", getBooks);
router.get("/:id", getBookById);

router.post("/", protect, watcher, upload.single("content"), createBook);
router.put("/:id", protect, watcher, upload.single("content"), updateBook);
router.delete("/:id", protect, watcher, deleteBook);

router.post("/:id/purchase", protect, purchaseBook);
router.get("/:id/download", protect, purchaser, downloadBook);

router.post("/:id/borrow", protect, borrowBook);

module.exports = router;
