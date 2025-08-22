# Regional Admin API Endpoints

## Base URL: `http://localhost:5000/api/regional-admin`

## Authentication
Note: Currently no authentication is implemented. Use the regional admin ID directly in the URL.

## Endpoints

### 1. Dashboard Statistics
**GET** `/api/regional-admin/:regionalAdminId/dashboard`

Get comprehensive dashboard statistics for a regional admin including:
- Regional statistics (agents, borrowers, loans)
- Financial metrics
- Recent activity

**Parameters:**
- `regionalAdminId` (path): ID of the regional admin

**Response:**
```json
{
  "regionalAdmin": {
    "id": "string",
    "name": "string",
    "email": "string",
    "region": {
      "_id": "string",
      "name": "string",
      "districts": ["string"]
    }
  },
  "stats": {
    "totalAgents": 0,
    "totalBorrowers": 0,
    "totalLoans": 0,
    "pendingLoans": 0,
    "approvedLoans": 0,
    "activeLoans": 0,
    "pendingRegistrations": 0,
    "approvedRegistrations": 0,
    "pendingPayments": 0,
    "totalLoanAmount": 0,
    "totalCommission": 0,
    "averageLoanAmount": 0
  },
  "recentActivity": {
    "approvedLoans": [],
    "pendingLoans": []
  }
}
```

### 2. Pending Loans for Approval
**GET** `/api/regional-admin/:regionalAdminId/loans/pending`

Get all loans that are pending regional admin approval in the admin's region.

**Parameters:**
- `regionalAdminId` (path): ID of the regional admin
- `page` (query): Page number (default: 1)
- `limit` (query): Items per page (default: 10)

**Response:**
```json
{
  "message": "Pending loans fetched successfully",
  "loans": [],
  "total": 0,
  "page": 1,
  "pages": 1
}
```

### 3. Approve/Reject Loan
**POST** `/api/regional-admin/:regionalAdminId/loans/:loanId/approve`

Approve or reject a loan application.

**Parameters:**
- `regionalAdminId` (path): ID of the regional admin
- `loanId` (path): Loan application ID

**Body:**
```json
{
  "status": "Approved", // or "Rejected"
  "comments": "Optional comments"
}
```

**Response:**
```json
{
  "message": "Loan approved successfully",
  "loan": {}
}
```

### 4. Agents in Region
**GET** `/api/regional-admin/:regionalAdminId/agents`

Get all agents in the regional admin's assigned region with performance metrics.

**Parameters:**
- `regionalAdminId` (path): ID of the regional admin
- `page` (query): Page number (default: 1)
- `limit` (query): Items per page (default: 10)

**Response:**
```json
{
  "message": "Agents in region fetched successfully",
  "agents": [
    {
      "_id": "string",
      "name": "string",
      "email": "string",
      "region": {},
      "performance": {
        "clientsManaged": 0,
        "loansProcessed": 0,
        "loansApproved": 0,
        "totalCommission": 0,
        "approvalRate": 0
      }
    }
  ],
  "total": 0,
  "page": 1,
  "pages": 1
}
```

### 5. Pending Registrations
**GET** `/api/regional-admin/:regionalAdminId/registrations/pending`

Get all pending borrower registrations in the region.

**Parameters:**
- `regionalAdminId` (path): ID of the regional admin
- `page` (query): Page number (default: 1)
- `limit` (query): Items per page (default: 10)

**Response:**
```json
{
  "message": "Pending registrations fetched successfully",
  "registrations": [],
  "total": 0,
  "page": 1,
  "pages": 1
}
```

### 6. Approve/Reject Registration
**POST** `/api/regional-admin/:regionalAdminId/registrations/:registrationId/approve`

Approve or reject a borrower registration.

**Parameters:**
- `regionalAdminId` (path): ID of the regional admin
- `registrationId` (path): Registration ID

**Body:**
```json
{
  "status": "Approved" // or "Rejected"
}
```

**Response:**
```json
{
  "message": "Registration approved successfully",
  "registration": {}
}
```

### 7. Pending Payments
**GET** `/api/regional-admin/:regionalAdminId/payments/pending`

Get all pending payments in the region.

**Parameters:**
- `regionalAdminId` (path): ID of the regional admin
- `page` (query): Page number (default: 1)
- `limit` (query): Items per page (default: 10)

**Response:**
```json
{
  "message": "Pending payments fetched successfully",
  "payments": [
    {
      "paymentId": "string",
      "loanId": "string",
      "clientId": "string",
      "clientName": "string",
      "amount": 0,
      "paymentDate": "2024-01-01T00:00:00.000Z",
      "paymentMethod": "string",
      "paymentSlipUrl": "string",
      "loanAmount": 0,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "total": 0,
  "page": 1,
  "pages": 1
}
```

### 8. Approve/Reject Payment
**POST** `/api/regional-admin/:regionalAdminId/payments/approve`

Approve or reject a payment.

**Parameters:**
- `regionalAdminId` (path): ID of the regional admin

**Body:**
```json
{
  "paymentId": "string",
  "status": "Approved", // or "Rejected"
  "rejectedReason": "Optional reason for rejection"
}
```

**Response:**
```json
{
  "message": "Payment approved successfully",
  "payment": {}
}
```

### 9. Generate Regional Report
**POST** `/api/regional-admin/:regionalAdminId/reports`

Generate a comprehensive regional performance report.

**Parameters:**
- `regionalAdminId` (path): ID of the regional admin

**Body:**
```json
{
  "startDate": "2024-01-01", // Optional
  "endDate": "2024-12-31"    // Optional
}
```

**Response:**
```json
{
  "report": {
    "period": {
      "startDate": "string",
      "endDate": "string"
    },
    "region": {},
    "statistics": {
      "totalAgents": 0,
      "totalBorrowers": 0,
      "totalLoans": 0,
      "approvedLoans": 0,
      "rejectedLoans": 0,
      "activeLoans": 0,
      "approvalRate": 0,
      "totalLoanAmount": 0,
      "totalCommission": 0,
      "totalPayments": 0,
      "totalPaymentsAmount": 0
    },
    "agents": [
      {
        "id": "string",
        "name": "string",
        "email": "string",
        "performance": {
          "clientsManaged": 0,
          "loansProcessed": 0
        }
      }
    ]
  }
}
```

## Testing Data Requirements

To test these endpoints, you'll need:

1. **Regional Admin User**: A staff member with role `regional_manager` and assigned to a region
2. **Agents**: Staff members with role `agent` assigned to the same region
3. **Clients**: Client registrations assigned to agents in the region
4. **Loans**: Loan applications from clients that are approved by agents but pending regional approval
5. **Payments**: Payment records in loans with status 'Pending'

## Sample Test Data

You can use the existing test data or create new test data using the seed scripts. Make sure the regional admin is properly assigned to a region and has agents under them.

## Error Responses

All endpoints return standard error responses:

```json
{
  "message": "Error message",
  "error": "Detailed error message"
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad Request
- `403`: Forbidden (not authorized for the region)
- `404`: Not Found
- `500`: Internal Server Error
