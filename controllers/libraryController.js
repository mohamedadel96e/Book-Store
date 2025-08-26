const asyncHandler = require("express-async-handler");
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
      res.status(404);
      throw new Error("Book not found");
    }

    if (!book.isPurchasable) {
      res.status(400);
      throw new Error("This book is not available for purchase");
    }

    // Check if user already owns this book
    if (req.user.ownsBook(bookId)) {
      res.status(400);
      throw new Error("You already own this book");
    }

    // Check user balance
    if (req.user.balance < book.purchasePrice) {
      res.status(400);
      throw new Error("Insufficient balance");
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
    });

    // Create inventory record
    await Inventory.create({
      user: userId,
      book: bookId,
      ownershipType: "owned",
    });

    res.json({
      message: "Book purchased successfully",
      book: book,
      remainingBalance: user.balance,
    });
  } catch (error) {
    res.status(400).json({error: error.message});
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
      res.status(404);
      throw new Error("Book not found");
    }

    if (!book.isBorrowable) {
      res.status(400);
      throw new Error("This book is not available for borrowing");
    }

    // Check if user already owns this book
    if (req.user.ownsBook(bookId)) {
      res.status(400);
      throw new Error("You already own this book");
    }

    // Check if user has already borrowed this book
    if (req.user.hasBorrowedBook(bookId)) {
      res.status(400);
      throw new Error("You have already borrowed this book");
    }

    let canBorrow = false;
    let borrowCost = 0;
    let subscriptionUsed = null;

    // Check if user has active subscription for this book's category
    for (const category of book.categories) {
      const hasSubscription = req.user.hasActiveSubscription(
        category._id
      );
      if (hasSubscription) {
        // Find the specific subscription
        const activeSubscription = req.user.activeSubscriptions.find(
          (sub) => {
            const plan = sub.plan;
            return (
              sub.isActive &&
              sub.endDate > new Date() &&
              plan.category?.toString() === category._id.toString()
            );
          }
        );

        if (activeSubscription) {
          const plan = await Plan.findById(activeSubscription.plan);
          if (plan && plan.type === "category_access") {
            canBorrow = true;
            subscriptionUsed = plan._id;
            break;
          } else if (
            plan &&
            plan.type === "limited_books" &&
            plan.booksUsed < plan.bookLimit
          ) {
            canBorrow = true;
            subscriptionUsed = plan._id;
            // Update books used count
            plan.booksUsed += 1;
            await plan.save();
            break;
          }
        }
      }
    }

    // If no subscription covers this book, check for limited_books subscription
    if (!canBorrow) {
      const limitedPlan = await Plan.findOne({
        user: userId,
        type: "limited_books",
        endDate: {$gt: new Date()},
        $expr: {$lt: ["$booksUsed", "$bookLimit"]},
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
        res.status(400);
        throw new Error("Insufficient balance");
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
      res.status(404);
      throw new Error(
        "You have not borrowed this book or it has already been returned"
      );
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
      res.status(404);
      throw new Error("Book not found");
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
