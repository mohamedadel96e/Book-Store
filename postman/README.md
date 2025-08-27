# Book Store API - Postman Collection

This directory contains a comprehensive Postman collection for testing the Book Store API.

## Files

- `Book-Store-API.postman_collection.json` - Complete API collection with all endpoints
- `Book-Store-API.postman_environment.json` - Environment variables for the collection

## Setup Instructions

### 1. Import Collection
1. Open Postman
2. Click "Import" in the top left
3. Select `Book-Store-API.postman_collection.json`

### 2. Import Environment
1. Click the gear icon (⚙️) in the top right
2. Click "Import" in the environment modal
3. Select `Book-Store-API.postman_environment.json`
4. Make sure to select the "Book Store API Environment" from the dropdown

### 3. Configuration
Update the environment variables as needed:
- `baseUrl`: Your API server URL (default: http://localhost:5010)
- Other variables will be auto-populated through scripts

## Usage Guide

### Authentication Flow
1. **Register User**: Create a new user account
2. **Login User**: Get authentication token (automatically saved to environment)
3. **Get Profile**: Test authenticated endpoint

### Admin Setup
To test admin features, you need a user with "watcher" role:
1. Register a user normally
2. Update the user's role in the database to "watcher"
3. Login with that user to get the `watcherToken`

### Testing Workflow

#### Basic User Operations
1. Register → Login → Get Profile
2. Get All Books → Search Books → Get Book Details
3. Get Categories → Get Category Details

#### Library Operations (Requires Authentication)
1. Add Balance to account
2. Purchase a book
3. Get My Library
4. Check Book Access
5. Download Book

#### Subscription Operations (Requires Authentication)
1. Get Available Plans
2. Subscribe to Category Plan or Limited Books Plan
3. Get My Subscriptions
4. Borrow books (requires active subscription)
5. Return borrowed books

#### Admin Operations (Requires Watcher Role)
1. Create/Update/Delete Categories
2. Create/Update/Delete Books
3. View Analytics (Dashboard, Books, Users, Revenue)
4. Cleanup expired subscriptions and books

## Environment Variables

The collection uses the following environment variables:

- `baseUrl`: API base URL
- `authToken`: User authentication token (auto-populated on login)
- `watcherToken`: Admin/watcher authentication token (manually set)
- `userId`: Current user ID (auto-populated)
- `bookId`: Book ID for book-specific operations
- `categoryId`: Category ID for category operations
- `planId`: Plan ID for subscription operations

## Request Examples

### Authentication
```json
// Register
POST /api/auth
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123",
  "role": "user"
}

// Login
POST /api/auth/login
{
  "email": "test@example.com",
  "password": "password123"
}
```

### Book Operations
```json
// Search Books
GET /api/books/search?query=novel&category=fiction

// Rate Book
POST /api/books/{bookId}/rate
{
  "rating": 5,
  "review": "Great book!"
}
```

### Subscription Plans
```json
// Subscribe to Category Plan
POST /api/plans/subscribe/category
{
  "categoryId": "category_id_here",
  "planType": "1_month"
}

// Add Balance
POST /api/plans/add-balance
{
  "amount": 100
}
```

## Pre-request Scripts

The collection includes scripts that automatically:
- Extract and save authentication tokens after login
- Set user IDs in environment variables
- Handle authorization headers

## Testing Tips

1. **Start with Authentication**: Always login first to get tokens
2. **Use Variables**: Update `bookId`, `categoryId`, `planId` variables for specific operations
3. **Check Environment**: Ensure the correct environment is selected
4. **Admin Testing**: Create a watcher user for admin endpoint testing
5. **Seed Data**: Use the seeder script (`npm run seed`) to populate test data

## Common Status Codes

- `200`: Success
- `201`: Created successfully
- `400`: Bad request (validation error)
- `401`: Unauthorized (missing/invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not found
- `409`: Conflict (duplicate data)
- `500`: Internal server error

## Error Handling

All endpoints return consistent error format:
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information"
}
```

## Support

If you encounter issues:
1. Check server is running on correct port
2. Verify environment variables are set
3. Ensure authentication tokens are valid
4. Check request body format matches expected schema
