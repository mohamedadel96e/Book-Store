const express = require('express');
const router = express.Router();
const {
  getAvailablePlans,
  subscribeToCategoryPlan,
  subscribeToLimitedPlan,
  getMySubscriptions,
  cancelSubscription,
  addBalance,
  cleanupExpiredSubscriptions
} = require('../controllers/planController');
const { protect, watcher } = require('../middlewares/authMiddleware');

// Public routes
router.get('/available', getAvailablePlans);

// Protected routes
router.use(protect);

router.get('/my-subscriptions', getMySubscriptions);
router.post('/subscribe/category', subscribeToCategoryPlan);
router.post('/subscribe/limited', subscribeToLimitedPlan);
router.post('/cancel/:planId', cancelSubscription);
router.post('/add-balance', addBalance);

// Watcher only routes
router.post('/cleanup-expired', watcher, cleanupExpiredSubscriptions);

module.exports = router;

