const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Book = require('../models/Book');
const Category = require('../models/Category');
const Plan = require('../models/Plan');
const Transaction = require('../models/Transaction');

describe('Plan Routes', () => {
  let testUser;
  let testCategory;
  let authToken;

  beforeAll(async () => {
    // Create test category
    testCategory = await Category.create(global.testHelpers.createTestCategory());

    // Create test user with sufficient balance
    const userData = await global.testHelpers.createTestUser();
    userData.balance = 5000; // Ensure sufficient balance for all tests
    testUser = await User.create(userData);

    // Get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'password123'
      });
    
    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testUser) await User.findByIdAndDelete(testUser._id);
    if (testCategory) await Category.findByIdAndDelete(testCategory._id);
    await Plan.deleteMany({ user: testUser?._id });
    await Transaction.deleteMany({ user: testUser?._id });
  });

  describe('GET /api/plans/available', () => {
    it('should get available subscription plans', async () => {
      const response = await request(app)
        .get('/api/plans/available')
        .expect(200);

      expect(response.body).toHaveProperty('categoryAccess');
      expect(response.body).toHaveProperty('limitedBooks');
      expect(response.body.categoryAccess).toHaveProperty('description');
      expect(response.body.categoryAccess).toHaveProperty('plans');
      expect(response.body.categoryAccess).toHaveProperty('categories');
      expect(response.body.limitedBooks).toHaveProperty('description');
      expect(response.body.limitedBooks).toHaveProperty('plans');
      expect(Array.isArray(response.body.categoryAccess.categories)).toBe(true);
    });

    it('should not require authentication', async () => {
      await request(app)
        .get('/api/plans/available')
        .expect(200);
    });
  });

  describe('GET /api/plans/my-subscriptions', () => {
    it('should get user active subscriptions', async () => {
      const response = await request(app)
        .get('/api/plans/my-subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('activeSubscriptions');
      expect(response.body).toHaveProperty('count');
      expect(Array.isArray(response.body.activeSubscriptions)).toBe(true);
      expect(typeof response.body.count).toBe('number');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/plans/my-subscriptions')
        .expect(401);
    });
  });

  describe('POST /api/plans/subscribe/category', () => {
    it('should subscribe to category plan successfully', async () => {
      const initialBalance = testUser.balance;
      const planPrice = 15; // 1_month plan price
      
      const response = await request(app)
        .post('/api/plans/subscribe/category')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          categoryId: testCategory._id,
          planType: '1_month'
        })
        .expect(200);

      expect(response.body.message).toBe('Successfully subscribed to category plan');
      expect(response.body).toHaveProperty('plan');
      expect(response.body).toHaveProperty('remainingBalance');
      expect(response.body.remainingBalance).toBe(initialBalance - planPrice);
      expect(response.body.plan.type).toBe('category_access');
      expect(response.body.plan.category.toString()).toBe(testCategory._id.toString());

      // Verify plan was created
      const plan = await Plan.findById(response.body.plan._id);
      expect(plan).toBeTruthy();
      expect(plan.user.toString()).toBe(testUser._id.toString());

      // Verify transaction was created
      const transaction = await Transaction.findOne({
        user: testUser._id,
        plan: plan._id,
        type: 'plan'
      });
      expect(transaction).toBeTruthy();
      expect(transaction.amount).toBe(planPrice);

      // Verify user subscription was added
      const updatedUser = await User.findById(testUser._id);
      const subscription = updatedUser.activeSubscriptions.find(
        sub => sub.plan.toString() === plan._id.toString()
      );
      expect(subscription).toBeTruthy();
    });

    it('should not allow duplicate category subscription', async () => {
      const response = await request(app)
        .post('/api/plans/subscribe/category')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          categoryId: testCategory._id,
          planType: '1_month'
        })
        .expect(400);

      expect(response.body.error).toBe('You already have an active subscription for this category');
    });

    it('should require categoryId and planType', async () => {
      // Missing categoryId
      await request(app)
        .post('/api/plans/subscribe/category')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planType: '1_month'
        })
        .expect(400);

      // Missing planType
      await request(app)
        .post('/api/plans/subscribe/category')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          categoryId: testCategory._id
        })
        .expect(400);
    });

    it('should validate category exists', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post('/api/plans/subscribe/category')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          categoryId: fakeId,
          planType: '1_month'
        })
        .expect(404);

      expect(response.body.error).toBe('Category not found');
    });

    it('should validate plan type', async () => {
      const response = await request(app)
        .post('/api/plans/subscribe/category')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          categoryId: testCategory._id,
          planType: 'invalid_plan'
        })
        .expect(400);

      expect(response.body.error).toBe('Invalid plan type');
    });

    it('should check sufficient balance', async () => {
      // Create user with low balance
      const poorUser = await User.create({
        ...global.testHelpers.createTestUser(),
        balance: 5
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: poorUser.email,
          password: 'password123'
        });

      const poorUserToken = loginResponse.body.token;

      const response = await request(app)
        .post('/api/plans/subscribe/category')
        .set('Authorization', `Bearer ${poorUserToken}`)
        .send({
          categoryId: testCategory._id,
          planType: '1_month'
        })
        .expect(400);

      expect(response.body.error).toBe('Insufficient balance');

      // Cleanup
      await User.findByIdAndDelete(poorUser._id);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/plans/subscribe/category')
        .send({
          categoryId: testCategory._id,
          planType: '1_month'
        })
        .expect(401);
    });
  });

  describe('POST /api/plans/subscribe/limited', () => {
    it('should subscribe to limited books plan successfully', async () => {
      const initialBalance = testUser.balance;
      const planPrice = 10; // 5_books_month plan price
      
      const response = await request(app)
        .post('/api/plans/subscribe/limited')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planType: '5_books_month'
        })
        .expect(200);

      expect(response.body.message).toBe('Successfully subscribed to limited books plan');
      expect(response.body).toHaveProperty('plan');
      expect(response.body).toHaveProperty('remainingBalance');
      expect(response.body.remainingBalance).toBe(initialBalance - planPrice);
      expect(response.body.plan.type).toBe('limited_books');
      expect(response.body.plan.bookLimit).toBe(5);
      expect(response.body.plan.booksUsed).toBe(0);

      // Verify plan was created
      const plan = await Plan.findById(response.body.plan._id);
      expect(plan).toBeTruthy();
      expect(plan.user.toString()).toBe(testUser._id.toString());

      // Verify transaction was created
      const transaction = await Transaction.findOne({
        user: testUser._id,
        plan: plan._id,
        type: 'plan'
      });
      expect(transaction).toBeTruthy();
      expect(transaction.amount).toBe(planPrice);
    });

    it('should not allow duplicate limited books subscription', async () => {
      const response = await request(app)
        .post('/api/plans/subscribe/limited')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planType: '5_books_month'
        })
        .expect(400);

      expect(response.body.error).toBe('You already have an active limited books subscription');
    });

    it('should require planType', async () => {
      const response = await request(app)
        .post('/api/plans/subscribe/limited')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Plan type is required');
    });

    it('should validate plan type', async () => {
      const response = await request(app)
        .post('/api/plans/subscribe/limited')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planType: 'invalid_plan'
        })
        .expect(400);

      expect(response.body.error).toBe('Invalid plan type');
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/plans/subscribe/limited')
        .send({
          planType: '5_books_month'
        })
        .expect(401);
    });
  });

  describe('POST /api/plans/cancel/:planId', () => {
    let testPlan;

    beforeAll(async () => {
      // Create a test plan to cancel
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);
      
      testPlan = await Plan.create({
        user: testUser._id,
        type: 'category_access',
        category: testCategory._id,
        startDate: new Date(),
        endDate: endDate
      });
    });

    it('should cancel subscription successfully', async () => {
      const response = await request(app)
        .post(`/api/plans/cancel/${testPlan._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe('Subscription cancelled successfully');
      expect(response.body).toHaveProperty('plan');

      // Verify plan was cancelled
      const cancelledPlan = await Plan.findById(testPlan._id);
      expect(cancelledPlan.endDate.getTime()).toBeLessThanOrEqual(new Date().getTime());
    });

    it('should not allow cancelling already expired plan', async () => {
      const response = await request(app)
        .post(`/api/plans/cancel/${testPlan._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toBe('Subscription has already expired');
    });

    it('should not allow cancelling non-existent plan', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/plans/cancel/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toBe('Subscription not found');
    });

    it('should return 400 for invalid plan ID format', async () => {
      await request(app)
        .post('/api/plans/cancel/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/plans/cancel/${testPlan._id}`)
        .expect(401);
    });
  });

  describe('POST /api/plans/add-balance', () => {
    it('should add balance successfully', async () => {
      const initialBalance = testUser.balance;
      const amountToAdd = 100;

      const response = await request(app)
        .post('/api/plans/add-balance')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: amountToAdd
        })
        .expect(200);

      expect(response.body.message).toBe('Balance added successfully');
      expect(response.body.newBalance).toBe(initialBalance + amountToAdd);
      expect(response.body.amountAdded).toBe(amountToAdd);

      // Verify balance was updated
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.balance).toBe(initialBalance + amountToAdd);

      // Verify transaction was created
      const transaction = await Transaction.findOne({
        user: testUser._id,
        type: 'balance_added',
        amount: amountToAdd
      });
      expect(transaction).toBeTruthy();

      // Update testUser for other tests
      testUser.balance = updatedUser.balance;
    });

    it('should not allow invalid amounts', async () => {
      // Zero amount
      await request(app)
        .post('/api/plans/add-balance')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 0
        })
        .expect(400);

      // Negative amount
      await request(app)
        .post('/api/plans/add-balance')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: -50
        })
        .expect(400);

      // Missing amount
      await request(app)
        .post('/api/plans/add-balance')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/plans/add-balance')
        .send({
          amount: 100
        })
        .expect(401);
    });
  });
});
