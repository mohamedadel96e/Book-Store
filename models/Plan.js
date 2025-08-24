const mongoose = require("mongoose");

const PlanSchema = new mongoose.Schema('' +
    {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    type: { type: String, enum: ["category_access", "limited_books"], required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    bookLimit: { type: Number },
    booksUsed: { type: Number, default: 0 },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    real_price: { type: Number },
    discount_price: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model("Plan", PlanSchema);
