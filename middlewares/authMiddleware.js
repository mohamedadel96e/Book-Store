const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Inventory = require('../models/Inventory');
const { verifyToken } = require('../utils/jwtService');

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token using JWT service
      const decoded = verifyToken(token);

      // Get user from the token
      req.user = await User.findById(decoded.id).select('-password');
      next();
    } catch (error) {
      console.error(error);
      res.status(401);
      throw new Error('Not authorized');
    }
  }

  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token');
  }
});

// Middleware to check if user is a 'watcher' (admin)
const watcher = (req, res, next) => {
    if(req.user && req.user.role === 'watcher') {
        next()
    } else {
        res.status(401)
        throw new Error('Not authorized as a Watcher')
    }
}

const purchaser = (req, res, next) => {
  Inventory.findOne({ user: req.user.id, book: req.params.id })
    .then(inventory => {
      if (inventory) {
        next();
      } else {
        res.status(401).json({ error: "Not authorized as a Purchaser" });
      }
    })
    .catch(err => {
      res.status(500).json({ error: err.message });
    });
};

module.exports = { protect, watcher, purchaser };