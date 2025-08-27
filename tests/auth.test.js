const request = require('supertest');
const app = require('../server');
const User = require('../models/User');

describe('Auth Routes (Support for other tests)', () => {
  let testUser;

  beforeAll(async () => {
    // Create a test user
    testUser = await User.create(await global.testHelpers.createTestUser());
  });

  afterAll(async () => {
    // Clean up
    if (testUser) await User.findByIdAndDelete(testUser._id);
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'password123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('_id');
      expect(response.body.email).toBe(testUser.email);
    });

    it('should fail with invalid credentials', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        })
        .expect(400);
    });

    it('should fail with non-existent user', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        })
        .expect(400);
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const newUserData = await global.testHelpers.createTestUser();
      
      const response = await request(app)
        .post('/api/auth')
        .send(newUserData)
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('_id');
      expect(response.body.email).toBe(newUserData.email);

      // Clean up
      await User.findOneAndDelete({ email: newUserData.email });
    });

    it('should fail with duplicate email', async () => {
      const response = await request(app)
        .post('/api/auth')
        .send({
          username: 'newuser',
          email: testUser.email, // Use existing email
          password: 'password123'
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });
});
