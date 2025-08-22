const mongoose = require("mongoose");

const userSchema = mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Please add a username"],
      unique: true,
    },
    email: {
      type: String,
      required: [true, "Please add an email"],
      unique: true,
    },
    password: {
      type: String,
      required: [true, "Please add a password"],
    },
    role: {
      type: String,
      enum: ["user", "watcher"],
      default: "user",
    },
    purchasedBooks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Book",
      },
    ],
    borrowedBooks: [
      {
        book: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Book",
        },
        expiresAt: {
          type: Date,
        },
      },
    ],
    profileImage: {
      type: String,
      required: false,
    },
  },
  {timestamps: true}
);

module.exports = mongoose.model("User", userSchema);
