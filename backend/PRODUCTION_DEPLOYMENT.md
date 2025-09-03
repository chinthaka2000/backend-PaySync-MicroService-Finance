# Production Deployment Guide

This guide covers the production deployment and security configuration for the PaySync backend system.

## 🔧 Pre-Deployment Checklist

### 1. Environment Configuration

1. **Copy the production environment template:**
   ```bash
   cp .env.production.template .env.production
   ```

2. **Fill in production values in `.env.production`:**
   - Set `NODE_ENV=production`
   - Configure production MongoDB URI with SSL
   - Set strong, unique JWT secrets (64+ characters)
   - Configure production email settings
   - Set production CORS origins (HTTPS only)
   - Configure Redis for caching (recommended)
   - Set up Cloudinary for file storage

3. **Validate configuration:**
   ```bash
   npm run validate:config
   ```

### 2. Security Configuration

The system includes comprehensive security measures:

#### Authentication & Authorization
- JWT-based authentication with refresh tokens
- Role-based access control (RBAC)
- Hierarchical permission system
- Rate limiting on authentication endpoints

#### Input Security
- XSS protection and input sanitization
- SQL/NoSQL injection prevention
- Path traversal protection
- Request size limiting

#### Network Security
- CORS configuration with environment-specific origins
- Security headers (CSP, HSTS, X-Frame-Options, etc.)
- Rate limiting (general and endpoint-specific)
- IP filtering capabilities

#### File Security
- File type validation
- File size limits
- Secure filename sanitization
- Malicious file detection

### 3. Database Configuration

#### Connection Pooling
```javascript
// Production-optimized settings
DB_MAX_POOL_SIZE=20        // Maximum connections
DB_MIN_POOL_SIZE=10        // Minimum connections
DB_MAX_IDLE_TIME_MS=30000  // Connection idle timeout
DB_SERVER_SELECTION_TIMEOUT_MS=5000
DB_SOCKET_TIMEOUT_MS=45000
```

#### Indexes
Ensure all required indexes are created:
```bash
node scripts/createIndexes.js
```

### 4. SSL/TLS Configuration

For production deployment, configure SSL/TLS:

1. **Obtain SSL certificates** (Let's Encrypt, commercial CA, etc.)
2. **Configure reverse proxy** (nginx/Apache) with SSL termination
3. **Update CORS origins** to use HTTPS URLs only
4. **Enable HSTS headers** (automatically enabled in production mode)

## 🚀 Deployment Steps

### 1. Install Dependencies
```bash
npm ci --only=production
```

### 2. Validate Configuration
```bash
npm run validate:config
```

### 3. Run Security Tests
```bash
npm run test:security
```

### 4. Start Production Server
```bash
npm run start:prod
```

## 🔍 Monitoring & Health Checks

### Health Check Endpoint
```
GET /health
```

Returns comprehensive system status:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "database": {
    "connected": true,
    "responseTime": "15ms"
  },
  "services": {
    "email": "healthy",
    "fileStorage": "healthy"
  },
  "metrics": {
    "activeConnections": 45,
    "memoryUsage": "256MB"
  }
}
```

### Logging

Production logging configuration:
- **Log Level:** `warn` or `error` for production
- **Log Rotation:** Automatic with size and time limits
- **Structured Logging:** JSON format for easy parsing
- **Audit Trails:** Security-sensitive operations logged

### Performance Monitoring

Monitor these key metrics:
- Response times
- Database query performance
- Memory usage
- CPU utilization
- Error rates
- Active connections

## 🔒 Security Best Practices

### 1. Environment Variables
- Never commit `.env` files to version control
- Use strong, unique secrets for JWT tokens
- Rotate secrets regularly
- Use environment-specific configurations

### 2. Database Security
- Use MongoDB Atlas or properly secured self-hosted MongoDB
- Enable authentication and authorization
- Use SSL/TLS for database connections
- Regular security updates and patches

### 3. Network Security
- Use HTTPS only in production
- Configure proper firewall rules
- Implement DDoS protection
- Use a reverse proxy (nginx/Apache)

### 4. Application Security
- Keep dependencies updated
- Regular security audits
- Input validation and sanitization
- Proper error handling (no sensitive data in errors)

### 5. File Security
- Validate all file uploads
- Use secure file storage (Cloudinary recommended)
- Implement virus scanning for uploads
- Proper access controls for file downloads

## 🚨 Incident Response

### Security Incident Checklist
1. **Immediate Response:**
   - Identify and isolate affected systems
   - Check logs for suspicious activity
   - Notify relevant stakeholders

2. **Investigation:**
   - Analyze security logs
   - Identify attack vectors
   - Assess data exposure

3. **Recovery:**
   - Patch vulnerabilities
   - Update security configurations
   - Monitor for continued threats

4. **Post-Incident:**
   - Document lessons learned
   - Update security procedures
   - Implement additional safeguards

## 📊 Performance Optimization

### Database Optimization
- Proper indexing strategy
- Query optimization
- Connection pooling
- Regular maintenance

### Caching Strategy
- Redis for session storage
- Application-level caching
- Database query result caching
- CDN for static assets

### Load Balancing
- Multiple server instances
- Database read replicas
- Geographic distribution
- Auto-scaling configuration

## 🔧 Troubleshooting

### Common Issues

#### 1. Database Connection Issues
```bash
# Check database connectivity
node scripts/testConnection.js

# Verify connection pool settings
# Check MongoDB Atlas network access
# Verify authentication credentials
```

#### 2. Authentication Problems
```bash
# Verify JWT secrets are properly set
# Check token expiration settings
# Validate user permissions
```

#### 3. CORS Issues
```bash
# Verify CORS origins configuration
# Check for HTTPS/HTTP mismatches
# Validate domain names
```

#### 4. Rate Limiting Issues
```bash
# Check rate limit configurations
# Monitor rate limit logs
# Adjust limits if necessary
```

### Log Analysis
```bash
# View error logs
tail -f logs/error.log

# View security logs
tail -f logs/security.log

# View performance logs
tail -f logs/performance.log
```

## 📋 Maintenance Tasks

### Daily
- Monitor system health
- Check error logs
- Verify backup completion

### Weekly
- Review security logs
- Update dependencies
- Performance analysis

### Monthly
- Security audit
- Database maintenance
- Configuration review
- Disaster recovery testing

## 🆘 Support & Documentation

### Additional Resources
- [API Documentation](./API_DOCUMENTATION.md)
- [Security Configuration](./middlewares/security.js)
- [Environment Configuration](./config/environment.js)
- [Health Monitoring](./HEALTH_MONITORING_README.md)

### Emergency Contacts
- System Administrator: [contact info]
- Security Team: [contact info]
- Database Administrator: [contact info]

---

**Note:** This deployment guide should be customized based on your specific infrastructure and requirements. Always test thoroughly in a staging environment before deploying to production.