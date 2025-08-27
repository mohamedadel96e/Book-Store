const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Book = require('../models/Book');
const Category = require('../models/Category');
const Plan = require('../models/Plan');
const Transaction = require('../models/Transaction');
const Inventory = require('../models/Inventory');

describe('Integration Tests - Full Workflow', () => {
  let testUser;
  let testBook1, testBook2, testBook3;
  let testCategory1, testCategory2;
  let authToken;

  beforeAll(async () => {
    // Create test categories
    testCategory1 = await Category.create({
      name: `Fiction ${Date.now()}`,
      description: 'Fiction books category'
    });
    
    testCategory2 = await Category.create({
      name: `Science ${Date.now()}`,
      description: 'Science books category'
    });

    // Create test books
    testBook1 = await Book.create({
      title: `Fiction Book ${Date.now()}`,
      description: 'A fiction book',
      author: 'Fiction Author',
      contentUrl: 'http://example.com/fiction.pdf',
      type: 'novel',
      categories: [testCategory1._id],
      isPurchasable: true,
      purchasePrice: 15.99,
      isBorrowable: true,
      borrowDurationDays: 14
    });

    testBook2 = await Book.create({
      title: `Science Book ${Date.now()}`,
      description: 'A science book',
      author: 'Science Author',
      contentUrl: 'http://example.com/science.pdf',
      type: 'essay',
      categories: [testCategory2._id],
      isPurchasable: true,
      purchasePrice: 25.99,
      isBorrowable: true,
      borrowDurationDays: 21
    });

    testBook3 = await Book.create({
      title: `Multi-Category Book ${Date.now()}`,
      description: 'A book in multiple categories',
      author: 'Multi Author',
      contentUrl: 'http://example.com/multi.pdf',
      type: 'novel',
      categories: [testCategory1._id, testCategory2._id],
      isPurchasable: true,
      purchasePrice: 19.99,
      isBorrowable: true,
      borrowDurationDays: 14
    });

    // Create test user with sufficient balance
    const userData = await global.testHelpers.createTestUser();
    userData.balance = 10000;
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
    if (testBook1) await Book.findByIdAndDelete(testBook1._id);
    if (testBook2) await Book.findByIdAndDelete(testBook2._id);
    if (testBook3) await Book.findByIdAndDelete(testBook3._id);
    if (testCategory1) await Category.findByIdAndDelete(testCategory1._id);
    if (testCategory2) await Category.findByIdAndDelete(testCategory2._id);
    await Plan.deleteMany({ user: testUser?._id });
    await Transaction.deleteMany({ user: testUser?._id });
    await Inventory.deleteMany({ user: testUser?._id });
  });

  describe('Complete User Journey', () => {
    it('should complete a full user journey: purchase, borrow, subscribe, and access books', async () => {
      // Step 1: Check initial library (should be empty)
      let libraryResponse = await request(app)
        .get('/api/library/my-books')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(libraryResponse.body.totalOwned).toBe(0);
      expect(libraryResponse.body.totalBorrowed).toBe(0);

      // Step 2: Purchase a book
      const purchaseResponse = await request(app)
        .post(`/api/library/${testBook1._id}/purchase`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(purchaseResponse.body.message).toBe('Book purchased successfully');
      const balanceAfterPurchase = purchaseResponse.body.remainingBalance;

      // Step 3: Check access to purchased book
      let accessResponse = await request(app)
        .get(`/api/library/access/${testBook1._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(accessResponse.body.accessType).toBe('owned');
      expect(accessResponse.body.canRead).toBe(true);
      expect(accessResponse.body.canPurchase).toBe(false);

      // Step 4: Try to borrow the owned book (should fail)
      await request(app)
        .post(`/api/library/${testBook1._id}/borrow`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      // Step 5: Borrow a different book
      const borrowResponse = await request(app)
        .post(`/api/library/${testBook2._id}/borrow`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(borrowResponse.body.message).toBe('Book borrowed successfully');
      expect(borrowResponse.body.expiresAt).toBeTruthy();

      // Step 6: Check library after purchase and borrow
      libraryResponse = await request(app)
        .get('/api/library/my-books')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(libraryResponse.body.totalOwned).toBe(1);
      expect(libraryResponse.body.totalBorrowed).toBe(1);

      // Step 7: Subscribe to a category plan
      const subscribeResponse = await request(app)
        .post('/api/plans/subscribe/category')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          categoryId: testCategory1._id,
          planType: '1_month'
        })
        .expect(200);

      expect(subscribeResponse.body.message).toBe('Successfully subscribed to category plan');

      // Step 8: Check access to books in subscribed category
      accessResponse = await request(app)
        .get(`/api/library/access/${testBook3._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Book3 is in category1, so should have subscription access
      expect(accessResponse.body.canRead).toBe(true);

      // Step 9: Subscribe to limited books plan
      const limitedPlanResponse = await request(app)
        .post('/api/plans/subscribe/limited')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planType: '5_books_month'
        })
        .expect(200);

      expect(limitedPlanResponse.body.message).toBe('Successfully subscribed to limited books plan');

      // Step 10: Check active subscriptions
      const subscriptionsResponse = await request(app)
        .get('/api/plans/my-subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(subscriptionsResponse.body.count).toBe(2); // Category + Limited plans

      // Step 11: Return borrowed book
      const returnResponse = await request(app)
        .post(`/api/library/${testBook2._id}/return`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(returnResponse.body.message).toBe('Book returned successfully');

      // Step 12: Check library after return
      libraryResponse = await request(app)
        .get('/api/library/my-books')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(libraryResponse.body.totalOwned).toBe(1);
      expect(libraryResponse.body.totalBorrowed).toBe(0);

      // Step 13: Add balance
      const addBalanceResponse = await request(app)
        .post('/api/plans/add-balance')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 500
        })
        .expect(200);

      expect(addBalanceResponse.body.message).toBe('Balance added successfully');

      // Step 14: Cancel one subscription
      const categoryPlan = subscriptionsResponse.body.activeSubscriptions.find(
        plan => plan.type === 'category_access'
      );
      
      const cancelResponse = await request(app)
        .post(`/api/plans/cancel/${categoryPlan._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(cancelResponse.body.message).toBe('Subscription cancelled successfully');

      // Step 15: Verify final state
      const finalSubscriptionsResponse = await request(app)
        .get('/api/plans/my-subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should only have limited books plan active now
      expect(finalSubscriptionsResponse.body.count).toBe(1);
      expect(finalSubscriptionsResponse.body.activeSubscriptions[0].type).toBe('limited_books');

      // Verify all transactions were recorded
      const transactions = await Transaction.find({ user: testUser._id });
      expect(transactions.length).toBeGreaterThanOrEqual(4); // Purchase + 2 plans + balance add

      // Verify inventory records
      const inventoryRecords = await Inventory.find({ user: testUser._id });
      expect(inventoryRecords.length).toBeGreaterThanOrEqual(2); // Purchase + borrow
    });
  });

  describe('Subscription-based borrowing workflow', () => {
    let newUser, newAuthToken;
    let categoryPlan, limitedPlan;

    beforeAll(async () => {
      // Create a new user for subscription testing
      const userData = await global.testHelpers.createTestUser();
      userData.balance = 5000;
      newUser = await User.create(userData);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: newUser.email,
          password: 'password123'
        });
      
      newAuthToken = loginResponse.body.token;
    });

    afterAll(async () => {
      if (newUser) await User.findByIdAndDelete(newUser._id);
      await Plan.deleteMany({ user: newUser?._id });
      await Transaction.deleteMany({ user: newUser?._id });
      await Inventory.deleteMany({ user: newUser?._id });
    });

    it('should allow borrowing with category subscription', async () => {
      // Subscribe to category plan
      const subscribeResponse = await request(app)
        .post('/api/plans/subscribe/category')
        .set('Authorization', `Bearer ${newAuthToken}`)
        .send({
          categoryId: testCategory1._id,
          planType: '1_month'
        })
        .expect(200);

      categoryPlan = subscribeResponse.body.plan;

      // Should be able to borrow books from subscribed category
      const borrowResponse = await request(app)
        .post(`/api/library/${testBook3._id}/borrow`)
        .set('Authorization', `Bearer ${newAuthToken}`)
        .expect(200);

      expect(borrowResponse.body.message).toBe('Book borrowed successfully');
      expect(borrowResponse.body.subscriptionUsed).toBe(categoryPlan._id);
      expect(borrowResponse.body.cost).toBe(0);
    });

    it('should allow borrowing with limited books subscription', async () => {
      // Subscribe to limited books plan
      const subscribeResponse = await request(app)
        .post('/api/plans/subscribe/limited')
        .set('Authorization', `Bearer ${newAuthToken}`)
        .send({
          planType: '5_books_month'
        })
        .expect(200);

      limitedPlan = subscribeResponse.body.plan;

      // Should be able to borrow books using limited plan
      const borrowResponse = await request(app)
        .post(`/api/library/${testBook2._id}/borrow`)
        .set('Authorization', `Bearer ${newAuthToken}`)
        .expect(200);

      expect(borrowResponse.body.message).toBe('Book borrowed successfully');
      expect(borrowResponse.body.subscriptionUsed).toBe(limitedPlan._id);
      expect(borrowResponse.body.cost).toBe(0);

      // Verify books used count increased
      const updatedPlan = await Plan.findById(limitedPlan._id);
      expect(updatedPlan.booksUsed).toBe(1);
    });

    it('should handle limited books plan exhaustion', async () => {
      // Exhaust the limited books plan (already used 1, plan has 5 books limit)
      for (let i = 0; i < 4; i++) {
        const tempBook = await Book.create({
          ...global.testHelpers.createTestBook(),
          categories: [testCategory2._id]
        });

        await request(app)
          .post(`/api/library/${tempBook._id}/borrow`)
          .set('Authorization', `Bearer ${newAuthToken}`)
          .expect(200);

        // Clean up
        await Book.findByIdAndDelete(tempBook._id);
      }

      // Now the plan should be exhausted
      const exhaustedPlan = await Plan.findById(limitedPlan._id);
      expect(exhaustedPlan.booksUsed).toBe(5);

      // Trying to borrow another book should still work (fall back to free borrowing)
      const tempBook = await Book.create({
        ...global.testHelpers.createTestBook(),
        categories: [testCategory2._id]
      });

      const borrowResponse = await request(app)
        .post(`/api/library/${tempBook._id}/borrow`)
        .set('Authorization', `Bearer ${newAuthToken}`)
        .expect(200);

      expect(borrowResponse.body.message).toBe('Book borrowed successfully');
      expect(borrowResponse.body.cost).toBe(0);

      // Clean up
      await Book.findByIdAndDelete(tempBook._id);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle concurrent purchase attempts', async () => {
      // Create a book with low stock (conceptually)
      const expensiveBook = await Book.create({
        ...global.testHelpers.createTestBook(),
        purchasePrice: 1000,
        categories: [testCategory1._id]
      });

      // First purchase should succeed
      const purchase1 = await request(app)
        .post(`/api/library/${expensiveBook._id}/purchase`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(purchase1.body.message).toBe('Book purchased successfully');

      // Second purchase should fail (already owned)
      const purchase2 = await request(app)
        .post(`/api/library/${expensiveBook._id}/purchase`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(purchase2.body.error).toBe('Book already purchased');

      // Clean up
      await Book.findByIdAndDelete(expensiveBook._id);
    });

    it('should handle invalid ObjectId formats gracefully', async () => {
      // Test various invalid ID formats
      const invalidIds = ['invalid', '123', 'not-an-objectid', ''];

      for (const invalidId of invalidIds) {
        await request(app)
          .get(`/api/library/access/${invalidId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400);

        await request(app)
          .post(`/api/library/${invalidId}/purchase`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400);

        await request(app)
          .post(`/api/plans/cancel/${invalidId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400);
      }
    });

    it('should handle database errors gracefully', async () => {
      // Test with malformed request data
      await request(app)
        .post('/api/plans/subscribe/category')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          categoryId: 'invalid-id',
          planType: '1_month'
        })
        .expect(400);

      await request(app)
        .post('/api/plans/add-balance')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 'not-a-number'
        })
        .expect(400);
    });
  });
});
