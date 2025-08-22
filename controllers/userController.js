const bcrypt = require('bcryptjs');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const { generateToken } = require('../utils/jwtService');
const { uploadImage } = require('../utils/uploadService');

// @desc    Register new user
// @route   POST /api/users
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  const { username, email, password, role } = req.body;

  if (!username || !email || !password) {
    res.status(400);
    throw new Error('Please add all fields');
  }

  // Check if user exists
  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
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
      _id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
});

// @desc    Authenticate a user
// @route   POST /api/users/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Check for user email
  const user = await User.findOne({ email });

  if (user && (await bcrypt.compare(password, user.password))) {
    res.json({
      _id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } else {
    res.status(400);
    throw new Error('Invalid credentials');
  }
});

// @desc    Get user data
// @route   GET /api/users/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  // req.user is available from the protect middleware
  res.status(200).json(req.user);
});


// @desc   Update User data Including the imageURL
// @route  PUT  /api/users
// @access Private
const updateUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  // Validate request
  if (!username || !email || !password) {
    res.status(400);
    throw new Error('Please add all fields');
  }

  // Find user and update
  const user = await User.findById(req.user.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Handle image upload if file is provided
  let imageURL = user.imageURL; // Keep existing image if no new file
  if (req.file) {
    imageData = await uploadImage(req.file);
    imageURL = imageData.secure_url;
  }

  // Update user fields
  user.username = username;
  user.email = email;
  user.password = password;
  user.imageURL = imageURL;

  await user.save();

  res.status(200).json({
    _id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    imageURL: user.imageURL,
  });
});

module.exports = {
  registerUser,
  loginUser,
  getMe,
  updateUser,
};