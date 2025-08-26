const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Book = require('../models/Book');
const Plan = require('../models/Plan');
const Transaction = require('../models/Transaction');
const Inventory = require('../models/Inventory');

// @desc    Get dashboard overview statistics
// @route   GET /api/analytics/overview
// @access  Private/Watcher
const getDashboardOverview = asyncHandler(async (req, res) => {
  try {
    // Total counts
    const totalUsers = await User.countDocuments();
    const totalBooks = await Book.countDocuments();
    const activeSubscriptions = await Plan.countDocuments({ 
      endDate: { $gt: new Date() } 
    });

    // Revenue calculations
    const totalRevenue = await Transaction.aggregate([
      { $match: { type: { $in: ['purchase', 'plan', 'borrow'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const thisMonthRevenue = await Transaction.aggregate([
      {
        $match: {
          type: { $in: ['purchase', 'plan', 'borrow'] },
          createdAt: {
            $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Most popular books
    const popularBooks = await Inventory.aggregate([
      { $group: { _id: '$book', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'books',
          localField: '_id',
          foreignField: '_id',
          as: 'book'
        }
      },
      { $unwind: '$book' },
      {
        $project: {
          _id: 1,
          count: 1,
          title: '$book.title',
          author: '$book.author'
        }
      }
    ]);

    // Active users (users with recent activity)
    const activeUsers = await User.countDocuments({
      $or: [
        { 'borrowedBooks.borrowedAt': { $gte: new Date(Date.now() - 30*24*60*60*1000) } },
        { updatedAt: { $gte: new Date(Date.now() - 30*24*60*60*1000) } }
      ]
    });

    res.json({
      overview: {
        totalUsers,
        totalBooks,
        activeSubscriptions,
        activeUsers,
        totalRevenue: totalRevenue[0]?.total || 0,
        thisMonthRevenue: thisMonthRevenue[0]?.total || 0,
        popularBooks
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @desc    Get user activity statistics
// @route   GET /api/analytics/users
// @access  Private/Watcher
const getUserAnalytics = asyncHandler(async (req, res) => {
  try {
    // User registration over time (last 12 months)
    const userRegistrations = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 365*24*60*60*1000) }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // User balance distribution
    const balanceDistribution = await User.aggregate([
      {
        $bucket: {
          groupBy: '$balance',
          boundaries: [0, 10, 50, 100, 500, 1000],
          default: '1000+',
          output: { count: { $sum: 1 } }
        }
      }
    ]);

    // Users by role
    const usersByRole = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    res.json({
      userAnalytics: {
        registrations: userRegistrations,
        balanceDistribution,
        usersByRole
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @desc    Get book statistics
// @route   GET /api/analytics/books
// @access  Private/Watcher
const getBookAnalytics = asyncHandler(async (req, res) => {
  try {
    // Books by category
    const booksByCategory = await Book.aggregate([
      { $unwind: '$categories' },
      {
        $lookup: {
          from: 'categories',
          localField: 'categories',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: '$category' },
      {
        $group: {
          _id: '$category.name',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Books by type
    const booksByType = await Book.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    // Purchase vs Borrow statistics
    const purchaseStats = await Transaction.aggregate([
      { $match: { type: 'purchase' } },
      { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$amount' } } }
    ]);

    const borrowStats = await Inventory.aggregate([
      { $match: { ownershipType: 'borrowed' } },
      { $group: { _id: null, count: { $sum: 1 } } }
    ]);

    // Most borrowed/purchased books
    const mostPurchased = await Transaction.aggregate([
      { $match: { type: 'purchase', book: { $exists: true } } },
      { $group: { _id: '$book', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'books',
          localField: '_id',
          foreignField: '_id',
          as: 'book'
        }
      },
      { $unwind: '$book' },
      {
        $project: {
          _id: 1,
          count: 1,
          title: '$book.title',
          author: '$book.author',
          purchasePrice: '$book.purchasePrice'
        }
      }
    ]);

    const mostBorrowed = await Inventory.aggregate([
      { $match: { ownershipType: 'borrowed' } },
      { $group: { _id: '$book', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'books',
          localField: '_id',
          foreignField: '_id',
          as: 'book'
        }
      },
      { $unwind: '$book' },
      {
        $project: {
          _id: 1,
          count: 1,
          title: '$book.title',
          author: '$book.author'
        }
      }
    ]);

    res.json({
      bookAnalytics: {
        booksByCategory,
        booksByType,
        purchaseStats: purchaseStats[0] || { count: 0, revenue: 0 },
        borrowStats: borrowStats[0] || { count: 0 },
        mostPurchased,
        mostBorrowed
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @desc    Get subscription analytics
// @route   GET /api/analytics/subscriptions
// @access  Private/Watcher
const getSubscriptionAnalytics = asyncHandler(async (req, res) => {
  try {
    // Active subscriptions by type
    const activeByType = await Plan.aggregate([
      { $match: { endDate: { $gt: new Date() } } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    // Subscription revenue
    const subscriptionRevenue = await Transaction.aggregate([
      { $match: { type: 'plan' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Subscriptions over time (last 6 months)
    const subscriptionsOverTime = await Plan.aggregate([
      {
        $match: {
          startDate: { $gte: new Date(Date.now() - 180*24*60*60*1000) }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$startDate' },
            month: { $month: '$startDate' },
            type: '$type'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Category subscription popularity
    const categoryPopularity = await Plan.aggregate([
      { 
        $match: { 
          type: 'category_access',
          category: { $exists: true }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      { $unwind: '$categoryInfo' },
      {
        $group: {
          _id: '$categoryInfo.name',
          activeSubscriptions: {
            $sum: { $cond: [{ $gt: ['$endDate', new Date()] }, 1, 0] }
          },
          totalSubscriptions: { $sum: 1 }
        }
      },
      { $sort: { activeSubscriptions: -1 } }
    ]);

    res.json({
      subscriptionAnalytics: {
        activeByType,
        totalRevenue: subscriptionRevenue[0]?.total || 0,
        subscriptionsOverTime,
        categoryPopularity
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @desc    Get revenue analytics
// @route   GET /api/analytics/revenue
// @access  Private/Watcher
const getRevenueAnalytics = asyncHandler(async (req, res) => {
  try {
    // Revenue by type over time (last 12 months)
    const revenueOverTime = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 365*24*60*60*1000) },
          type: { $in: ['purchase', 'plan', 'borrow'] }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            type: '$type'
          },
          revenue: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Revenue by source
    const revenueBySource = await Transaction.aggregate([
      { $match: { type: { $in: ['purchase', 'plan', 'borrow'] } } },
      {
        $group: {
          _id: '$type',
          revenue: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Top revenue generating books
    const topRevenueBooks = await Transaction.aggregate([
      { $match: { type: 'purchase', book: { $exists: true } } },
      {
        $group: {
          _id: '$book',
          revenue: { $sum: '$amount' },
          purchases: { $sum: 1 }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'books',
          localField: '_id',
          foreignField: '_id',
          as: 'book'
        }
      },
      { $unwind: '$book' },
      {
        $project: {
          _id: 1,
          revenue: 1,
          purchases: 1,
          title: '$book.title',
          author: '$book.author'
        }
      }
    ]);

    res.json({
      revenueAnalytics: {
        revenueOverTime,
        revenueBySource,
        topRevenueBooks
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = {
  getDashboardOverview,
  getUserAnalytics,
  getBookAnalytics,
  getSubscriptionAnalytics,
  getRevenueAnalytics
};