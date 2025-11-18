# Enhanced Authentication & Authorization System

## Overview

The PaySync backend now includes a comprehensive authentication and authorization system with the following features:

- **JWT-based authentication** with access and refresh tokens
- **Hierarchical role-based access control (RBAC)**
- **Permission-based authorization**
- **Rate limiting** for authentication endpoints
- **Token blacklisting** and session management
- **Enhanced security** with proper error handling

## Authentication Flow

### 1. Login Process
```
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "userId",
      "name": "User Name",
      "email": "user@example.com",
      "role": "agent",
      "region": "regionId",
      "permissions": ["create_loan", "view_own_clients", ...]
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
      "tokenType": "Bearer",
      "expiresIn": "35m"
    }
  }
}
```

### 2. Token Refresh
```
POST /api/auth/refresh-token
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### 3. Logout
```
POST /api/auth/logout
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

## Role Hierarchy

The system implements a hierarchical role structure:

```
Super Admin (Level 5)
    │
    ├── Moderate Admin (Level 4)
    │   │
    │   ├── CEO (Level 3)
    │   │
    │   └── Regional Manager (Level 2)
    │       │
    │       └── Agent (Level 1)
```

### Role Permissions

#### Agent
- View and manage own clients
- Create and manage own loans
- Generate agreements
- Upload/view documents

#### Regional Manager
- All agent permissions
- View and manage regional clients/loans
- Approve/reject loans in their region
- Manage assigned agents

#### CEO
- View all system data
- Access financial reports and analytics
- Approve high-value loans
- Strategic oversight (view-only)

#### Moderate Admin
- All CEO permissions
- Create regional managers and agents
- Manage regions and districts
- System settings and configuration

#### Super Admin
- Full system access
- Create moderate admins and CEOs
- Database and security management
- System configuration

## Using the Authentication System

### 1. Protecting Routes

```javascript
const { authenticate, authorizeRoles, requirePermissions } = require('../middlewares/authMiddleware');
const { PERMISSIONS } = require('../utils/permissions');

// Require authentication
router.use(authenticate);

// Role-based authorization
router.get('/admin-only', 
  authorizeRoles('moderate_admin', 'super_admin'),
  controller.adminFunction
);

// Permission-based authorization
router.post('/create-loan', 
  requirePermissions(PERMISSIONS.CREATE_LOAN),
  controller.createLoan
);

// Hierarchical authorization (minimum role level)
router.get('/management-data', 
  authorizeHierarchy('regional_manager'),
  controller.getManagementData
);
```

### 2. Accessing User Data in Controllers

```javascript
exports.someController = async (req, res) => {
  // User data is available in req.user after authentication
  const { userId, email, role, region, permissions } = req.user;
  
  // Use user data for business logic
  const userLoans = await Loan.find({ agentId: userId });
  
  res.json({ success: true, data: userLoans });
};
```

### 3. Regional Access Control

```javascript
const { canAccessRegion } = require('../utils/permissions');

exports.getRegionalData = async (req, res) => {
  const { regionId } = req.params;
  
  if (!canAccessRegion(req.user, regionId)) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'AUTHZ_ERROR',
        message: 'Access denied: cannot access this region'
      }
    });
  }
  
  // Proceed with regional data access
};
```

## Rate Limiting

The system includes rate limiting for security:

- **Authentication endpoints**: 5 attempts per 15 minutes per IP
- **General API endpoints**: 100 requests per 15 minutes per IP

## Security Features

### 1. Token Security
- Access tokens expire in 15 minutes
- Refresh tokens expire in 7 days
- Token blacklisting for logout
- Secure token generation with proper secrets

### 2. Password Security
- Bcrypt hashing with salt rounds of 12
- Password change requires current password verification
- All refresh tokens revoked on password change

### 3. Error Handling
- Structured error responses
- No sensitive information in error messages
- Proper HTTP status codes
- Request logging for security events

### 4. Input Validation
- Request size limits (10MB)
- Proper CORS configuration
- Authorization header validation

## Environment Variables

Add these to your `.env` file:

```env
# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here
JWT_REFRESH_SECRET=your_refresh_token_secret_here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

## API Endpoints

### Authentication Routes (`/api/auth`)
- `POST /login` - User login
- `POST /refresh-token` - Refresh access token
- `POST /logout` - Logout (revoke refresh token)
- `POST /logout-all` - Logout from all devices
- `GET /profile` - Get current user profile
- `PUT /change-password` - Change password
- `POST /validate-role-creation` - Validate role creation permissions

### Protected Routes
All other API routes now require authentication and appropriate permissions:

- `/api/loans/*` - Loan management (requires loan permissions)
- `/api/agents/*` - Agent management (requires agent permissions)
- `/api/regional-admin/*` - Regional admin operations (requires regional permissions)

## Error Codes

The system uses standardized error codes:

- `AUTH_ERROR` - Authentication failures
- `AUTHZ_ERROR` - Authorization failures
- `VALIDATION_ERROR` - Input validation errors
- `RATE_LIMIT_ERROR` - Rate limiting violations
- `TOKEN_EXPIRED` - Expired token
- `INVALID_TOKEN` - Invalid token format
- `SERVER_ERROR` - Internal server errors

## Migration from Old System

The old authentication system has been replaced. Update your frontend code to:

1. Use `/api/auth/login` instead of `/api/staff/login`
2. Handle the new response format with nested `data` object
3. Include refresh token handling
4. Update error handling for new error format
5. Use the new permission-based access control

## Testing

The authentication system has been thoroughly tested with:

- Token generation and verification
- Permission system validation
- Role hierarchy enforcement
- Middleware functionality
- Error handling scenarios

All tests pass successfully, ensuring the system is production-ready.