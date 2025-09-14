# Email Notification System

## Overview

The PaySync email notification system provides comprehensive email communication capabilities for the microfinance platform. It includes automated notifications for loan status changes, agreement readiness, payment reminders, and custom messaging with a robust queue system and retry logic.

## Features

### 🎯 Core Features
- **Template-based emails** with professional HTML templates
- **Queue system** with retry logic and exponential backoff
- **Automatic notifications** for loan status changes and agreement generation
- **Bulk email operations** for administrative tasks
- **Mock mode** for development without email credentials
- **Audit logging** for all email operations

### 📧 Email Types
1. **Loan Status Change Notifications** - Sent when loan status is updated
2. **Agreement Ready Notifications** - Sent when loan agreements are generated
3. **Payment Reminders** - Sent for upcoming payment due dates
4. **Custom Emails** - Administrative custom messaging

## Architecture

### Email Service (`services/emailService.js`)
- Singleton service managing email operations
- Template rendering with variable substitution
- Queue management with retry logic
- Mock mode for development

### Email Controller (`controllers/emailController.js`)
- REST API endpoints for email operations
- Validation and error handling
- Role-based access control

### Email Routes (`routes/emailRoutes.js`)
- Authenticated endpoints with proper validation
- Role-based permissions for different operations

## Configuration

### Environment Variables
```env
# Email Configuration
EMAIL_USER=your@gmail.com
EMAIL_PASS=your_app_password

# Optional: Email Service Configuration
EMAIL_SERVICE=Gmail
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
```

### Gmail Setup
1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password for the application
3. Use the App Password as `EMAIL_PASS` (not your regular password)

## API Endpoints

### Authentication Required
All email endpoints require authentication via JWT token.

### Endpoints

#### Send Loan Status Notification
```http
POST /api/email/loan-status
Authorization: Bearer <token>
Content-Type: application/json

{
  "loanId": "loan_id_here",
  "newStatus": "approved",
  "message": "Your loan has been approved!",
  "reason": "Optional rejection reason"
}
```

#### Send Agreement Ready Notification
```http
POST /api/email/agreement-ready
Authorization: Bearer <token>
Content-Type: application/json

{
  "loanId": "loan_id_here",
  "downloadLink": "https://example.com/download/agreement.pdf"
}
```

#### Send Payment Reminder
```http
POST /api/email/payment-reminder
Authorization: Bearer <token>
Content-Type: application/json

{
  "loanId": "loan_id_here",
  "dueDate": "2024-02-15",
  "amountDue": 45000,
  "daysUntilDue": 7
}
```

#### Send Custom Email (Admin Only)
```http
POST /api/email/custom
Authorization: Bearer <token>
Content-Type: application/json

{
  "to": "recipient@example.com",
  "subject": "Custom Subject",
  "content": {
    "html": "<h1>Custom HTML content</h1>",
    "text": "Custom text content"
  },
  "priority": "high"
}
```

#### Bulk Loan Notifications (Regional Manager/Admin)
```http
POST /api/email/bulk-loan-notifications
Authorization: Bearer <token>
Content-Type: application/json

{
  "loanIds": ["loan1", "loan2", "loan3"],
  "newStatus": "approved",
  "message": "Bulk approval message"
}
```

#### Get Queue Status (Admin Only)
```http
GET /api/email/queue/status
Authorization: Bearer <token>
```

#### Clear Queue (Super Admin Only)
```http
DELETE /api/email/queue/clear
Authorization: Bearer <token>
```

#### Send Test Email (Admin Only)
```http
POST /api/email/test
Authorization: Bearer <token>
Content-Type: application/json

{
  "to": "test@example.com",
  "template": "loan-status-change"
}
```

## Email Templates

### Template Location
Templates are stored in `templates/email/` directory and automatically loaded on service initialization.

### Available Templates
1. **loan-status-change.html** - For loan status updates
2. **agreement-ready.html** - For agreement ready notifications
3. **loan-reminder.html** - For payment reminders

### Template Variables
Templates use `{{variable}}` syntax for variable substitution:

#### Loan Status Change Template
- `{{clientName}}` - Client's full name
- `{{loanId}}` - Loan ID
- `{{loanAmount}}` - Formatted loan amount
- `{{loanStatus}}` - New loan status
- `{{approvalMessage}}` - Approval message (if approved)
- `{{rejectionReason}}` - Rejection reason (if rejected)

#### Agreement Ready Template
- `{{clientName}}` - Client's full name
- `{{loanId}}` - Loan ID
- `{{loanAmount}}` - Formatted loan amount
- `{{loanTerm}}` - Loan term in months
- `{{interestRate}}` - Interest rate percentage
- `{{downloadLink}}` - Agreement download URL

#### Payment Reminder Template
- `{{clientName}}` - Client's full name
- `{{loanId}}` - Loan ID
- `{{dueDate}}` - Payment due date
- `{{amountDue}}` - Amount due
- `{{daysUntilDue}}` - Days until payment is due

### Template Customization
Templates support conditional blocks:
```html
{{#if approvalMessage}}
<div class="approval-message">
  <p>{{approvalMessage}}</p>
</div>
{{/if}}
```

## Integration

### Automatic Notifications

#### Loan Status Changes
Automatically triggered when loan status is updated via `loanController.updateLoanStatus()`:
```javascript
// In loan controller
const statusChange = {
  newStatus: 'approved',
  approvalMessage: 'Your loan has been approved!',
  rejectionReason: null
};

await emailService.sendLoanStatusChangeNotification(loan, client, statusChange);
```

#### Agreement Generation
Automatically triggered when agreement is generated via `agreementController.generateAgreement()`:
```javascript
// In agreement controller
const downloadLink = `${req.protocol}://${req.get('host')}/api/agreements/${loan._id}/download`;
await emailService.sendAgreementReadyNotification(loan, client, downloadLink);
```

### Manual Integration
```javascript
const emailService = require('./services/emailService');

// Send custom notification
const emailId = await emailService.sendCustomEmail(
  'recipient@example.com',
  'Subject',
  { html: '<p>Content</p>', text: 'Content' },
  { priority: 'high' }
);
```

## Queue System

### Features
- **Automatic processing** with configurable delays
- **Retry logic** with exponential backoff (3 attempts by default)
- **Error handling** with detailed logging
- **Priority support** (high, normal, low)
- **Status tracking** (queued, sending, sent, failed, retry, permanently_failed)

### Queue Management
```javascript
// Get queue status
const status = emailService.getQueueStatus();

// Clear queue (admin operation)
const clearedCount = emailService.clearQueue();
```

### Configuration
```javascript
// In EmailService constructor
this.retryAttempts = 3;        // Number of retry attempts
this.retryDelay = 5000;        // Base retry delay (5 seconds)
// Exponential backoff: 5s, 10s, 20s
```

## Error Handling

### Error Types
1. **Configuration Errors** - Missing email credentials
2. **Template Errors** - Missing or invalid templates
3. **Validation Errors** - Invalid email addresses or data
4. **Network Errors** - SMTP connection issues
5. **Rate Limiting** - Email service rate limits

### Error Responses
```json
{
  "success": false,
  "error": {
    "code": "EMAIL_SEND_ERROR",
    "message": "Failed to send email",
    "details": "SMTP connection failed",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

### Logging
All email operations are logged with appropriate levels:
- **INFO** - Successful operations
- **WARN** - Retry attempts
- **ERROR** - Failed operations
- **AUDIT** - Administrative actions

## Testing

### Test Script
Run the comprehensive test script:
```bash
node test-email-system.js
```

### Test Coverage
1. **Service initialization** and configuration
2. **Template loading** and rendering
3. **Queue operations** and processing
4. **Email sending** (mock and real)
5. **Error handling** and retry logic

### Mock Mode
When email credentials are not configured, the system runs in mock mode:
- Emails are logged instead of sent
- Queue processing continues normally
- All functionality works except actual email delivery

## Security

### Access Control
- **Authentication required** for all endpoints
- **Role-based permissions** for different operations
- **Admin-only operations** for sensitive functions

### Data Protection
- **Email addresses validated** before processing
- **Template injection prevention** with safe rendering
- **Audit logging** for all email operations

### Rate Limiting
- **Built-in delays** between email sends
- **Connection pooling** for SMTP efficiency
- **Retry limits** to prevent infinite loops

## Monitoring

### Health Checks
```javascript
// Check email service health
const status = emailService.getQueueStatus();
// Returns: queueSize, isProcessing, templatesLoaded, transporterConfigured
```

### Metrics
- Queue size and processing status
- Email send success/failure rates
- Template loading status
- SMTP connection health

### Alerts
- Failed email delivery after all retries
- Queue size exceeding thresholds
- SMTP connection failures
- Template loading errors

## Troubleshooting

### Common Issues

#### 1. Emails Not Sending
- Check EMAIL_USER and EMAIL_PASS in .env
- Verify Gmail App Password is correct
- Check SMTP connection and firewall settings

#### 2. Template Errors
- Ensure templates directory exists
- Check template syntax and variables
- Verify template file permissions

#### 3. Queue Issues
- Check queue status via API endpoint
- Review error logs for failed emails
- Clear queue if necessary (admin operation)

#### 4. Permission Errors
- Verify user role and permissions
- Check JWT token validity
- Ensure proper authentication headers

### Debug Mode
Enable detailed logging by setting log level to 'debug' in logger configuration.

### Support
For additional support or custom template requirements, contact the development team.

## Future Enhancements

### Planned Features
1. **SMS notifications** integration
2. **Email scheduling** for future delivery
3. **Template editor** web interface
4. **Advanced analytics** and reporting
5. **Multi-language support** for templates
6. **Email campaign management**

### Performance Optimizations
1. **Redis queue** for distributed processing
2. **Batch email processing** for bulk operations
3. **Template caching** for improved performance
4. **Connection pooling** optimization