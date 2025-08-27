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

// Validation middleware for plan ID
const validatePlanId = (req, res, next) => {
  const { planId } = req.params;
  if (!planId || !planId.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ error: 'Invalid plan ID format' });
  }
  next();
};

// Public routes
router.get('/available', getAvailablePlans);

// Protected routes
router.use(protect);

router.get('/my-subscriptions', getMySubscriptions);
router.post('/subscribe/category', subscribeToCategoryPlan);
router.post('/subscribe/limited', subscribeToLimitedPlan);
router.post('/cancel/:planId', validatePlanId, cancelSubscription);
router.post('/add-balance', addBalance);

// Watcher only routes
router.post('/cleanup-expired', watcher, cleanupExpiredSubscriptions);

module.exports = router;

