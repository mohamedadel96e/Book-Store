const express = require("express");
const router = express.Router();
const { createCategory } = require("../controllers/categoryController");
const { protect, watcher } = require("../middleware/authMiddleware");

router.post("/", protect, watcher, createCategory);

module.exports = router;
