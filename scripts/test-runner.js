#!/usr/bin/env node

/**
 * Test Runner Script for Book Store API
 * 
 * This script runs comprehensive tests for:
 * - Library features (purchase, borrow, return)
 * - Plan features (subscriptions, balance management)
 * - Integration tests (full user workflows)
 * - Authentication (login, register)
 * 
 * Usage: npm test
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Starting Book Store API Tests...\n');

try {
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  // Run Jest tests
  execSync('npx jest --verbose --runInBand', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
  
  console.log('\n✅ All tests completed successfully!');
} catch (error) {
  console.error('\n❌ Tests failed:', error.message);
  process.exit(1);
}
