const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Book = require('../models/Book');
const Category = require('../models/Category');

describe('Upload Routes', () => {
  let adminUser, regularUser;
  let adminToken, regularToken;
  let testCategory;

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
      name: 'Test Upload Category',
      description: 'Category for upload testing'
    });
  });

  afterAll(async () => {
    // Cleanup test data
    if (adminUser) await User.findByIdAndDelete(adminUser._id);
    if (regularUser) await User.findByIdAndDelete(regularUser._id);
    if (testCategory) await Category.findByIdAndDelete(testCategory._id);
    
    // Clean up any test books created
    await Book.deleteMany({ title: /Test Upload/ });
  });

  describe('POST /api/books', () => {
    it('should require admin authentication', async () => {
      await request(app)
        .post('/api/books')
        .expect(401);

      await request(app)
        .post('/api/books')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);
    });

    it('should validate file upload requirement', async () => {
      const bookData = {
        title: 'Test Book Without File',
        author: 'Test Author',
        description: 'A test book without file upload',
        categories: [testCategory._id],
        purchasePrice: 19.99,
        type: 'novel',
        contentUrl: '/test/path.pdf'
      };

      const response = await request(app)
        .post('/api/books')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(bookData)
        .expect(400);

      expect(response.body.error).toMatch(/Book content \(PDF File\) is required\./);
    });
  });

  describe('PUT /api/books/:id', () => {
    let testBook;

    beforeEach(async () => {
      testBook = await Book.create({
        title: 'Test Upload Book for Update',
        author: 'Test Author',
        description: 'A test book for update testing',
        categories: [testCategory._id],
        purchasePrice: 19.99,
        borrowPrice: 4.99,
        publishedYear: 2023,
        isbn: '9780123456788',
        publisher: 'Test Publisher',
        pages: 200,
        language: 'English',
        type: 'novel',
        contentUrl: '/test/path.pdf',
        coverImage: '/test/cover.jpg'
      });
    });

    afterEach(async () => {
      if (testBook) {
        await Book.findByIdAndDelete(testBook._id);
      }
    });

    it('should require admin authentication', async () => {
      await request(app)
        .put(`/api/books/${testBook._id}`)
        .expect(401);

      await request(app)
        .put(`/api/books/${testBook._id}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);
    });

    it('should update book successfully', async () => {
      const updateData = {
        title: 'Updated Test Book',
        description: 'Updated description',
        purchasePrice: 24.99
      };

      const response = await request(app)
        .put(`/api/books/${testBook._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.title).toBe(updateData.title);
      expect(response.body.description).toBe(updateData.description);
      expect(response.body.purchasePrice).toBe(updateData.purchasePrice);
    });
  });

  describe('DELETE /api/books/:id', () => {
    let testBook;

    beforeEach(async () => {
      testBook = await Book.create({
        title: 'Test Upload Book for Delete',
        author: 'Test Author',
        description: 'A test book for delete testing',
        categories: [testCategory._id],
        purchasePrice: 19.99,
        borrowPrice: 4.99,
        publishedYear: 2023,
        isbn: `978012345${Date.now().toString().slice(-4)}`, // Unique ISBN
        publisher: 'Test Publisher',
        pages: 200,
        language: 'English',
        type: 'novel',
        contentUrl: '/test/path.pdf',
        coverImage: '/test/cover.jpg'
      });
    });

    it('should require admin authentication', async () => {
      await request(app)
        .delete(`/api/books/${testBook._id}`)
        .expect(401);

      await request(app)
        .delete(`/api/books/${testBook._id}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);
    });

    it('should delete book successfully', async () => {
      const response = await request(app)
        .delete(`/api/books/${testBook._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.message || response.body.success).toMatch(/deleted|removed/i);

      // Verify book is deleted
      const deletedBook = await Book.findById(testBook._id);
      expect(deletedBook).toBeNull();
    });
  });
});