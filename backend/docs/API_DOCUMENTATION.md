# PaySync Backend API Documentation

## Overview

The PaySync Backend API is a comprehensive microfinance management system that provides endpoints for loan management, client management, staff management, and administrative operations. The API follows REST principles and uses JWT authentication for security.

## Base URL

```
http://localhost:5000/api
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

### Getting a Token

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

## API Endpoints

### Authentication Endpoints

#### POST /api/auth/login
Authenticate user and receive JWT tokens.

**Request Body:**
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "string",
      "email": "string",
      "firstName": "string",
      "lastName": "string",
      "role": "string"
    },
    "token": "string",
    "refreshToken": "string"
  }
}
```

#### POST /api/auth/refresh-token
Refresh expired access token using refresh token.

**Headers:**
```
Authorization: Bearer <refresh_token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "token": "string"
  }
}
```

#### POST /api/auth/change-password
Change user password (requires authentication).

**Request Body:**
```json
{
  "currentPassword": "string (required)",
  "newPassword": "string (required)"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

#### GET /api/auth/profile
Get current user profile information.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "string",
      "personalInfo": {
        "firstName": "string",
        "lastName": "string",
        "email": "string",
        "phone": "string"
      },
      "role": "string",
      "region": "string"
    }
  }
}
```

### Loan Management Endpoints

#### POST /api/loans
Create a new loan application.

**Request Body:**
```json
{
  "clientUserId": "string (required)",
  "loanAmount": "number (required, min: 1000, max: 10000000)",
  "loanTerm": "number (required, min: 1, max: 360)",
  "interestRate": "number (required, min: 1, max: 50)",
  "purpose": "string (required)",
  "guarantorInfo": {
    "name": "string (required)",
    "relationship": "string (required)",
    "phone": "string (required)",
    "address": "string"
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Loan application created successfully",
  "data": {
    "loan": {
      "_id": "string",
      "loanApplicationId": "string",
      "loanAmount": "number",
      "loanTerm": "number",
      "loanStatus": "pending",
      "monthlyInstallment": "number",
      "totalPayableAmount": "number",
      "createdAt": "string"
    }
  }
}
```

#### GET /api/loans/agent/:agentId
Get loans for a specific agent with filtering and pagination.

**Query Parameters:**
- `status` (optional): Filter by loan status
- `clientName` (optional): Filter by client name
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `startDate` (optional): Filter loans from this date
- `endDate` (optional): Filter loans until this date

**Response (200):**
```json
{
  "success": true,
  "data": {
    "loans": [
      {
        "_id": "string",
        "loanApplicationId": "string",
        "loanAmount": "number",
        "loanStatus": "string",
        "clientInfo": {
          "firstName": "string",
          "lastName": "string",
          "email": "string"
        },
        "createdAt": "string"
      }
    ],
    "pagination": {
      "totalCount": "number",
      "currentPage": "number",
      "totalPages": "number",
      "hasNext": "boolean",
      "hasPrev": "boolean"
    }
  }
}
```

#### GET /api/loans/regional
Get loans for regional manager approval (requires regional_manager role).

**Query Parameters:**
- `status` (optional): Filter by loan status
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "loans": [
      {
        "_id": "string",
        "loanApplicationId": "string",
        "loanAmount": "number",
        "loanStatus": "string",
        "clientInfo": {
          "firstName": "string",
          "lastName": "string"
        },
        "agentInfo": {
          "firstName": "string",
          "lastName": "string"
        },
        "createdAt": "string"
      }
    ],
    "pagination": {
      "totalCount": "number",
      "currentPage": "number",
      "totalPages": "number"
    }
  }
}
```

#### PUT /api/loans/:loanId/status
Update loan status (requires appropriate permissions).

**Request Body:**
```json
{
  "status": "string (required, enum: ['pending', 'approved', 'rejected', 'active', 'completed'])",
  "comments": "string (required)"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Loan status updated successfully",
  "data": {
    "loan": {
      "_id": "string",
      "loanStatus": "string",
      "auditTrail": [
        {
          "action": "string",
          "performedBy": "string",
          "timestamp": "string",
          "comments": "string"
        }
      ]
    }
  }
}
```

#### GET /api/loans/:loanId
Get detailed information about a specific loan.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "loan": {
      "_id": "string",
      "loanApplicationId": "string",
      "loanAmount": "number",
      "loanTerm": "number",
      "interestRate": "number",
      "loanStatus": "string",
      "monthlyInstallment": "number",
      "clientInfo": {
        "firstName": "string",
        "lastName": "string",
        "email": "string",
        "phone": "string"
      },
      "guarantorInfo": {
        "name": "string",
        "relationship": "string",
        "phone": "string"
      },
      "auditTrail": [],
      "createdAt": "string",
      "updatedAt": "string"
    }
  }
}
```

#### GET /api/loans/statistics
Get loan statistics for the authenticated user's scope.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "totalLoans": "number",
    "pendingLoans": "number",
    "approvedLoans": "number",
    "rejectedLoans": "number",
    "activeLoans": "number",
    "completedLoans": "number",
    "totalAmount": "number",
    "averageAmount": "number",
    "monthlyStats": [
      {
        "month": "string",
        "count": "number",
        "amount": "number"
      }
    ]
  }
}
```

### Client Management Endpoints

#### POST /api/clients
Create a new client (requires agent role).

**Request Body:**
```json
{
  "personalInfo": {
    "firstName": "string (required)",
    "lastName": "string (required)",
    "email": "string (required)",
    "phone": "string (required)",
    "nic": "string (required)",
    "address": "string (required)",
    "district": "string (required)",
    "dateOfBirth": "string (ISO date)",
    "monthlyIncome": "number (required)",
    "employmentStatus": "string (required)"
  },
  "emergencyContact": {
    "name": "string",
    "relationship": "string",
    "phone": "string"
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Client created successfully",
  "data": {
    "client": {
      "_id": "string",
      "personalInfo": {
        "firstName": "string",
        "lastName": "string",
        "email": "string"
      },
      "status": "active",
      "assignedAgent": "string",
      "createdAt": "string"
    }
  }
}
```

#### GET /api/clients/agent/:agentId
Get clients assigned to a specific agent.

**Query Parameters:**
- `status` (optional): Filter by client status
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "clients": [
      {
        "_id": "string",
        "personalInfo": {
          "firstName": "string",
          "lastName": "string",
          "email": "string",
          "phone": "string"
        },
        "status": "string",
        "totalLoans": "number",
        "activeLoans": "number",
        "createdAt": "string"
      }
    ],
    "pagination": {
      "totalCount": "number",
      "currentPage": "number",
      "totalPages": "number"
    }
  }
}
```

#### GET /api/clients/:clientId
Get detailed information about a specific client.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "client": {
      "_id": "string",
      "personalInfo": {
        "firstName": "string",
        "lastName": "string",
        "email": "string",
        "phone": "string",
        "nic": "string",
        "address": "string",
        "district": "string",
        "monthlyIncome": "number",
        "employmentStatus": "string"
      },
      "status": "string",
      "assignedAgent": {
        "firstName": "string",
        "lastName": "string",
        "email": "string"
      },
      "loanHistory": [
        {
          "_id": "string",
          "loanAmount": "number",
          "loanStatus": "string",
          "createdAt": "string"
        }
      ],
      "createdAt": "string"
    }
  }
}
```

### Staff Management Endpoints

#### POST /api/staff
Create a new staff member (requires appropriate permissions).

**Request Body:**
```json
{
  "personalInfo": {
    "firstName": "string (required)",
    "lastName": "string (required)",
    "email": "string (required)",
    "phone": "string (required)",
    "nic": "string (required)",
    "address": "string (required)"
  },
  "role": "string (required, enum: ['agent', 'regional_manager', 'moderate_admin', 'ceo', 'super_admin'])",
  "region": "string (required for regional roles)",
  "password": "string (required)"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Staff member created successfully",
  "data": {
    "staff": {
      "_id": "string",
      "personalInfo": {
        "firstName": "string",
        "lastName": "string",
        "email": "string"
      },
      "role": "string",
      "region": "string",
      "isActive": true,
      "createdAt": "string"
    }
  }
}
```

#### GET /api/staff
Get list of staff members with filtering.

**Query Parameters:**
- `role` (optional): Filter by role
- `region` (optional): Filter by region
- `status` (optional): Filter by active status
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "staff": [
      {
        "_id": "string",
        "personalInfo": {
          "firstName": "string",
          "lastName": "string",
          "email": "string"
        },
        "role": "string",
        "region": "string",
        "isActive": "boolean",
        "createdAt": "string"
      }
    ],
    "pagination": {
      "totalCount": "number",
      "currentPage": "number",
      "totalPages": "number"
    }
  }
}
```

### File Management Endpoints

#### POST /api/files/upload
Upload a file (documents, images, etc.).

**Request:**
- Content-Type: multipart/form-data
- Field name: 'file'
- Supported formats: PDF, JPG, PNG, DOC, DOCX
- Max size: 5MB

**Response (200):**
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "file": {
      "id": "string",
      "filename": "string",
      "originalName": "string",
      "mimeType": "string",
      "size": "number",
      "url": "string",
      "uploadedAt": "string"
    }
  }
}
```

#### GET /api/files/:fileId/download
Download a file by ID.

**Response:**
- Content-Type: application/octet-stream
- Content-Disposition: attachment; filename="filename.ext"
- File binary data

### Agreement Management Endpoints

#### POST /api/agreements/generate/:loanId
Generate loan agreement document.

**Response (200):**
```json
{
  "success": true,
  "message": "Agreement generated successfully",
  "data": {
    "agreement": {
      "id": "string",
      "loanId": "string",
      "filename": "string",
      "url": "string",
      "generatedAt": "string"
    }
  }
}
```

#### GET /api/agreements/:agreementId/download
Download agreement document.

**Response:**
- Content-Type: application/pdf
- Content-Disposition: attachment; filename="agreement.pdf"
- PDF binary data

### Health Monitoring Endpoints

#### GET /api/health
Get system health status.

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "string",
  "database": {
    "connected": "boolean",
    "responseTime": "string"
  },
  "services": {
    "email": "string",
    "fileStorage": "string"
  },
  "metrics": {
    "activeConnections": "number",
    "memoryUsage": "string",
    "uptime": "string"
  }
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": "Additional error details (optional)",
    "timestamp": "2024-01-01T10:00:00.000Z"
  }
}
```

### Common Error Codes

- `VALIDATION_ERROR` (400): Request validation failed
- `AUTH_ERROR` (401): Authentication failed
- `INSUFFICIENT_PERMISSIONS` (403): User lacks required permissions
- `NOT_FOUND` (404): Resource not found
- `BUSINESS_RULE_VIOLATION` (400): Business logic validation failed
- `INTERNAL_ERROR` (500): Server internal error

## Rate Limiting

API endpoints are rate limited:
- Authentication endpoints: 5 requests per minute per IP
- General endpoints: 100 requests per minute per user
- File upload endpoints: 10 requests per minute per user

## Pagination

List endpoints support pagination with the following query parameters:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 100)

Pagination response format:
```json
{
  "pagination": {
    "totalCount": "number",
    "currentPage": "number",
    "totalPages": "number",
    "hasNext": "boolean",
    "hasPrev": "boolean"
  }
}
```

## Role-Based Access Control

### Roles and Permissions

1. **Agent**
   - Create and manage assigned clients
   - Create loan applications
   - View own loans and clients
   - Generate agreements

2. **Regional Manager**
   - All agent permissions for their region
   - Approve/reject loan applications
   - View regional statistics
   - Manage agents in their region

3. **Moderate Admin**
   - Create regional managers and agents
   - Assign agents to regional managers
   - Manage regions and districts
   - View system-wide data

4. **CEO**
   - View all system data and reports
   - Access financial analytics
   - Strategic decision support

5. **Super Admin**
   - Full system access
   - Create moderate admins and CEOs
   - System configuration
   - Database management

## WebSocket Events (Future Enhancement)

Real-time notifications for:
- Loan status changes
- New loan applications
- System alerts
- Agreement generation completion

## SDK and Client Libraries

Official SDKs available for:
- JavaScript/Node.js
- Python
- PHP
- Java

## Support

For API support and questions:
- Email: api-support@paysync.com
- Documentation: https://docs.paysync.com
- Status Page: https://status.paysync.com