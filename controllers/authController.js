const bcrypt = require('bcryptjs');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Book = require('../models/Book');
const Category = require('../models/Category');
const Subscription = require('../models/Subscription');
const { generateToken } = require('../utils/jwtService');
const { uploadImage } = require('../utils/uploadService');

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  const { username, email, password, role } = req.body;

  if (!username || !email || !password) {
    res.status(400);
    throw new Error('Please add all fields');
  }

  // Check if user exists
  const userExists = await User.findOne({ 
    $or: [{ email }, { username }] 
  });
  
  if (userExists) {
    res.status(400);
    throw new Error('User already exists with this email or username');
  }

  // Hash password
  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Create user
  const user = await User.create({
    username,
    email,
    password: hashedPassword,
    role: role || 'user' // Default to 'user' if role is not provided
  });

  if (user) {
    res.status(201).json({
      success: true,
      data: {
        _id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      },
    });
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
});

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error('Please provide email and password');
  }

  // Check for user email
  const user = await User.findOne({ email }).select('+password');

  if (user && (await bcrypt.compare(password, user.password))) {
    res.json({
      success: true,
      data: {
        _id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
        token: generateToken(user._id),
      },
    });
  } else {
    res.status(401);
    throw new Error('Invalid credentials');
  }
});

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id)
    .populate('purchasedBooks', 'title author type coverImageUrl')
    .populate('borrowedBooks.book', 'title author type coverImageUrl')
    .populate('subscriptions.categories', 'name description');

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = asyncHandler(async (req, res) => {
  const { username, email, currentPassword, newPassword } = req.body;

  // Find user
  const user = await User.findById(req.user.id).select('+password');
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // If changing password, verify current password
  if (newPassword) {
    if (!currentPassword) {
      res.status(400);
      throw new Error('Current password is required to change password');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      res.status(400);
      throw new Error('Current password is incorrect');
    }

    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);
  }

  // Update other fields
  if (username) user.username = username;
  if (email) {
    // Check if email is already taken by another user
    const emailExists = await User.findOne({ 
      email, 
      _id: { $ne: user._id } 
    });
    if (emailExists) {
      res.status(400);
      throw new Error('Email already in use');
    }
    user.email = email;
  }

  // Handle profile image upload
  if (req.file) {
    const imageData = await uploadImage(req.file.buffer);
    user.profileImage = imageData.secure_url;
  }

  await user.save();

  res.status(200).json({
    success: true,
    data: {
      _id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage,
    },
  });
});

// @desc    Logout user (client-side token removal)
// @route   POST /api/auth/logout
// @access  Private
const logout = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'User logged out successfully'
  });
});

// @desc    Check user access to a specific book
// @route   GET /api/auth/access/:bookId
// @access  Private
const checkBookAccess = asyncHandler(async (req, res) => {
  const { bookId } = req.params;
  const userId = req.user.id;

  const book = await Book.findById(bookId).populate('categories');
  if (!book) {
    res.status(404);
    throw new Error('Book not found');
  }

  const user = await User.findById(userId)
    .populate('subscriptions.categories')
    .populate('borrowedBooks.book');

  let access = {
    canView: false,
    canDownload: false,
    accessType: null, // 'purchased', 'borrowed', 'subscription'
    expiresAt: null
  };

  // Check if user purchased the book
  if (user.purchasedBooks.includes(bookId)) {
    access = {
      canView: true,
      canDownload: true,
      accessType: 'purchased',
      expiresAt: null
    };
  }

  // Check if user borrowed the book (and it's not expired)
  if (!access.canView) {
    const borrowedBook = user.borrowedBooks.find(bb => 
      bb.book._id.toString() === bookId && bb.expiresAt > new Date()
    );
    if (borrowedBook) {
      access = {
        canView: true,
        canDownload: false,
        accessType: 'borrowed',
        expiresAt: borrowedBook.expiresAt
      };
    }
  }

  // Check if user has active subscription that covers this book
  if (!access.canView) {
    const activeSubscriptions = user.subscriptions.filter(sub => 
      sub.expiresAt > new Date()
    );

    for (const subscription of activeSubscriptions) {
      if (subscription.type === 'category_access') {
        // Check if book's categories are covered by subscription
        const bookCategoryIds = book.categories.map(cat => cat._id.toString());
        const subCategoryIds = subscription.categories.map(cat => cat._id.toString());
        
        const hasAccess = bookCategoryIds.some(catId => subCategoryIds.includes(catId));
        
        if (hasAccess) {
          access = {
            canView: true,
            canDownload: false,
            accessType: 'subscription',
            expiresAt: subscription.expiresAt
          };
          break;
        }
      } else if (subscription.type === 'credit_pack' && subscription.creditsUsed < subscription.creditLimit) {
        // User can claim this book with credits
        access.canClaim = true;
      }
    }
  }

  res.status(200).json({
    success: true,
    data: {
      book: {
        _id: book._id,
        title: book.title,
        author: book.author,
        type: book.type
      },
      access
    }
  });
});

// @desc    Get user's library (purchased + borrowed + subscription books)
// @route   GET /api/auth/library
// @access  Private
const getUserLibrary = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  const user = await User.findById(userId)
    .populate({
      path: 'purchasedBooks',
      select: 'title author type coverImageUrl categories createdAt',
      populate: { path: 'categories', select: 'name' }
    })
    .populate({
      path: 'borrowedBooks.book',
      select: 'title author type coverImageUrl categories createdAt',
      populate: { path: 'categories', select: 'name' }
    })
    .populate({
      path: 'subscriptions',
      populate: { path: 'categories', select: 'name description' }
    });

  // Get borrowed books that haven't expired
  const activeBorrowedBooks = user.borrowedBooks
    .filter(bb => bb.expiresAt > new Date())
    .map(bb => ({
      ...bb.book.toObject(),
      borrowedAt: bb.borrowedAt,
      expiresAt: bb.expiresAt,
      accessType: 'borrowed'
    }));

  // Get purchased books
  const purchasedBooks = user.purchasedBooks.map(book => ({
    ...book.toObject(),
    accessType: 'purchased'
  }));

  // Get active subscriptions
  const activeSubscriptions = user.subscriptions.filter(sub => 
    sub.expiresAt > new Date()
  );

  // Get books available through subscriptions
  let subscriptionBooks = [];
  if (activeSubscriptions.length > 0) {
    const categoryIds = activeSubscriptions
      .filter(sub => sub.type === 'category_access')
      .flatMap(sub => sub.categories.map(cat => cat._id));

    if (categoryIds.length > 0) {
      const availableBooks = await Book.find({
        categories: { $in: categoryIds }
      }).populate('categories', 'name');

      subscriptionBooks = availableBooks.map(book => ({
        ...book.toObject(),
        accessType: 'subscription'
      }));
    }
  }

  res.status(200).json({
    success: true,
    data: {
      purchased: purchasedBooks,
      borrowed: activeBorrowedBooks,
      subscription: subscriptionBooks,
      activeSubscriptions
    }
  });
});

module.exports = {
  registerUser,
  loginUser,
  getMe,
  updateProfile,
  logout,
  checkBookAccess,
  getUserLibrary,
};