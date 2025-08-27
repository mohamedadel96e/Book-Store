const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Global test setup
beforeAll(async () => {
  // Ensure MongoDB connection for tests
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
  }
});

// Clean up after all tests
afterAll(async () => {
  // Optional: Close database connection after tests
  // await mongoose.connection.close();
});

// Global test helpers
global.testHelpers = {
  createTestUser: async () => {
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash('password123', salt);
    
    return {
      username: `testuser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@example.com`,
      password: hashedPassword,
      balance: 1000
    };
  },
  
  createTestBook: () => ({
    title: `Test Book ${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description: 'A test book description',
    author: 'Test Author',
    contentUrl: 'http://example.com/test.pdf',
    type: 'novel',
    isPurchasable: true,
    purchasePrice: 10.99,
    isBorrowable: true,
    borrowDurationDays: 14
  }),
  
  createTestCategory: () => ({
    name: `Test Category ${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description: 'A test category'
  })
};
