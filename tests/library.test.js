const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Book = require('../models/Book');
const Category = require('../models/Category');
const Plan = require('../models/Plan');
const Transaction = require('../models/Transaction');
const Inventory = require('../models/Inventory');

describe('Library Routes', () => {
  let testUser;
  let testBook;
  let testCategory;
  let authToken;

  beforeAll(async () => {
    // Create test category
    testCategory = await Category.create(global.testHelpers.createTestCategory());
    
    // Create test book
    const bookData = global.testHelpers.createTestBook();
    bookData.categories = [testCategory._id];
    testBook = await Book.create(bookData);

    // Create test user
    const userData = await global.testHelpers.createTestUser();
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
    if (testBook) await Book.findByIdAndDelete(testBook._id);
    if (testCategory) await Category.findByIdAndDelete(testCategory._id);
    await Plan.deleteMany({ user: testUser?._id });
    await Transaction.deleteMany({ user: testUser?._id });
    await Inventory.deleteMany({ user: testUser?._id });
  });

  describe('GET /api/library/my-books', () => {
    it('should get user library with purchased and borrowed books', async () => {
      const response = await request(app)
        .get('/api/library/my-books')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('purchasedBooks');
      expect(response.body).toHaveProperty('borrowedBooks');
      expect(response.body).toHaveProperty('totalOwned');
      expect(response.body).toHaveProperty('totalBorrowed');
      expect(Array.isArray(response.body.purchasedBooks)).toBe(true);
      expect(Array.isArray(response.body.borrowedBooks)).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/library/my-books')
        .expect(401);
    });
  });

  describe('GET /api/library/access/:bookId', () => {
    it('should get book access status for user', async () => {
      const response = await request(app)
        .get(`/api/library/access/${testBook._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('bookId');
      expect(response.body).toHaveProperty('accessType');
      expect(response.body).toHaveProperty('canRead');
      expect(response.body).toHaveProperty('canPurchase');
      expect(response.body).toHaveProperty('canBorrow');
      expect(response.body).toHaveProperty('book');
      expect(response.body.bookId).toBe(testBook._id.toString());
    });

    it('should return 404 for non-existent book', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .get(`/api/library/access/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 400 for invalid book ID format', async () => {
      await request(app)
        .get('/api/library/access/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/library/access/${testBook._id}`)
        .expect(401);
    });
  });

  describe('POST /api/library/:bookId/purchase', () => {
    it('should purchase a book successfully', async () => {
      const initialBalance = testUser.balance;
      
      const response = await request(app)
        .post(`/api/library/${testBook._id}/purchase`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.message).toBe('Book purchased successfully');
      expect(response.body).toHaveProperty('book');
      expect(response.body).toHaveProperty('remainingBalance');
      expect(response.body.remainingBalance).toBe(initialBalance - testBook.purchasePrice);

      // Verify user owns the book
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.purchasedBooks.map(id => id.toString())).toContain(testBook._id.toString());

      // Verify transaction was created
      const transaction = await Transaction.findOne({
        user: testUser._id,
        book: testBook._id,
        type: 'purchase'
      });
      expect(transaction).toBeTruthy();
      expect(transaction.amount).toBe(testBook.purchasePrice);

      // Verify inventory was created
      const inventory = await Inventory.findOne({
        user: testUser._id,
        book: testBook._id,
        ownershipType: 'owned'
      });
      expect(inventory).toBeTruthy();
    });

    it('should not allow purchasing already owned book', async () => {
      await request(app)
        .post(`/api/library/${testBook._id}/purchase`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should not allow purchasing with insufficient balance', async () => {
      // Create a new expensive book
      const expensiveBook = await Book.create({
        ...global.testHelpers.createTestBook(),
        purchasePrice: 999999,
        categories: [testCategory._id]
      });

      const response = await request(app)
        .post(`/api/library/${expensiveBook._id}/purchase`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toBe('Insufficient balance');

      // Cleanup
      await Book.findByIdAndDelete(expensiveBook._id);
    });

    it('should not allow purchasing non-purchasable book', async () => {
      // Create a non-purchasable book
      const nonPurchasableBook = await Book.create({
        ...global.testHelpers.createTestBook(),
        isPurchasable: false,
        categories: [testCategory._id]
      });

      const response = await request(app)
        .post(`/api/library/${nonPurchasableBook._id}/purchase`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toBe('This book is not available for purchase');

      // Cleanup
      await Book.findByIdAndDelete(nonPurchasableBook._id);
    });

    it('should return 404 for non-existent book', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .post(`/api/library/${fakeId}/purchase`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 400 for invalid book ID format', async () => {
      await request(app)
        .post('/api/library/invalid-id/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/library/${testBook._id}/purchase`)
        .expect(401);
    });
  });

  describe('POST /api/library/:bookId/borrow', () => {
    let borrowableBook;

    beforeAll(async () => {
      // Create a new borrowable book (since we purchased the test book)
      borrowableBook = await Book.create({
        ...global.testHelpers.createTestBook(),
        categories: [testCategory._id]
      });
    });

    afterAll(async () => {
      if (borrowableBook) await Book.findByIdAndDelete(borrowableBook._id);
    });

    it('should borrow a book successfully', async () => {
      const response = await request(app)
        .post(`/api/library/${borrowableBook._id}/borrow`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe('Book borrowed successfully');
      expect(response.body).toHaveProperty('book');
      expect(response.body).toHaveProperty('expiresAt');
      expect(response.body).toHaveProperty('cost');

      // Verify user borrowed the book
      const updatedUser = await User.findById(testUser._id);
      const borrowedBook = updatedUser.borrowedBooks.find(
        b => b.book.toString() === borrowableBook._id.toString()
      );
      expect(borrowedBook).toBeTruthy();
      expect(borrowedBook.isActive).toBe(true);

      // Verify inventory was created
      const inventory = await Inventory.findOne({
        user: testUser._id,
        book: borrowableBook._id,
        ownershipType: 'borrowed'
      });
      expect(inventory).toBeTruthy();
    });

    it('should not allow borrowing already borrowed book', async () => {
      await request(app)
        .post(`/api/library/${borrowableBook._id}/borrow`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should not allow borrowing owned book', async () => {
      await request(app)
        .post(`/api/library/${testBook._id}/borrow`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should not allow borrowing non-borrowable book', async () => {
      // Create a non-borrowable book
      const nonBorrowableBook = await Book.create({
        ...global.testHelpers.createTestBook(),
        isBorrowable: false,
        categories: [testCategory._id]
      });

      const response = await request(app)
        .post(`/api/library/${nonBorrowableBook._id}/borrow`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toBe('This book is not available for borrowing');

      // Cleanup
      await Book.findByIdAndDelete(nonBorrowableBook._id);
    });

    it('should return 404 for non-existent book', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .post(`/api/library/${fakeId}/borrow`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 400 for invalid book ID format', async () => {
      await request(app)
        .post('/api/library/invalid-id/borrow')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/library/${borrowableBook._id}/borrow`)
        .expect(401);
    });
  });

  describe('POST /api/library/:bookId/return', () => {
    let borrowableBook;

    beforeAll(async () => {
      // Create and borrow a book for return testing
      borrowableBook = await Book.create({
        ...global.testHelpers.createTestBook(),
        categories: [testCategory._id]
      });
    });

    afterAll(async () => {
      if (borrowableBook) await Book.findByIdAndDelete(borrowableBook._id);
    });

    it('should return a borrowed book successfully', async () => {
      // First borrow the book
      await request(app)
        .post(`/api/library/${borrowableBook._id}/borrow`)
        .set('Authorization', `Bearer ${authToken}`);

      // Then return it
      const response = await request(app)
        .post(`/api/library/${borrowableBook._id}/return`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe('Book returned successfully');
      expect(response.body).toHaveProperty('book');

      // Verify book is no longer active in user's borrowed books
      const updatedUser = await User.findById(testUser._id);
      const borrowedBook = updatedUser.borrowedBooks.find(
        b => b.book.toString() === borrowableBook._id.toString()
      );
      expect(borrowedBook.isActive).toBe(false);
    });

    it('should not allow returning non-borrowed book', async () => {
      const response = await request(app)
        .post(`/api/library/${borrowableBook._id}/return`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toBe('You have not borrowed this book or it has already been returned');
    });

    it('should return 404 for non-existent book', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .post(`/api/library/${fakeId}/return`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 400 for invalid book ID format', async () => {
      await request(app)
        .post('/api/library/invalid-id/return')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/library/${borrowableBook._id}/return`)
        .expect(401);
    });
  });
});
