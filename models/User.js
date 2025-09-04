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
    balance: {
      type: Number,
      default: 10000,
      min: 0,
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
        borrowedAt: {
          type: Date,
          default: Date.now,
        },
        expiresAt: {
          type: Date,
        },
        isActive: {
          type: Boolean,
          default: true,
        },
      },
    ],

    activeSubscriptions: [
      {
        plan: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Plan",
        },
        startDate: {
          type: Date,
          default: Date.now,
        },
        endDate: {
          type: Date,
        },
        isActive: {
          type: Boolean,
          default: true,
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

// Method to check if user has an active subscription for a category
userSchema.methods.hasActiveSubscription = function (categoryId = null) {
  const now = new Date();
  return this.activeSubscriptions.some((sub) => {
    if (!sub.isActive || sub.endDate <= now) {
      return false;
    }
    
    if (!categoryId) {
      return true; // Any active subscription
    }
    
    // Check if the subscription's plan has the specific category
    const planCategory = sub.plan.category || (sub.plan._id && sub.plan.category);
    return planCategory && planCategory.toString() === categoryId.toString();
  });
};

// Method to check if user owns a specific book
userSchema.methods.ownsBook = function (bookId) {
  return this.purchasedBooks.some(purchasedBook => {
    // Handle both ObjectId and populated object cases
    const id = purchasedBook._id || purchasedBook;
    return id.toString() === bookId.toString();
  });
};

// Method to check if user has borrowed a specific book
userSchema.methods.hasBorrowedBook = function (bookId) {
  const now = new Date();
  return this.borrowedBooks.some(
    (borrowed) => {
      // Handle both ObjectId and populated object cases
      const id = borrowed.book._id || borrowed.book;
      return id.toString() === bookId.toString() &&
        borrowed.isActive &&
        borrowed.expiresAt > now;
    }
  );
};

module.exports = mongoose.model("User", userSchema);
