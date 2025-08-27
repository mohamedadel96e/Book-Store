const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const User = require('../models/User');
const Plan = require('../models/Plan');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');

// Predefined subscription plans
const SUBSCRIPTION_PLANS = {
  category_access: {
    '1_month': { duration: 30, price: 15 },
    '3_months': { duration: 90, price: 40 },
    '6_months': { duration: 180, price: 70 },
    '1_year': { duration: 365, price: 120 }
  },
  limited_books: {
    '5_books_month': { duration: 30, bookLimit: 5, price: 10 },
    '10_books_month': { duration: 30, bookLimit: 10, price: 18 },
    '20_books_month': { duration: 30, bookLimit: 20, price: 30 },
    '5_books_3months': { duration: 90, bookLimit: 15, price: 25 },
    '10_books_3months': { duration: 90, bookLimit: 30, price: 45 }
  }
};

// @desc    Get available subscription plans
// @route   GET /api/plans/available
// @access  Public
const getAvailablePlans = asyncHandler(async (req, res) => {
  try {
    const categories = await Category.find().select('_id name description');
    
    res.json({
      categoryAccess: {
        description: 'Unlimited access to all books in a specific category',
        plans: SUBSCRIPTION_PLANS.category_access,
        categories: categories
      },
      limitedBooks: {
        description: 'Access to a limited number of books across all categories',
        plans: SUBSCRIPTION_PLANS.limited_books
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @desc    Subscribe to a category access plan
// @route   POST /api/plans/subscribe/category
// @access  Private
const subscribeToCategoryPlan = asyncHandler(async (req, res) => {
  try {
    const { categoryId, planType } = req.body; // planType: '1_month', '3_months', etc.
    const userId = req.user._id;

    // Validate input
    if (!categoryId || !planType) {
      return res.status(400).json({error: "Category ID and plan type are required"});
    }

    // Validate category
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({error: "Category not found"});
    }

    // Validate plan type
    if (!SUBSCRIPTION_PLANS.category_access[planType]) {
      return res.status(400).json({error: "Invalid plan type"});
    }

  const planDetails = SUBSCRIPTION_PLANS.category_access[planType];

  // Check if user already has active subscription for this category
  const existingPlan = await Plan.findOne({
    user: userId,
    type: 'category_access',
    category: categoryId,
    endDate: { $gt: new Date() }
  });

  if (existingPlan) {
    return res.status(400).json({error: "You already have an active subscription for this category"});
  }

  // Check user balance
  const user = await User.findById(userId);
  if (user.balance < planDetails.price) {
    return res.status(400).json({error: "Insufficient balance"});
  }

  // Calculate dates
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(startDate.getDate() + planDetails.duration);

  // Create plan
  const plan = await Plan.create({
    user: userId,
    type: 'category_access',
    category: categoryId,
    startDate: startDate,
    endDate: endDate
  });

  // Update user balance and subscription
  user.balance -= planDetails.price;
  user.activeSubscriptions.push({
    plan: plan._id,
    startDate: startDate,
    endDate: endDate
  });
  await user.save();

  // Create transaction
  await Transaction.create({
    user: userId,
    plan: plan._id,
    type: 'plan',
    amount: planDetails.price
  });

  await plan.populate('category', 'name description');

  res.json({
    message: 'Successfully subscribed to category plan',
    plan: plan,
    remainingBalance: user.balance
  });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @desc    Subscribe to a limited books plan
// @route   POST /api/plans/subscribe/limited
// @access  Private
const subscribeToLimitedPlan = asyncHandler(async (req, res) => {
  try {
    const { planType } = req.body; // planType: '5_books_month', '10_books_month', etc.
    const userId = req.user._id;

    // Validate input
    if (!planType) {
      return res.status(400).json({error: "Plan type is required"});
    }

    // Validate plan type
    if (!SUBSCRIPTION_PLANS.limited_books[planType]) {
      return res.status(400).json({error: "Invalid plan type"});
    }

  const planDetails = SUBSCRIPTION_PLANS.limited_books[planType];

  // Check if user already has active limited books subscription
  const existingPlan = await Plan.findOne({
    user: userId,
    type: 'limited_books',
    endDate: { $gt: new Date() }
  });

  if (existingPlan) {
    return res.status(400).json({error: "You already have an active limited books subscription"});
  }

  // Check user balance
  const user = await User.findById(userId);
  if (user.balance < planDetails.price) {
    return res.status(400).json({error: "Insufficient balance"});
  }

  // Calculate dates
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(startDate.getDate() + planDetails.duration);

  // Create plan
  const plan = await Plan.create({
    user: userId,
    type: 'limited_books',
    bookLimit: planDetails.bookLimit,
    booksUsed: 0,
    startDate: startDate,
    endDate: endDate
  });

  // Update user balance and subscription
  user.balance -= planDetails.price;
  user.activeSubscriptions.push({
    plan: plan._id,
    startDate: startDate,
    endDate: endDate
  });
  await user.save();

  // Create transaction
  await Transaction.create({
    user: userId,
    plan: plan._id,
    type: 'plan',
    amount: planDetails.price
  });

  res.json({
    message: 'Successfully subscribed to limited books plan',
    plan: plan,
    remainingBalance: user.balance
  });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @desc    Get user's active subscriptions
// @route   GET /api/plans/my-subscriptions
// @access  Private
const getMySubscriptions = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;
    
    const activePlans = await Plan.find({
      user: userId,
      endDate: { $gt: new Date() }
    }).populate('category', 'name description');

    res.json({
      activeSubscriptions: activePlans,
      count: activePlans.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @desc    Cancel a subscription
// @route   POST /api/plans/cancel/:planId
// @access  Private
const cancelSubscription = asyncHandler(async (req, res) => {
  try {
    const planId = req.params.planId;
    const userId = req.user._id;

    if (!planId) {
      return res.status(400).json({error: "Plan ID is required"});
    }

    const plan = await Plan.findOne({ _id: planId, user: userId });
    if (!plan) {
      return res.status(404).json({error: "Subscription not found"});
    }

    if (plan.endDate <= new Date()) {
      return res.status(400).json({error: "Subscription has already expired"});
    }

    // End the subscription immediately
    plan.endDate = new Date();
    await plan.save();

    // Update user's active subscriptions
    const user = await User.findById(userId);
    const subscriptionIndex = user.activeSubscriptions.findIndex(
      sub => sub.plan.toString() === planId
    );

    if (subscriptionIndex !== -1) {
      user.activeSubscriptions[subscriptionIndex].isActive = false;
      user.activeSubscriptions[subscriptionIndex].endDate = new Date();
      await user.save();
    }

    res.json({
      message: 'Subscription cancelled successfully',
      plan: plan
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @desc    Add balance to user account (for testing, in production this would be payment gateway)
// @route   POST /api/plans/add-balance
// @access  Private
const addBalance = asyncHandler(async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user._id;

    if (!amount || amount <= 0) {
      return res.status(400).json({error: "Invalid amount"});
    }

    const user = await User.findById(userId);
    user.balance += amount;
    await user.save();

    // Create transaction record
    await Transaction.create({
      user: userId,
      type: 'balance_added',
      amount: amount
    });

    res.json({
      message: 'Balance added successfully',
      newBalance: user.balance,
      amountAdded: amount
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @desc    Clean up expired subscriptions
// @route   POST /api/plans/cleanup-expired
// @access  Private/Watcher
const cleanupExpiredSubscriptions = asyncHandler(async (req, res) => {
  try {
    const now = new Date();
    
    // Update expired plans
    const expiredPlans = await Plan.updateMany(
      { endDate: { $lt: now } },
      { $set: { isActive: false } }
    );

    // Update user subscriptions
    const expiredUserSubs = await User.updateMany(
      { 'activeSubscriptions.endDate': { $lt: now } },
      { $set: { 'activeSubscriptions.$[elem].isActive': false } },
      { arrayFilters: [{ 'elem.endDate': { $lt: now }, 'elem.isActive': true }] }
    );

    res.json({
      message: 'Expired subscriptions cleaned up',
      expiredPlans: expiredPlans.modifiedCount,
      expiredUserSubs: expiredUserSubs.modifiedCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = {
  getAvailablePlans,
  subscribeToCategoryPlan,
  subscribeToLimitedPlan,
  getMySubscriptions,
  cancelSubscription,
  addBalance,
  cleanupExpiredSubscriptions
};