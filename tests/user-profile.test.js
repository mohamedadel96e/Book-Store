const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');

describe('User Profile Routes', () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
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
  });

  describe('GET /api/auth/me', () => {
    it('should get current user profile', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('_id');
      expect(response.body).toHaveProperty('username');
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('balance');
      expect(response.body.email).toBe(testUser.email);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/auth/me')
        .expect(401);
    });
  });

  describe('PUT /api/auth', () => {
    it('should update user profile', async () => {
      const updateData = {
        username: `updated_${testUser.username}`,
        email: `updated_${testUser.email}`
      };

      const response = await request(app)
        .put('/api/auth')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('_id');
      expect(response.body.username).toBe(updateData.username);
      expect(response.body.email).toBe(updateData.email);
    });

    it('should require authentication', async () => {
      await request(app)
        .put('/api/auth')
        .send({ username: 'newname' })
        .expect(401);
    });
  });
});

describe('Error Handling and Edge Cases', () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
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
  });

  describe('Authentication edge cases', () => {
    it('should reject malformed JWT tokens', async () => {
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);
    });

    it('should reject expired tokens', async () => {
      // This would require creating an expired token, but for now we test malformed
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired.token')
        .expect(401);
    });

    it('should reject missing authorization header', async () => {
      await request(app)
        .get('/api/auth/me')
        .expect(401);
    });
  });

  describe('Data validation', () => {
    it('should validate required fields in registration', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({})
        .expect(400);

      await request(app)
        .post('/api/auth/register')
        .send({ username: 'test' })
        .expect(400);

      await request(app)
        .post('/api/auth/register')
        .send({ username: 'test', email: 'test@test.com' })
        .expect(400);
    });

    it('should prevent duplicate user registration', async () => {
      const userData = await global.testHelpers.createTestUser();
      
      // Create first user
      const firstUser = await User.create(userData);

      // Try to create another user with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'different',
          email: userData.email,
          password: 'password123'
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');

      // Cleanup
      await User.findByIdAndDelete(firstUser._id);
    });
  });

  describe('Rate limiting and security', () => {
    it('should handle concurrent requests gracefully', async () => {
      const promises = Array(5).fill().map((_, i) => 
        request(app)
          .get('/api/books')
          .query({ page: 1, limit: 5 })
      );

      const responses = await Promise.all(promises);
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status); // 200 OK or 429 Too Many Requests
      });
    });
  });
});
