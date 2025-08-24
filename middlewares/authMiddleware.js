const asyncHandler = require('express-async-handler');
const User = require('../models/User');
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

module.exports = { protect, watcher };