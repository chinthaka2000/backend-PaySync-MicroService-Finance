# Health Monitoring System

This document describes the comprehensive health monitoring system implemented for the PaySync backend application.

## Overview

The health monitoring system provides real-time insights into system performance, error rates, database connectivity, and overall application health. It includes automated alerting for critical issues and detailed metrics collection.

## Components

### 1. Health Service (`services/healthService.js`)

The core service that collects and aggregates system metrics:

- **System Metrics**: Memory usage, CPU information, platform details
- **Database Status**: Connection state, response times, collection counts
- **Performance Metrics**: Request counts, response times, throughput
- **Error Tracking**: Error rates, recent errors, error patterns
- **Service Status**: Email service, file storage, logging system status

### 2. Health Controller (`controllers/healthController.js`)

Provides HTTP endpoints for accessing health information:

- `GET /health` - Comprehensive health status
- `GET /health/basic` - Lightweight health check
- `GET /health/metrics` - Detailed system metrics (admin only)
- `GET /health/database` - Database-specific health info (admin only)
- `GET /health/errors` - Error metrics and recent errors (admin only)
- `POST /health/reset-metrics` - Reset metrics (super admin only)

### 3. Error Monitor (`middlewares/errorMonitor.js`)

Tracks error patterns and provides alerting:

- **Error Rate Monitoring**: Tracks overall error percentage
- **Consecutive Error Detection**: Alerts on multiple consecutive errors
- **Error Burst Detection**: Identifies sudden spikes in errors
- **Security Event Tracking**: Monitors authentication failures and potential attacks
- **Automated Alerting**: Configurable thresholds with cooldown periods

### 4. Performance Monitor (`middlewares/performanceMonitor.js`)

Enhanced middleware for request performance tracking:

- **Response Time Tracking**: Records all request response times
- **Slow Request Detection**: Logs requests exceeding 2 seconds
- **Integration with Health Service**: Feeds metrics to central health system

## API Endpoints

### Public Endpoints (No Authentication Required)

#### GET /health
Returns comprehensive system health status.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy|degraded|unhealthy",
    "timestamp": "2024-01-01T00:00:00Z",
    "uptime": {
      "milliseconds": 3600000,
      "seconds": 3600,
      "formatted": "0d 1h 0m 0s"
    },
    "database": {
      "connected": true,
      "state": "connected",
      "host": "localhost",
      "port": 27017,
      "name": "paysync",
      "responseTime": "15ms",
      "collections": {
        "clients": 150,
        "loans": 75,
        "staff": 25,
        "regions": 5
      }
    },
    "system": {
      "memory": {
        "total": "16.00 GB",
        "used": "8.50 GB",
        "free": "7.50 GB",
        "usage": 53.12,
        "process": {
          "rss": "125.50 MB",
          "heapTotal": "45.20 MB",
          "heapUsed": "32.10 MB",
          "external": "2.15 MB"
        }
      },
      "cpu": {
        "cores": 8,
        "model": "Intel(R) Core(TM) i7-9750H CPU @ 2.60GHz",
        "loadAverage": [1.2, 1.5, 1.8],
        "architecture": "x64"
      },
      "platform": {
        "type": "Darwin",
        "platform": "darwin",
        "release": "20.6.0",
        "hostname": "MacBook-Pro"
      }
    },
    "performance": {
      "requestCount": 1250,
      "averageResponseTime": 145,
      "maxResponseTime": 2340,
      "minResponseTime": 12,
      "requestsPerSecond": "2.35"
    },
    "errors": {
      "totalErrors": 15,
      "totalRequests": 1250,
      "errorRate": 1.2,
      "recentErrors": []
    },
    "services": {
      "email": "healthy|unhealthy|disabled",
      "fileStorage": "healthy|unhealthy",
      "logging": "healthy"
    }
  }
}
```

#### GET /health/basic
Returns lightweight health status for load balancers and quick checks.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00Z",
    "uptime": "0d 1h 15m 30s",
    "requestCount": 1250,
    "averageResponseTime": 145
  }
}
```

### Protected Endpoints (Authentication Required)

#### GET /health/metrics
Returns detailed system metrics. Requires admin privileges.

#### GET /health/database
Returns database-specific health information. Requires admin privileges.

#### GET /health/errors
Returns error metrics and recent error details. Requires admin privileges.

#### POST /health/reset-metrics
Resets all collected metrics. Requires super admin privileges.

## Error Monitoring and Alerting

### Alert Types

1. **CONSECUTIVE_ERRORS**: Triggered after 5 consecutive errors
2. **ERROR_BURST**: Triggered when 20+ errors occur within 1 minute
3. **HIGH_ERROR_RATE**: Triggered when error rate exceeds 10%
4. **POTENTIAL_BRUTE_FORCE**: Triggered after 5+ auth failures from same IP in 5 minutes

### Alert Configuration

Default thresholds can be modified:

```javascript
const errorThresholds = {
  errorRate: 10,        // Alert if error rate exceeds 10%
  consecutiveErrors: 5, // Alert after 5 consecutive errors
  errorBurst: 20        // Alert if 20 errors in 1 minute
};
```

### Alert Cooldown

Alerts have a 5-minute cooldown period to prevent spam. Each alert type per IP/system has its own cooldown timer.

## Performance Monitoring

### Metrics Collected

- **Request Count**: Total number of requests processed
- **Response Times**: Average, minimum, and maximum response times
- **Throughput**: Requests per second
- **Slow Requests**: Requests taking longer than 2 seconds
- **Error Rates**: Percentage of failed requests

### Performance Thresholds

- **Slow Request**: > 2000ms (logged as warning)
- **Degraded Performance**: Average response time > 5000ms
- **High Memory Usage**: > 90% memory utilization

## System Metrics

### Memory Monitoring

- **Total/Used/Free Memory**: System-wide memory statistics
- **Process Memory**: Node.js process-specific memory usage
- **Memory Usage Percentage**: Current memory utilization

### CPU Monitoring

- **Core Count**: Number of CPU cores
- **Load Average**: System load averages (1, 5, 15 minutes)
- **CPU Model**: Processor information

### Platform Information

- **Operating System**: Type, platform, release version
- **Hostname**: System hostname
- **Architecture**: CPU architecture (x64, arm64, etc.)

## Database Health Monitoring

### Connection Status

- **Connection State**: Connected, connecting, disconnecting, disconnected
- **Response Time**: Database query response time
- **Connection Pool**: Pool size and utilization

### Collection Statistics

- **Document Counts**: Number of documents in each collection
- **Collection Health**: Availability and responsiveness of collections

## Integration and Usage

### Middleware Integration

The health monitoring system is automatically integrated through middleware:

```javascript
// In index.js
app.use(performanceMonitor);
app.use(errorMonitoringMiddleware);
```

### Programmatic Access

```javascript
const healthService = require('./services/healthService');

// Get current health status
const health = await healthService.getHealthStatus();

// Record custom metrics
healthService.recordRequest(responseTime, isError);

// Get specific metrics
const systemMetrics = healthService.getSystemMetrics();
const performanceMetrics = healthService.getPerformanceMetrics();
```

## Testing

Run the health monitoring test suite:

```bash
node test-health-monitoring.js
```

The test suite verifies:
- Basic health endpoint functionality
- Comprehensive health data collection
- Metrics recording and retrieval
- Error monitoring and tracking
- Performance monitoring accuracy

## Monitoring Best Practices

### 1. Regular Health Checks

Set up external monitoring to regularly check the `/health/basic` endpoint:

```bash
# Example cron job for health monitoring
*/5 * * * * curl -f http://localhost:5000/health/basic || echo "Health check failed"
```

### 2. Alert Integration

Integrate with external monitoring systems:

- **Prometheus**: Export metrics for Prometheus scraping
- **Grafana**: Create dashboards for visualization
- **PagerDuty**: Set up incident management
- **Slack/Discord**: Configure webhook notifications

### 3. Log Analysis

Monitor log files for patterns:

```bash
# Monitor error logs
tail -f logs/error.log

# Monitor performance logs
tail -f logs/performance.log

# Monitor security events
tail -f logs/security.log
```

### 4. Capacity Planning

Use metrics for capacity planning:

- Monitor memory usage trends
- Track request volume growth
- Analyze response time patterns
- Plan for peak load scenarios

## Configuration

### Environment Variables

```bash
# Logging level
LOG_LEVEL=info

# Email service (for notifications)
EMAIL_SERVICE_ENABLED=true
EMAIL_HOST=smtp.gmail.com
EMAIL_USER=your-email@gmail.com

# Health check intervals
HEALTH_CHECK_INTERVAL=300000  # 5 minutes
```

### Customization

Modify thresholds and behavior:

```javascript
// Update error thresholds
const { errorMonitor } = require('./middlewares/errorMonitor');
errorMonitor.updateThresholds({
  errorRate: 15,        // Increase error rate threshold
  consecutiveErrors: 10 // Increase consecutive error threshold
});

// Customize health service
healthService.maxHistorySize = 200; // Keep more history
```

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Check for memory leaks in application code
   - Monitor process memory growth over time
   - Consider increasing server memory

2. **High Error Rates**
   - Review recent error logs
   - Check database connectivity
   - Verify external service availability

3. **Slow Response Times**
   - Analyze database query performance
   - Check for blocking operations
   - Review middleware performance

4. **Database Connection Issues**
   - Verify MongoDB service status
   - Check network connectivity
   - Review connection pool settings

### Debug Mode

Enable debug logging for detailed information:

```bash
LOG_LEVEL=debug node index.js
```

## Security Considerations

- Admin endpoints require proper authentication
- Sensitive system information is protected
- Security events are logged and monitored
- Rate limiting prevents abuse of health endpoints

## Future Enhancements

Planned improvements:

1. **Real-time Dashboards**: Web-based monitoring interface
2. **Custom Metrics**: Application-specific metric collection
3. **Predictive Alerting**: ML-based anomaly detection
4. **Integration APIs**: Webhook support for external systems
5. **Historical Analysis**: Long-term trend analysis and reporting