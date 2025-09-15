# 🔐 Complete Authentication System Testing Guide

## ✅ Current Status
- ✅ Test users created successfully
- ✅ Database connection working
- ✅ User creation fixed (registrationId issue resolved)
- ❌ Server not running during tests

## 🔑 Test Credentials Created
```
moderate_admin: moderate.admin@paysync.com / ModerateAdmin123!
regional_manager: regional.manager@paysync.com / RegionalManager123!
agent: agent@paysync.com / Agent123!
ceo: ceo@paysync.com / CEO123!
```

## 🚀 Step-by-Step Testing Process

### Step 1: Start the Server
```bash
# In the backend directory
npm run start
```

**Expected Output:**
```
✅ Server is running on http://localhost:5000
✅ MongoDB connected successfully
✅ All services initialized successfully
```

### Step 2: Test with Postman

#### A. Login Test (POST Request)
**URL:** `http://localhost:5000/api/auth/login`
**Method:** POST
**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Body (JSON):**
```json
{
  "email": "moderate.admin@paysync.com",
  "password": "ModerateAdmin123!"
}
```

**Expected Success Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "...",
      "name": "John Moderate Admin",
      "email": "moderate.admin@paysync.com",
      "role": "moderate_admin",
      "region": "...",
      "permissions": [...]
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "tokenType": "Bearer",
      "expiresIn": "15m"
    }
  },
  "timestamp": "2025-09-01T..."
}
```

#### B. Profile Test (GET Request)
**URL:** `http://localhost:5000/api/auth/profile`
**Method:** GET
**Headers:**
```json
{
  "Authorization": "Bearer YOUR_ACCESS_TOKEN_HERE",
  "Content-Type": "application/json"
}
```

**Expected Success Response:**
```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "user": {
      "id": "...",
      "name": "John Moderate Admin",
      "email": "moderate.admin@paysync.com",
      "role": "moderate_admin",
      "region": {...},
      "permissions": [...],
      "createdAt": "..."
    }
  },
  "timestamp": "2025-09-01T..."
}
```

#### C. Token Refresh Test (POST Request)
**URL:** `http://localhost:5000/api/auth/refresh-token`
**Method:** POST
**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Body (JSON):**
```json
{
  "refreshToken": "YOUR_REFRESH_TOKEN_HERE"
}
```

#### D. Logout Test (POST Request)
**URL:** `http://localhost:5000/api/auth/logout`
**Method:** POST
**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Body (JSON):**
```json
{
  "refreshToken": "YOUR_REFRESH_TOKEN_HERE"
}
```

### Step 3: Test All User Roles

Test login for each user role:

1. **Moderate Admin:**
   - Email: `moderate.admin@paysync.com`
   - Password: `ModerateAdmin123!`

2. **Regional Manager:**
   - Email: `regional.manager@paysync.com`
   - Password: `RegionalManager123!`

3. **Agent:**
   - Email: `agent@paysync.com`
   - Password: `Agent123!`

4. **CEO:**
   - Email: `ceo@paysync.com`
   - Password: `CEO123!`

### Step 4: Automated Testing (After Server is Running)

Once your server is running, you can run the automated test:

```bash
node fix-auth-system.js
```

This will test all authentication endpoints automatically.

## 🔧 Common Issues and Solutions

### Issue 1: "Cannot set headers after they are sent"
**Status:** ✅ FIXED
- Fixed compression middleware double response issue
- Fixed error handler double response issue
- Added response sent checks in auth controller

### Issue 2: "Connection refused" or "ECONNREFUSED"
**Solution:** Make sure the server is running on port 5000
```bash
npm run start
```

### Issue 3: "Invalid credentials"
**Solution:** Use the exact credentials provided above

### Issue 4: "Token expired"
**Solution:** Get a new token by logging in again

## 📝 Postman Collection Setup

Create a new Postman collection with these requests:

1. **Login** - Save the tokens from response
2. **Get Profile** - Use saved access token
3. **Refresh Token** - Use saved refresh token
4. **Logout** - Use saved refresh token

## 🎯 What to Expect

### Successful Login Flow:
1. POST `/api/auth/login` → Get tokens
2. GET `/api/auth/profile` → Verify token works
3. POST `/api/auth/refresh-token` → Get new access token
4. POST `/api/auth/logout` → Invalidate refresh token

### JWT Token Structure:
```json
{
  "userId": "user_id_here",
  "email": "user@example.com",
  "role": "moderate_admin",
  "region": "region_id_here",
  "permissions": ["permission1", "permission2", ...],
  "iat": 1234567890,
  "exp": 1234567890,
  "iss": "paysync-backend",
  "aud": "paysync-client"
}
```

## 🚨 Troubleshooting

If you encounter any issues:

1. **Check server logs** for error messages
2. **Verify database connection** is working
3. **Check environment variables** in .env file
4. **Ensure JWT secrets** are properly set
5. **Verify user exists** in database

## 🎉 Success Indicators

You'll know everything is working when:
- ✅ Server starts without errors
- ✅ Login returns valid JWT tokens
- ✅ Protected endpoints accept the tokens
- ✅ Token refresh works
- ✅ Logout invalidates tokens
- ✅ All user roles can login successfully

## 📞 Next Steps After Testing

Once authentication is working:
1. Test role-based permissions
2. Test protected API endpoints
3. Integrate with frontend
4. Test session management
5. Test security features