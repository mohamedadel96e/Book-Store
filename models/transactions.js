const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    book: { type: mongoose.Schema.Types.ObjectId, ref: "Book" },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan" },
    type: { type: String, enum: ["borrow", "purchase", "plan"], required: true },
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("Transaction", TransactionSchema);
