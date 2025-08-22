const mongoose = require("mongoose");

const BookSchema = new mongoose.Schema({
    title: { type: String, required: true },
    author: { type: String, required: true },
    description: { type: String },
    type:  { type: String, enum: ["novel", "short_story"], required: true },
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
    purchasePrice: { type: Number, required: true },
    borrowPrice:   { type: Number, required: true },
    isBorrowable: { type: Boolean, default: true },
    isPurchasable: { type: Boolean, default: true },
    book_image: { type: String, default: "https://placehold.co/300x400" }
}, { timestamps: true });

module.exports = mongoose.model("Book", BookSchema);
