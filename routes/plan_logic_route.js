const express = require("express");
const router = express.Router();
const Plan = require("../models/Plan");
const Book = require("../models/Book");

// GET: Retrieve all plans
router.get("/", async (req, res) => {
    try
    {
        const plans = await Plan.find({ user: "TEMP_USER_ID" }).populate('category');
        res.json(plans);
    }
    catch (error)
    {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// POST:
// type one plans - borrow books
router.post("/borrow/:bookId", async (req, res) =>
{
    try {
        const book = await Book.findById(req.params.bookId).populate('categories');
        const plan = await Plan.findOne(
        {
            user: "TEMP_USER_ID",
            type: 'limited_books',
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
        });
        if (!plan) return res.status(400).json({ message: "No active limited books plan" });

        if (plan.booksUsed >= plan.bookLimit) return res.status(400).json({ message: "Book limit reached" });

        plan.booksUsed+=1;

        await plan.save();
        res.json({ message: `Book borrowed successfully: ${book.title}` });
    }
    catch (error)
    {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// POST:
// type two plans - category_access
router.post("/category-access/:bookId", async (req, res) =>
{
    try
    {
        const book = await Book.findById(req.params.bookId).populate('categories');
        const plan = await Plan.findOne(
            {
            user: "TEMP_USER_ID",
            type: 'category_access',
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
        }).populate('category');
        if (!plan) return res.status(400).json({ message: "No active category plan" });

        const allowed = book.categories.some(cat => cat._id.equals(plan.category._id));

        if(!allowed) return res.status(400).json({ message: "Book not included in your plan" });

        res.json({ message: `Book allowed in category plan: ${book.title}` });
    }
    catch (error)
    {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});
module.exports = router;
