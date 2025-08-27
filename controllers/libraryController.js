const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const User = require("../models/User");
const Book = require("../models/Book");
const Plan = require("../models/Plan");
const Transaction = require("../models/Transaction");
const Inventory = require("../models/Inventory");

// @desc    Purchase a book
// @route   POST /api/library/purchase/:bookId
// @access  Private
const purchaseBook = asyncHandler(async (req, res) => {
  try {
    const bookId = req.params.bookId;
    const userId = req.user._id;

    // Find the book
    const book = await Book.findById(bookId).populate("categories");
    if (!book) {
      return res.status(404).json({error: "Book not found"});
    }

    if (!book.isPurchasable) {
      return res.status(400).json({error: "This book is not available for purchase"});
    }

    // Check if user already owns this book
    if (req.user.ownsBook(bookId)) {
      return res.status(400).json({error: "Book already purchased"});
    }

    // Check user balance
    if (req.user.balance < book.purchasePrice) {
      return res.status(400).json({error: "Insufficient balance"});
    }

    // Process purchase
    const user = await User.findById(userId);
    user.balance -= book.purchasePrice;
    user.purchasedBooks.push(bookId);
    await user.save();

    // Create transaction record
    await Transaction.create({
      user: userId,
      book: bookId,
      type: "purchase",
      amount: book.purchasePrice,
      transactionDate: new Date()
    });

    // Create inventory record
    await Inventory.create({
      user: userId,
      book: bookId,
      ownershipType: "owned",
    });

    res.status(201).json({
      message: "Book purchased successfully",
      book: book,
      remainingBalance: user.balance,
    });
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// @desc    Borrow a book
// @route   POST /api/library/borrow/:bookId
// @access  Private
const borrowBook = asyncHandler(async (req, res) => {
  try {
    const bookId = req.params.bookId;
    const userId = req.user._id;

    // Find the book
    const book = await Book.findById(bookId).populate("categories");
    if (!book) {
      return res.status(404).json({error: "Book not found"});
    }

    if (!book.isBorrowable) {
      return res.status(400).json({error: "This book is not available for borrowing"});
    }

    // Check if user already owns this book
    if (req.user.ownsBook(bookId)) {
      return res.status(400).json({error: "You already own this book"});
    }

    // Check if user has already borrowed this book
    if (req.user.hasBorrowedBook(bookId)) {
      return res.status(400).json({ error: "Book already borrowed" });
    }

    let canBorrow = false;
    let borrowCost = 0;
    let subscriptionUsed = null;

    // Check if user has active subscription for this book's category
    for (const category of book.categories) {
      // Check for category access subscription
      const categorySubscription = await Plan.findOne({
        user: userId,
        type: "category_access",
        category: category._id,
        endDate: { $gt: new Date() },
        isActive: true
      });

      if (categorySubscription) {
        canBorrow = true;
        subscriptionUsed = categorySubscription._id;
        break;
      }
    }

    // If no category subscription found, check for limited books subscription
    if (!canBorrow) {
      const limitedPlan = await Plan.findOne({
        user: userId,
        type: "limited_books",
        endDate: { $gt: new Date() },
        isActive: true,
        $expr: { $lt: ["$booksUsed", "$bookLimit"] },
      });

      if (limitedPlan) {
        canBorrow = true;
        subscriptionUsed = limitedPlan._id;
        limitedPlan.booksUsed += 1;
        await limitedPlan.save();
      }
    }

    // If still can't borrow via subscription, allow direct borrowing (free for now)
    if (!canBorrow) {
      canBorrow = true;
      borrowCost = 0; // Could set a borrowing fee here
    }

    // Calculate expiry date
    const expiryDate = new Date();
    expiryDate.setDate(
      expiryDate.getDate() + (book.borrowDurationDays || 14)
    );

    // Process borrowing
    const user = await User.findById(userId);
    if (borrowCost > 0) {
      if (user.balance < borrowCost) {
        return res.status(400).json({error: "Insufficient balance"});
      }
      user.balance -= borrowCost;
    }

    user.borrowedBooks.push({
      book: bookId,
      expiresAt: expiryDate,
      borrowedAt: new Date(),
    });
    await user.save();

    // Create transaction record if there was a cost
    if (borrowCost > 0) {
      await Transaction.create({
        user: userId,
        book: bookId,
        type: "borrow",
        amount: borrowCost,
      });
    }

    // Create inventory record
    await Inventory.create({
      user: userId,
      book: bookId,
      ownershipType: "borrowed",
    });

    res.json({
      message: "Book borrowed successfully",
      book: book,
      expiresAt: expiryDate,
      subscriptionUsed: subscriptionUsed,
      cost: borrowCost,
      remainingBalance: user.balance,
    });
  } catch (error) {
    res.status(400).json({error: error.message});
  }
});

// @desc    Return a borrowed book
// @route   POST /api/library/return/:bookId
// @access  Private
const returnBook = asyncHandler(async (req, res) => {
  try {
    const bookId = req.params.bookId;
    const userId = req.user._id;

    const user = await User.findById(userId);
    const borrowedBookIndex = user.borrowedBooks.findIndex(
      (borrowed) =>
        borrowed.book.toString() === bookId && borrowed.isActive
    );

    if (borrowedBookIndex === -1) {
      return res.status(404).json({
        error: "You have not borrowed this book or it has already been returned"
      });
    }

    // Mark as inactive/returned
    user.borrowedBooks[borrowedBookIndex].isActive = false;
    await user.save();

    // Update inventory record
    await Inventory.findOneAndUpdate(
      {user: userId, book: bookId, ownershipType: "borrowed"},
      {updatedAt: new Date()}
    );

    const book = await Book.findById(bookId);
    res.json({
      message: "Book returned successfully",
      book: book,
    });
  } catch (error) {
    res.status(400).json({error: error.message});
  }
});

// @desc    Get user's library (owned + borrowed books)
// @route   GET /api/library/my-books
// @access  Private
const getMyBooks = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;

    // Get user with populated books
    const user = await User.findById(userId)
      .populate({
        path: "purchasedBooks",
        populate: {path: "categories", select: "name"},
      })
      .populate({
        path: "borrowedBooks.book",
        populate: {path: "categories", select: "name"},
      });

    // Filter active borrowed books
    const activeBorrowedBooks = user.borrowedBooks.filter(
      (borrowed) =>
        borrowed.isActive && borrowed.expiresAt > new Date()
    );

    res.json({
      purchasedBooks: user.purchasedBooks,
      borrowedBooks: activeBorrowedBooks,
      totalOwned: user.purchasedBooks.length,
      totalBorrowed: activeBorrowedBooks.length,
    });
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// @desc    Get book access status for user
// @route   GET /api/library/access/:bookId
// @access  Private
const getBookAccess = asyncHandler(async (req, res) => {
  try {
    const bookId = req.params.bookId;
    const userId = req.user._id;

    const book = await Book.findById(bookId).populate("categories");
    if (!book) {
      return res.status(404).json({error: "Book not found"});
    }

    const hasOwned = req.user.ownsBook(bookId);
    const hasBorrowed = req.user.hasBorrowedBook(bookId);
    const hasSubscription = book.categories.some((cat) =>
      req.user.hasActiveSubscription(cat._id)
    );

    let accessType = "none";
    let expiresAt = null;

    if (hasOwned) {
      accessType = "owned";
    } else if (hasBorrowed) {
      accessType = "borrowed";
      const borrowedBook = req.user.borrowedBooks.find(
        (borrowed) =>
          borrowed.book.toString() === bookId && borrowed.isActive
      );
      expiresAt = borrowedBook ? borrowedBook.expiresAt : null;
    } else if (hasSubscription) {
      accessType = "subscription";
    }

    res.json({
      bookId: bookId,
      accessType: accessType,
      canRead: hasOwned || hasBorrowed || hasSubscription,
      canPurchase: book.isPurchasable && !hasOwned,
      canBorrow: book.isBorrowable && !hasOwned && !hasBorrowed,
      expiresAt: expiresAt,
      book: book,
    });
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// @desc    Clean up expired borrowed books
// @route   POST /api/library/cleanup-expired
// @access  Private/Watcher
const cleanupExpiredBooks = asyncHandler(async (req, res) => {
  try {
    const now = new Date();

    const result = await User.updateMany(
      {"borrowedBooks.expiresAt": {$lt: now}},
      {$set: {"borrowedBooks.$[elem].isActive": false}},
      {
        arrayFilters: [
          {"elem.expiresAt": {$lt: now}, "elem.isActive": true},
        ],
      }
    );

    res.json({
      message: "Expired borrowed books cleaned up",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

module.exports = {
  purchaseBook,
  borrowBook,
  returnBook,
  getMyBooks,
  getBookAccess,
  cleanupExpiredBooks,
};
