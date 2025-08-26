const express = require('express');
const router = express.Router();
const {
  getDashboardOverview,
  getUserAnalytics,
  getBookAnalytics,
  getSubscriptionAnalytics,
  getRevenueAnalytics
} = require('../controllers/analyticsController');
const { protect, watcher } = require('../middlewares/authMiddleware');

// All analytics routes require watcher role
router.use(protect, watcher);

router.get('/overview', getDashboardOverview);
router.get('/users', getUserAnalytics);
router.get('/books', getBookAnalytics);
router.get('/subscriptions', getSubscriptionAnalytics);
router.get('/revenue', getRevenueAnalytics);

module.exports = router;