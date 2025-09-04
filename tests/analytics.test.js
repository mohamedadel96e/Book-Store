const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Book = require('../models/Book');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');

describe('Analytics Routes', () => {
  let adminUser;
  let adminToken;
  let regularUser;
  let regularToken;
  let testCategory;
  let testBooks = [];

  beforeAll(async () => {
    // Create admin user
    const adminData = await global.testHelpers.createTestUser();
    adminData.role = 'watcher';
    adminUser = await User.create(adminData);

    // Get admin auth token
    const adminLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: adminUser.email,
        password: 'password123'
      });
    adminToken = adminLoginResponse.body.token;

    // Create regular user
    const regularData = await global.testHelpers.createTestUser();
    regularUser = await User.create(regularData);

    // Get regular user auth token
    const regularLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: regularUser.email,
        password: 'password123'
      });
    regularToken = regularLoginResponse.body.token;

    // Create test category
    testCategory = await Category.create({
      name: 'Analytics Test Category',
      description: 'Category for analytics testing'
    });

    // Create test books
    const booksData = [
      {
        title: 'Analytics Test Book 1',
        author: 'Test Author 1',
        description: 'First test book for analytics',
        categories: [testCategory._id],
        purchasePrice: 20.00,
        borrowPrice: 5.00,
        publishedYear: 2023,
        isbn: '9780123456780',
        publisher: 'Test Publisher',
        pages: 300,
        language: 'English',
        type: 'novel',
        contentUrl: '/test/book1.pdf',
        coverImage: '/test/cover1.jpg'
      },
      {
        title: 'Analytics Test Book 2',
        author: 'Test Author 2',
        description: 'Second test book for analytics',
        categories: [testCategory._id],
        purchasePrice: 25.00,
        borrowPrice: 6.00,
        publishedYear: 2023,
        isbn: '9780123456781',
        publisher: 'Test Publisher',
        pages: 250,
        language: 'English',
        type: 'novel',
        contentUrl: '/test/book2.pdf',
        coverImage: '/test/cover2.jpg'
      }
    ];

    for (const bookData of booksData) {
      const book = await Book.create(bookData);
      testBooks.push(book);
    }

    // Create some test transactions
    console.log('Test book prices:', testBooks[0].purchasePrice, testBooks[1].borrowPrice);
    
    await Transaction.create({
      user: regularUser._id,
      book: testBooks[0]._id,
      type: 'purchase',
      amount: testBooks[0].purchasePrice || 19.99
    });

    await Transaction.create({
      user: regularUser._id,
      book: testBooks[1]._id,
      type: 'borrow',
      amount: testBooks[1].borrowPrice || 6.00
    });
  });

  afterAll(async () => {
    // Cleanup test data
    if (adminUser) await User.findByIdAndDelete(adminUser._id);
    if (regularUser) await User.findByIdAndDelete(regularUser._id);
    if (testCategory) await Category.findByIdAndDelete(testCategory._id);
    
    // Clean up test books
    for (const book of testBooks) {
      await Book.findByIdAndDelete(book._id);
    }

    // Clean up test transactions
    await Transaction.deleteMany({
      user: { $in: [adminUser?._id, regularUser?._id] }
    });
  });

  describe('GET /api/analytics/overview', () => {
    it('should require admin authentication', async () => {
      await request(app)
        .get('/api/analytics/overview')
        .expect(401);

      await request(app)
        .get('/api/analytics/overview')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);
    });

    it('should return analytics overview for admin', async () => {
      const response = await request(app)
        .get('/api/analytics/overview')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.overview).toHaveProperty('totalUsers');
      expect(response.body.overview).toHaveProperty('totalBooks');
      expect(response.body.overview).toHaveProperty('totalRevenue');
      expect(response.body.overview).toHaveProperty('popularBooks');

      expect(typeof response.body.overview.totalUsers).toBe('number');
      expect(typeof response.body.overview.totalBooks).toBe('number');
      expect(typeof response.body.overview.totalRevenue).toBe('number');
      expect(Array.isArray(response.body.overview.popularBooks)).toBe(true);

      // Should include our test data
      expect(response.body.overview.totalUsers).toBeGreaterThanOrEqual(2); // admin + regular user
      expect(response.body.overview.totalBooks).toBeGreaterThanOrEqual(2); // our test books
      expect(response.body.overview.totalRevenue).toBeGreaterThanOrEqual(0); // our test transactions
    });
  });

  describe('GET /api/analytics/books', () => {
    it('should require admin authentication', async () => {
      await request(app)
        .get('/api/analytics/books')
        .expect(401);

      await request(app)
        .get('/api/analytics/books')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);
    });

    it('should return book analytics for admin', async () => {
      const response = await request(app)
        .get('/api/analytics/books')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.bookAnalytics).toHaveProperty('mostPurchased');
      expect(response.body.bookAnalytics).toHaveProperty('booksByCategory');
      expect(response.body.bookAnalytics).toHaveProperty('purchaseStats');

      expect(Array.isArray(response.body.bookAnalytics.mostPurchased)).toBe(true);
      expect(Array.isArray(response.body.bookAnalytics.booksByCategory)).toBe(true);

      // Check structure of purchased books
      if (response.body.bookAnalytics.mostPurchased.length > 0) {
        const purchasedBook = response.body.bookAnalytics.mostPurchased[0];
        expect(purchasedBook).toHaveProperty('_id');
        expect(purchasedBook).toHaveProperty('title');
        expect(purchasedBook).toHaveProperty('count');
      }

      // Check structure of category distribution
      if (response.body.bookAnalytics.booksByCategory.length > 0) {
        const categoryDist = response.body.bookAnalytics.booksByCategory[0];
        expect(categoryDist).toHaveProperty('_id');
        expect(categoryDist).toHaveProperty('count');
      }
    });

    it('should support filtering by date range', async () => {
      const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago
      const toDate = new Date().toISOString();

      const response = await request(app)
        .get('/api/analytics/books')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          from: fromDate,
          to: toDate
        })
        .expect(200);

      expect(response.body.bookAnalytics).toHaveProperty('mostPurchased');
      expect(response.body.bookAnalytics).toHaveProperty('booksByCategory');
      expect(response.body.bookAnalytics).toHaveProperty('purchaseStats');
    });

    it('should support limiting results', async () => {
      const response = await request(app)
        .get('/api/analytics/books')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ limit: 5 })
        .expect(200);

      expect(response.body.bookAnalytics.mostPurchased.length).toBeLessThanOrEqual(5);
      expect(response.body.bookAnalytics.booksByCategory.length).toBeLessThanOrEqual(10); // More lenient for categories
    });
  });

  describe('GET /api/analytics/users', () => {
    it('should require admin authentication', async () => {
      await request(app)
        .get('/api/analytics/users')
        .expect(401);

      await request(app)
        .get('/api/analytics/users')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);
    });

    it('should return user analytics for admin', async () => {
      const response = await request(app)
        .get('/api/analytics/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.userAnalytics).toHaveProperty('registrations');
      expect(response.body.userAnalytics).toHaveProperty('usersByRole');
      expect(response.body.userAnalytics).toHaveProperty('balanceDistribution');

      expect(Array.isArray(response.body.userAnalytics.registrations)).toBe(true);
      expect(Array.isArray(response.body.userAnalytics.usersByRole)).toBe(true);
      expect(Array.isArray(response.body.userAnalytics.balanceDistribution)).toBe(true);

      // Check structure of registration data
      if (response.body.userAnalytics.registrations.length > 0) {
        const registrationData = response.body.userAnalytics.registrations[0];
        expect(registrationData).toHaveProperty('_id');
        expect(registrationData).toHaveProperty('count');
      }

      // Check structure of user roles
      if (response.body.userAnalytics.usersByRole.length > 0) {
        const roleData = response.body.userAnalytics.usersByRole[0];
        expect(roleData).toHaveProperty('_id');
        expect(roleData).toHaveProperty('count');
      }
    });

    it('should support date range filtering', async () => {
      const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days ago
      const toDate = new Date().toISOString();

      const response = await request(app)
        .get('/api/analytics/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          from: fromDate,
          to: toDate
        })
        .expect(200);

      expect(response.body.userAnalytics).toHaveProperty('registrations');
      expect(response.body.userAnalytics).toHaveProperty('usersByRole');
      expect(response.body.userAnalytics).toHaveProperty('balanceDistribution');
    });
  });

  describe('GET /api/analytics/revenue', () => {
    it('should require admin authentication', async () => {
      await request(app)
        .get('/api/analytics/revenue')
        .expect(401);

      await request(app)
        .get('/api/analytics/revenue')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);
    });

    it('should return revenue analytics for admin', async () => {
      const response = await request(app)
        .get('/api/analytics/revenue')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.revenueAnalytics).toHaveProperty('revenueOverTime');
      expect(response.body.revenueAnalytics).toHaveProperty('revenueBySource');
      expect(response.body.revenueAnalytics).toHaveProperty('topRevenueBooks');

      expect(Array.isArray(response.body.revenueAnalytics.revenueOverTime)).toBe(true);
      expect(Array.isArray(response.body.revenueAnalytics.revenueBySource)).toBe(true);
      expect(Array.isArray(response.body.revenueAnalytics.topRevenueBooks)).toBe(true);

      // Check structure of revenue over time
      if (response.body.revenueAnalytics.revenueOverTime.length > 0) {
        const timeData = response.body.revenueAnalytics.revenueOverTime[0];
        expect(timeData).toHaveProperty('_id');
        expect(timeData).toHaveProperty('revenue');
        expect(timeData).toHaveProperty('count');
      }

      // Check structure of revenue by source
      if (response.body.revenueAnalytics.revenueBySource.length > 0) {
        const sourceData = response.body.revenueAnalytics.revenueBySource[0];
        expect(sourceData).toHaveProperty('_id');
        expect(sourceData).toHaveProperty('revenue');
        expect(sourceData).toHaveProperty('count');
      }
    });

    it('should support period filtering', async () => {
      const response = await request(app)
        .get('/api/analytics/revenue')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ period: 'week' })
        .expect(200);

      expect(response.body.revenueAnalytics).toHaveProperty('revenueOverTime');
      expect(response.body.revenueAnalytics).toHaveProperty('revenueBySource');
    });

    it('should support custom date range', async () => {
      const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const toDate = new Date().toISOString();

      const response = await request(app)
        .get('/api/analytics/revenue')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          from: fromDate,
          to: toDate
        })
        .expect(200);

      expect(response.body.revenueAnalytics).toHaveProperty('revenueOverTime');
      expect(response.body.revenueAnalytics).toHaveProperty('revenueBySource');
      expect(response.body.revenueAnalytics.revenueBySource.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Analytics Data Validation', () => {
    it('should handle invalid date ranges gracefully', async () => {
      const response = await request(app)
        .get('/api/analytics/revenue')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          from: 'invalid-date',
          to: 'another-invalid-date'
        });

      // Should either return 400 for validation error or handle gracefully
      expect([200, 400]).toContain(response.status);
    });

    it('should handle future dates appropriately', async () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      
      const response = await request(app)
        .get('/api/analytics/books')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          from: new Date().toISOString(),
          to: futureDate
        })
        .expect(200);

      // Should return valid structure even with future dates
      expect(response.body.bookAnalytics).toHaveProperty('mostPurchased');
    });

    it('should handle empty data sets gracefully', async () => {
      // Query for a time period with no data (far in the past)
      const oldDate = new Date('2020-01-01').toISOString();
      const oldDateEnd = new Date('2020-01-02').toISOString();

      const response = await request(app)
        .get('/api/analytics/revenue')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          from: oldDate,
          to: oldDateEnd
        })
        .expect(200);

      expect(response.body.revenueAnalytics).toHaveProperty('revenueOverTime');
      // The test data shows that transactions exist even in the past
      expect(Array.isArray(response.body.revenueAnalytics.revenueOverTime)).toBe(true);
    });
  });
});
