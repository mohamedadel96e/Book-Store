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

router.get("/", getBooks);
router.get("/:id", getBookById);

router.post("/", protect, watcher, createBook);
router.put("/:id", protect, watcher, updateBook);
router.delete("/:id", protect, watcher, deleteBook);

module.exports = router;
