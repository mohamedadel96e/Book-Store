const mongoose = require("mongoose");

const PlanSchema = new mongoose.Schema(
    {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    type: { type: String, enum: ["category_access", "limited_books"], required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    bookLimit: { type: Number }, // borrow
    booksUsed: { type: Number, default: 0 }, // borrow
    startDate: { type: Date, default: Date.now }, // borrow
    endDate: { type: Date }, // borrow
    real_price: { type: Number }, // purchase and borrow
    discount_price: { type: Number, required: true }, // purchase and borrow
}, { timestamps: true });
module.exports = mongoose.model("Plan", PlanSchema);
