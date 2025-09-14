/**
 * Production Configuration Validation Script
 * Validates that all required environment variables are properly configured for production
 */

const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const { validateEnvironment, config } = require('../config/environment');

/**
 * Production-specific validation checks
 */
function validateProductionConfig() {
  console.log('🔍 Validating production configuration...\n');

  const errors = [];
  const warnings = [];

  // Check if running in production mode
  if (config.nodeEnv !== 'production') {
    warnings.push('NODE_ENV is not set to "production"');
  }

  // Validate JWT secrets strength
  if (config.jwt.secret.length < 64) {
    errors.push('JWT_SECRET should be at least 64 characters long for production');
  }

  if (config.jwt.refreshSecret.length < 64) {
    errors.push('JWT_REFRESH_SECRET should be at least 64 characters long for production');
  }

  // Check for default/weak secrets
  const weakSecrets = [
    'paysync_super_secret_jwt_key_2024_production_ready',
    'paysync_refresh_token_secret_key_2024_secure',
    'your_super_secure_jwt_secret',
    'your_super_secure_refresh_secret'
  ];

  if (weakSecrets.some(weak => config.jwt.secret.includes(weak))) {
    errors.push('JWT_SECRET appears to be using a default/example value. Use a unique, strong secret.');
  }

  if (weakSecrets.some(weak => config.jwt.refreshSecret.includes(weak))) {
    errors.push('JWT_REFRESH_SECRET appears to be using a default/example value. Use a unique, strong secret.');
  }

  // Validate database configuration
  if (!config.database.uri.includes('mongodb+srv://') && !config.database.uri.includes('mongodb://')) {
    errors.push('MONGO_URI should use a proper MongoDB connection string');
  }

  if (config.database.uri.includes('localhost') && config.isProduction) {
    warnings.push('Database URI points to localhost in production environment');
  }

  // Validate CORS origins for production
  const hasLocalhostOrigins = config.security.corsOrigins.some(origin =>
    origin.includes('localhost') || origin.includes('127.0.0.1')
  );

  if (hasLocalhostOrigins && config.isProduction) {
    warnings.push('CORS origins include localhost URLs in production environment');
  }

  // Check for HTTPS in production CORS origins
  if (config.isProduction) {
    const hasHttpOrigins = config.security.corsOrigins.some(origin =>
      origin.startsWith('http://') && !origin.includes('localhost')
    );

    if (hasHttpOrigins) {
      errors.push('Production CORS origins should use HTTPS, not HTTP');
    }
  }

  // Validate email configuration
  if (config.email.user.includes('example.com') || config.email.user.includes('your_email')) {
    errors.push('EMAIL_USER appears to be using a placeholder value');
  }

  if (config.email.pass.includes('your_password') || config.email.pass.length < 8) {
    errors.push('EMAIL_PASS appears to be weak or using a placeholder value');
  }

  // Check database pool settings for production
  if (config.isProduction) {
    if (config.database.options.maxPoolSize < 10) {
      warnings.push('Consider increasing DB_MAX_POOL_SIZE for production (recommended: 20+)');
    }

    if (config.database.options.minPoolSize < 5) {
      warnings.push('Consider increasing DB_MIN_POOL_SIZE for production (recommended: 10+)');
    }
  }

  // Check rate limiting settings
  if (config.security.rateLimitMaxRequests > 1000) {
    warnings.push('Rate limit seems very high, consider lowering for better security');
  }

  // Check file upload size
  if (config.security.maxFileSize > 10 * 1024 * 1024) { // 10MB
    warnings.push('File upload size limit is quite high, ensure this is intentional');
  }

  // Check logging configuration for production
  if (config.isProduction && config.logging.level === 'debug') {
    warnings.push('Debug logging is enabled in production, consider using "info" or "warn"');
  }

  // Display results
  console.log('📊 Configuration Summary:');
  console.log(`   Environment: ${config.nodeEnv}`);
  console.log(`   Port: ${config.port}`);
  console.log(`   Database Pool: ${config.database.options.minPoolSize}-${config.database.options.maxPoolSize} connections`);
  console.log(`   CORS Origins: ${config.security.corsOrigins.length} configured`);
  console.log(`   Rate Limit: ${config.security.rateLimitMaxRequests} requests per ${config.security.rateLimitWindowMs / 1000}s`);
  console.log(`   Max File Size: ${(config.security.maxFileSize / 1024 / 1024).toFixed(1)}MB`);
  console.log(`   Log Level: ${config.logging.level}\n`);

  // Display warnings
  if (warnings.length > 0) {
    console.log('⚠️  Warnings:');
    warnings.forEach((warning, index) => {
      console.log(`   ${index + 1}. ${warning}`);
    });
    console.log();
  }

  // Display errors
  if (errors.length > 0) {
    console.log('❌ Errors:');
    errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
    console.log();
    console.log('🚨 Please fix the above errors before deploying to production!\n');
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.log('✅ Configuration is valid but has warnings. Review the warnings above.\n');
  } else {
    console.log('✅ Production configuration validation passed!\n');
  }

  // Additional production readiness checks
  console.log('🔧 Production Readiness Checklist:');
  console.log('   □ SSL/TLS certificates configured');
  console.log('   □ Reverse proxy (nginx/Apache) configured');
  console.log('   □ Firewall rules configured');
  console.log('   □ Database backups scheduled');
  console.log('   □ Monitoring and alerting set up');
  console.log('   □ Log rotation configured');
  console.log('   □ Health check endpoints tested');
  console.log('   □ Load testing completed');
  console.log('   □ Security audit completed\n');
}

// Run validation if script is executed directly
if (require.main === module) {
  try {
    validateProductionConfig();
  } catch (error) {
    console.error('❌ Configuration validation failed:', error.message);
    process.exit(1);
  }
}

module.exports = { validateProductionConfig };