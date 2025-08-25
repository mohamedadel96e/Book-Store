const express = require("express");
const router = express.Router();
const { getPlans, borrowBook, categoryAccess } = require("../controllers/planController");
const { protect, watcher } = require("../middleware/authMiddleware");

router.get("/", protect, getPlans);
router.post("/borrow/:bookId", protect, borrowBook);
router.post("/category-access/:bookId", protect, categoryAccess);
router.get("/admin/all", protect, watcher, async (req, res) => {});

module.exports = router;
