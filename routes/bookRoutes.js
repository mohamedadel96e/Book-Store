const express = require("express");
const router = express.Router();
const {
  getBooks,
  createBook,
  getBookById,
  updateBook,
  deleteBook,
} = require("../controllers/bookController");
const {protect, watcher} = require("../middlewares/authMiddleware");
const {upload} = require("../utils/uploadService");

router.get("/", getBooks);
router.get("/:id", getBookById);

router.post("/", protect, watcher, upload.single("content"), createBook);
router.put("/:id", protect, watcher, upload.single("content"), updateBook);
router.delete("/:id", protect, watcher, deleteBook);

module.exports = router;
