const mongoose = require("mongoose");

const InventorySchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    book: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true },
    ownershipType: { type: String, enum: ["borrowed", "owned"], required: true },
}, { timestamps: true });
module.exports = mongoose.model("Inventory", InventorySchema);
