# Agent Management System

## Overview

The Agent Management System provides comprehensive functionality for managing agents, their assigned clients, loan processing, and performance tracking. This system implements the requirements from the backend completion specification task 7.

## Features Implemented

### 1. Agent Client Assignment Functionality (Requirement 4.1)

- **Client Assignment**: Moderate admins can assign clients to agents
- **Assignment History**: Track complete assignment history with timestamps and reasons
- **Regional Filtering**: Clients are filtered by agent's assigned region
- **Bulk Assignment**: Support for assigning multiple clients to agents

#### API Endpoints:
```
POST /api/agents/:agentId/assign-client
```

#### Usage Example:
```javascript
// Assign client to agent
const response = await fetch('/api/agents/123/assign-client', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <token>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    clientId: '456',
    reason: 'Regional assignment based on district'
  })
});
```

### 2. Agent Loan Management with Proper Filtering (Requirement 4.2)

- **Loan Filtering**: Filter loans by status, amount range, date range, client name
- **Status Management**: Track loan status changes with audit trail
- **Regional Restrictions**: Agents can only access loans in their region
- **Pagination**: Efficient pagination for large datasets

#### API Endpoints:
```
GET /api/agents/:agentId/loans
```

#### Query Parameters:
- `status`: Filter by agent review status (Pending, Approved, Rejected)
- `loanStatus`: Filter by loan status (Pending, Approved, Active, etc.)
- `clientName`: Search by client name
- `dateFrom`, `dateTo`: Date range filtering
- `minAmount`, `maxAmount`: Amount range filtering
- `page`, `limit`: Pagination
- `sortBy`, `sortOrder`: Sorting options

#### Usage Example:
```javascript
// Get agent's approved loans from last month
const response = await fetch('/api/agents/123/loans?loanStatus=Approved&dateFrom=2024-01-01&limit=10', {
  headers: { 'Authorization': 'Bearer <token>' }
});
```

### 3. Agent Performance Tracking and Statistics (Requirement 4.3)

- **Client Statistics**: Total clients, verification rates, risk assessment metrics
- **Loan Performance**: Approval rates, processing times, commission tracking
- **Productivity Metrics**: Clients per month, loans per month, conversion rates
- **Financial Tracking**: Commission earned, average commission per loan
- **Time-based Analysis**: Performance over different periods (month, quarter, year)

#### API Endpoints:
```
GET /api/agents/:agentId/performance
```

#### Query Parameters:
- `dateFrom`, `dateTo`: Custom date range
- `period`: Predefined periods (month, quarter, year)

#### Response Structure:
```json
{
  "success": true,
  "data": {
    "agent": {
      "id": "123",
      "name": "John Agent",
      "region": "Western Province"
    },
    "performance": {
      "clientManagement": {
        "totalClients": 45,
        "verificationCompletionRate": 87.5,
        "averageRiskScore": 42.3
      },
      "loanProcessing": {
        "totalLoans": 38,
        "approvalRate": 78.9,
        "averageProcessingTime": 2.3,
        "totalLoanValue": 2500000
      },
      "productivity": {
        "averageClientsPerMonth": 12,
        "conversionRate": 84.4
      },
      "financial": {
        "totalCommissionEarned": 50000,
        "averageCommissionPerLoan": 1315.79
      }
    }
  }
}
```

### 4. Agent Dashboard Data Endpoints (Requirement 4.4)

- **Comprehensive Dashboard**: Real-time statistics and metrics
- **Recent Activity**: Latest client assignments and loan applications
- **Performance Indicators**: Key performance indicators and trends
- **Quick Actions**: Links to common tasks and pending items

#### API Endpoints:
```
GET /api/agents/:agentId/dashboard
GET /api/agents/:agentId/clients
GET /api/agents/:agentId/profile
```

### 5. Client Information Updates with Audit Trail (Requirement 4.5)

- **Secure Updates**: Agents can only update clients assigned to them
- **Audit Trail**: Complete audit trail of all changes with timestamps
- **Verification Management**: Update verification status for different categories
- **Change Tracking**: Track what changed, when, and by whom

#### API Endpoints:
```
PUT /api/agents/:agentId/clients/:clientId
PUT /api/agents/:agentId/clients/:clientId/verification
```

#### Usage Example:
```javascript
// Update client information
const response = await fetch('/api/agents/123/clients/456', {
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer <token>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    personalInfo: {
      phone: '+94771234567',
      email: 'newemail@example.com'
    },
    preferences: {
      emailNotifications: true
    }
  })
});

// Update verification status
const verificationResponse = await fetch('/api/agents/123/clients/456/verification', {
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer <token>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    category: 'identity',
    verified: true,
    reason: 'Documents verified successfully'
  })
});
```

## Repository Layer

### ClientRepository Methods

- `findByAgent(agentId, filters, options)`: Get clients assigned to an agent
- `getAgentClientStats(agentId, dateRange)`: Get client statistics for an agent
- `assignToAgent(clientId, agentId, assignedBy, reason)`: Assign client to agent
- `updateVerificationStatus(clientId, category, verified, verifiedBy, reason)`: Update verification
- `findRequiringAttention(agentId, filters, options)`: Get clients needing attention
- `searchClients(searchText, filters, options)`: Search clients with text search

### LoanRepository Methods

- `findByAgent(agentId, filters, options)`: Get loans assigned to an agent
- `getAgentLoanStats(agentId, dateRange)`: Get loan statistics for an agent
- `findForRegionalApproval(regionalManagerId, filters, options)`: Get loans for approval
- `updateWorkflowStage(loanId, newStage, performedBy, notes)`: Update loan workflow

## Security and Permissions

### Role-Based Access Control

- **Agent**: Can access only their own data and assigned clients/loans
- **Regional Manager**: Can access agents in their region
- **Moderate Admin**: Can assign clients to agents and manage regional data
- **Super Admin**: Full access to all agent management functions

### Permission Checks

- Agents can only access clients assigned to them
- Regional filtering ensures data isolation
- Audit trails track all sensitive operations
- Rate limiting prevents abuse

## Performance Optimizations

### Database Indexes

```javascript
// Client indexes
clientSchema.index({ assignedAgent: 1, status: 1 });
clientSchema.index({ region: 1, status: 1 });
clientSchema.index({ 'personalInfo.district': 1, status: 1 });

// Loan indexes
loanSchema.index({ assignedAgent: 1, loanStatus: 1 });
loanSchema.index({ region: 1, createdAt: -1 });
```

### Aggregation Pipelines

- Efficient MongoDB aggregation for statistics
- Optimized queries for large datasets
- Proper use of indexes for filtering

### Caching Strategy

- Repository-level caching for frequently accessed data
- Efficient pagination to handle large result sets
- Lazy loading for related data

## Error Handling

### Structured Error Responses

```json
{
  "success": false,
  "error": {
    "code": "AGENT_NOT_FOUND",
    "message": "Agent not found",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

### Error Types

- `AGENT_NOT_FOUND`: Agent doesn't exist
- `CLIENT_NOT_ASSIGNED`: Client not assigned to agent
- `ACCESS_DENIED`: Insufficient permissions
- `VALIDATION_ERROR`: Invalid input data
- `DATABASE_ERROR`: Database operation failed

## Testing

### Test Files

- `test-agent-management.js`: Basic functionality tests
- `test-agent-management-with-data.js`: Tests with sample data
- `test-agent-api-endpoints.js`: API endpoint tests

### Running Tests

```bash
# Test basic functionality
node test-agent-management.js

# Test with sample data
node test-agent-management-with-data.js

# Test API endpoints (requires server to be running)
node test-agent-api-endpoints.js
```

## Usage Examples

### Getting Agent Performance Data

```javascript
const { ClientRepository, LoanRepository } = require('./repositories');

const clientRepo = new ClientRepository();
const loanRepo = new LoanRepository();

// Get agent statistics
const clientStats = await clientRepo.getAgentClientStats(agentId, {
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31')
});

const loanStats = await loanRepo.getAgentLoanStats(agentId, {
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31')
});
```

### Filtering Agent Data

```javascript
// Get pending clients for an agent
const pendingClients = await clientRepo.findByAgent(agentId, {
  status: 'Pending'
}, {
  limit: 10,
  sort: { createdAt: -1 }
});

// Get approved loans for an agent
const approvedLoans = await loanRepo.findByAgent(agentId, {
  loanStatus: 'Approved'
}, {
  populate: ['clientUserId'],
  limit: 20
});
```

## Integration with Frontend

### React Hook Example

```javascript
// Custom hook for agent data
const useAgentData = (agentId) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAgentData = async () => {
      try {
        const [clients, loans, performance] = await Promise.all([
          fetch(`/api/agents/${agentId}/clients`),
          fetch(`/api/agents/${agentId}/loans`),
          fetch(`/api/agents/${agentId}/performance`)
        ]);

        setData({
          clients: await clients.json(),
          loans: await loans.json(),
          performance: await performance.json()
        });
      } catch (error) {
        console.error('Error fetching agent data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAgentData();
  }, [agentId]);

  return { data, loading };
};
```

## Monitoring and Logging

### Audit Trail

All agent management operations are logged with:
- User ID and role
- Action performed
- Timestamp
- IP address
- Changes made

### Performance Monitoring

- Response time tracking
- Database query performance
- Error rate monitoring
- User activity tracking

## Future Enhancements

### Planned Features

1. **Real-time Notifications**: WebSocket integration for real-time updates
2. **Advanced Analytics**: Machine learning for performance predictions
3. **Mobile API**: Optimized endpoints for mobile applications
4. **Bulk Operations**: Batch processing for large datasets
5. **Export Functionality**: PDF/Excel export for reports

### Scalability Considerations

- Database sharding for large datasets
- Microservice architecture for high load
- Caching layer for frequently accessed data
- Load balancing for multiple instances

## Conclusion

The Agent Management System provides a comprehensive solution for managing agents, their clients, and loan processing workflows. It implements all required functionality with proper security, performance optimization, and error handling. The system is designed to be scalable and maintainable, with clear separation of concerns and comprehensive testing coverage.