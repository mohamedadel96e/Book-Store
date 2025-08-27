const mongoose = require("mongoose");

const planSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["category_access", "limited_books"],
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: function () {
        return this.type === "category_access";
      },
    },
    bookLimit: {
      type: Number,
      required: function () {
        return this.type === "limited_books";
      },
    },
    booksUsed: {
      type: Number,
      default: 0,
      required: function () {
        return this.type === "limited_books";
      },
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
planSchema.index({user: 1, type: 1, endDate: 1});
planSchema.index({endDate: 1});

module.exports = mongoose.model("Plan", planSchema);

