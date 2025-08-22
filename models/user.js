const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    username:  { type: String, required: true, unique: true },
    email:     { type: String, required: true, unique: true },
    password:  { type: String, required: true },
    role:      { type: String, enum: ["user", "admin"], default: "user" },
    picture:{ type: String, default: "https://placehold.co/200x200" },
    plans: [{ type: mongoose.Schema.Types.ObjectId, ref: "Plan" }],
    inventory: [{ type: mongoose.Schema.Types.ObjectId, ref: "Inventory" }]
}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);
