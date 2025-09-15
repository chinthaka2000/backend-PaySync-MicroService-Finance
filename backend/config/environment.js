/**
 * Environment Configuration Validation
 * Validates all required environment variables and provides defaults
 */

const joi = require('joi');

// Define environment validation schema
const envSchema = joi.object({
  NODE_ENV: joi.string()
    .valid('development', 'production', 'test', 'staging')
    .default('development'),

  PORT: joi.number()
    .port()
    .default(5000),

  MONGO_URI: joi.string()
    .uri()
    .required()
    .description('MongoDB connection string is required'),

  // JWT Configuration
  JWT_SECRET: joi.string()
    .min(32)
    .required()
    .description('JWT secret must be at least 32 characters'),

  JWT_REFRESH_SECRET: joi.string()
    .min(32)
    .required()
    .description('JWT refresh secret must be at least 32 characters'),

  JWT_EXPIRES_IN: joi.string()
    .default('15m')
    .description('JWT token expiration time'),

  JWT_REFRESH_EXPIRES_IN: joi.string()
    .default('7d')
    .description('JWT refresh token expiration time'),

  // Email Configuration
  EMAIL_USER: joi.string()
    .email()
    .required()
    .description('Email user is required for notifications'),

  EMAIL_PASS: joi.string()
    .required()
    .description('Email password is required'),

  // Security Configuration
  CORS_ORIGINS: joi.string()
    .default('http://localhost:5173,http://localhost:8081')
    .description('Comma-separated list of allowed CORS origins'),

  RATE_LIMIT_WINDOW_MS: joi.number()
    .default(15 * 60 * 1000) // 15 minutes
    .description('Rate limiting window in milliseconds'),

  RATE_LIMIT_MAX_REQUESTS: joi.number()
    .default(100)
    .description('Maximum requests per window'),

  // Database Configuration
  DB_MAX_POOL_SIZE: joi.number()
    .default(10)
    .description('Maximum database connection pool size'),

  DB_MIN_POOL_SIZE: joi.number()
    .default(5)
    .description('Minimum database connection pool size'),

  DB_MAX_IDLE_TIME_MS: joi.number()
    .default(30000)
    .description('Maximum idle time for database connections'),

  DB_SERVER_SELECTION_TIMEOUT_MS: joi.number()
    .default(5000)
    .description('Database server selection timeout'),

  DB_SOCKET_TIMEOUT_MS: joi.number()
    .default(45000)
    .description('Database socket timeout'),

  // File Upload Configuration
  MAX_FILE_SIZE: joi.number()
    .default(5 * 1024 * 1024) // 5MB
    .description('Maximum file upload size in bytes'),

  // Redis Configuration (optional)
  REDIS_URL: joi.string()
    .uri()
    .optional()
    .description('Redis connection URL for caching'),

  REDIS_HOST: joi.string()
    .default('localhost')
    .description('Redis host'),

  REDIS_PORT: joi.number()
    .port()
    .default(6379)
    .description('Redis port'),

  REDIS_PASSWORD: joi.string()
    .optional()
    .description('Redis password'),

  REDIS_DB: joi.number()
    .default(0)
    .description('Redis database number'),

  // Cloudinary Configuration (optional)
  CLOUDINARY_CLOUD_NAME: joi.string()
    .optional()
    .description('Cloudinary cloud name'),

  CLOUDINARY_API_KEY: joi.string()
    .optional()
    .description('Cloudinary API key'),

  CLOUDINARY_API_SECRET: joi.string()
    .optional()
    .description('Cloudinary API secret'),

  // Logging Configuration
  LOG_LEVEL: joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info')
    .description('Logging level'),

  LOG_FILE_MAX_SIZE: joi.string()
    .default('20m')
    .description('Maximum log file size'),

  LOG_FILE_MAX_FILES: joi.number()
    .default(5)
    .description('Maximum number of log files to keep')
}).unknown(); // Allow unknown environment variables

/**
 * Validate environment variables
 * @returns {Object} Validated environment configuration
 */
function validateEnvironment() {
  const { error, value } = envSchema.validate(process.env, {
    abortEarly: false,
    stripUnknown: false
  });

  if (error) {
    const errorMessages = error.details.map(detail => {
      return `${detail.path.join('.')}: ${detail.message}`;
    });

    console.error('❌ Environment validation failed:');
    errorMessages.forEach(msg => console.error(`  - ${msg}`));
    process.exit(1);
  }

  return value;
}

/**
 * Get environment-specific configuration
 * @param {Object} env - Validated environment variables
 * @returns {Object} Environment-specific configuration
 */
function getEnvironmentConfig(env) {
  const isProduction = env.NODE_ENV === 'production';
  const isDevelopment = env.NODE_ENV === 'development';
  const isTest = env.NODE_ENV === 'test';

  return {
    // Environment info
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    isProduction,
    isDevelopment,
    isTest,

    // Database configuration
    database: {
      uri: env.MONGO_URI,
      options: {
        maxPoolSize: env.DB_MAX_POOL_SIZE,
        minPoolSize: env.DB_MIN_POOL_SIZE,
        maxIdleTimeMS: env.DB_MAX_IDLE_TIME_MS,
        serverSelectionTimeoutMS: env.DB_SERVER_SELECTION_TIMEOUT_MS,
        socketTimeoutMS: env.DB_SOCKET_TIMEOUT_MS,
        family: 4 // Use IPv4, skip trying IPv6
      }
    },

    // JWT configuration
    jwt: {
      secret: env.JWT_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      expiresIn: env.JWT_EXPIRES_IN,
      refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN
    },

    // Email configuration
    email: {
      user: env.EMAIL_USER,
      pass: env.EMAIL_PASS
    },

    // Security configuration
    security: {
      corsOrigins: env.CORS_ORIGINS.split(',').map(origin => origin.trim()),
      rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
      rateLimitMaxRequests: env.RATE_LIMIT_MAX_REQUESTS,
      maxFileSize: env.MAX_FILE_SIZE,

      // Production-specific security settings
      trustProxy: isProduction,
      secureCookies: isProduction,
      httpsOnly: isProduction
    },

    // Logging configuration
    logging: {
      level: env.LOG_LEVEL,
      maxSize: env.LOG_FILE_MAX_SIZE,
      maxFiles: env.LOG_FILE_MAX_FILES,

      // Production-specific logging
      enableConsole: isDevelopment || isTest,
      enableFile: isProduction || env.NODE_ENV === 'staging'
    },

    // Redis configuration (optional)
    redis: env.REDIS_URL ? {
      url: env.REDIS_URL
    } : {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD,
      db: env.REDIS_DB
    },

    // Cloudinary configuration (optional)
    cloudinary: (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) ? {
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      apiSecret: env.CLOUDINARY_API_SECRET
    } : null
  };
}

// Validate environment and export configuration
const validatedEnv = validateEnvironment();
const config = getEnvironmentConfig(validatedEnv);

module.exports = {
  validateEnvironment,
  getEnvironmentConfig,
  config
};