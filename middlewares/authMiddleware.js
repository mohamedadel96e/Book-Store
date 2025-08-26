const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const User = require("../models/User");

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(" ")[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token
      req.user = await User.findById(decoded.id)
        .populate("purchasedBooks")
        .populate("borrowedBooks.book")
        .populate("activeSubscriptions.plan")
        .select("-password");

      if (!req.user) {
        res.status(401);
        throw new Error("Not authorized, user not found");
      }

      next();
    } catch (error) {
      console.log(error);
      res.status(401);
      throw new Error("Not authorized");
    }
  }

  if (!token) {
    res.status(401);
    throw new Error("Not authorized, no token");
  }
});

const watcher = asyncHandler(async (req, res, next) => {
  if (req.user && req.user.role === "watcher") {
    next();
  } else {
    res.status(403);
    throw new Error("Access denied. Watcher role required.");
  }
});

const userOrWatcher = asyncHandler(async (req, res, next) => {
  if (
    req.user &&
    (req.user.role === "user" || req.user.role === "watcher")
  ) {
    next();
  } else {
    res.status(403);
    throw new Error("Access denied. User or Watcher role required.");
  }
});

// Middleware to check if user owns or has access to a book
const checkBookAccess = asyncHandler(async (req, res, next) => {
  const bookId = req.params.id;
  const user = req.user;

  // Check if user owns the book
  if (user.ownsBook(bookId)) {
    req.accessType = "owned";
    return next();
  }

  // Check if user has borrowed the book
  if (user.hasBorrowedBook(bookId)) {
    req.accessType = "borrowed";
    return next();
  }

  // Check if user has subscription access
  const Book = require("../models/Book");
  const book = await Book.findById(bookId).populate("categories");

  if (book) {
    for (const category of book.categories) {
      if (user.hasActiveSubscription(category._id)) {
        req.accessType = "subscription";
        return next();
      }
    }
  }

  res.status(403);
  throw new Error("You do not have access to this book");
});

module.exports = {
  protect,
  watcher,
  userOrWatcher,
  checkBookAccess,
};
