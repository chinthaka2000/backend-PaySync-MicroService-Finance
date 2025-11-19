const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

// Load environment variables FIRST with explicit path
dotenv.config({ path: __dirname + "/.env" });

// Validate environment configuration
const { config } = require("./config/environment");

// Now import and call connectDB after env vars are loaded
const { connectDB } = require("./config/db");

// Cache service
const cacheService = require('./services/cacheService');
const cacheWarmupService = require('./services/cacheWarmupService');

// Models
const Client = require("./models/Client");
const Loan = require("./models/Loan");

// Routes
const authRoutes = require("./routes/authRoutes");
const clientRoutes = require("./routes/clientRoutes");
const loanRoutes = require("./routes/loanRoutes");
const agentRoutes = require("./routes/agentRoutes");
const staffRoutes = require("./routes/staffRoutes");
const regionalAdminRoutes = require("./routes/regionalAdminRoutes");
const moderateAdminRoutes = require("./routes/moderateAdminRoutes");
const superAdminRoutes = require("./routes/superAdminRoutes");
const ceoRoutes = require("./routes/ceoRoutes");
const mobileAppRoutes = require("./routes/mobileAppRoutes");
const healthRoutes = require("./routes/healthRoutes");

// Middleware
const { apiRateLimit } = require("./middlewares/authMiddleware");
const { errorHandler, addRequestId } = require("./middlewares/errorHandler");
const performanceMonitor = require("./middlewares/performanceMonitor");
const { errorMonitoringMiddleware } = require("./middlewares/errorMonitor");
const { logger, logInfo, logError } = require("./utils/logger");

// Security middleware
const {
  corsOptions,
  generalRateLimit,
  authRateLimit,
  fileUploadRateLimit,
  securityHeaders,
  requestSizeLimiter,
  ipFilter,
  securityAuditLogger,
  configureTrustProxy
} = require("./middlewares/security");

// Input sanitization middleware
const {
  inputSanitizer,
  strictInputSanitizer,
  fileUploadSanitizer
} = require("./middlewares/sanitization");

// Compression and optimization middleware - TEMPORARILY DISABLED
// const { createCompressionMiddleware } = require('./middlewares/compressionMiddleware');

// Enhanced error handling for uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...', {
    error: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });
  process.exit(1);
});

// Enhanced error handling for unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! 💥 Shutting down...', {
    error: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logInfo('SIGTERM received. Shutting down gracefully...');
  if (server) {
    server.close(() => {
      logInfo('Process terminated');
      process.exit(0);
    });
  }
});

process.on('SIGINT', () => {
  logInfo('SIGINT received. Shutting down gracefully...');
  if (server) {
    server.close(() => {
      logInfo('Process terminated');
      process.exit(0);
    });
  }
});

const PORT = config.port;

// Initialize database and cache
const initializeServices = async () => {
  try {
    await connectDB();
    await cacheService.connect();

    // Initialize cache warmup service after a short delay
    setTimeout(async () => {
      try {
        await cacheWarmupService.initialize();
      } catch (error) {
        logError('Cache warmup initialization failed', error);
      }
    }, 5000); // 5 second delay to allow database to fully initialize

    logInfo('✅ All services initialized successfully');
  } catch (error) {
    logError('❌ Failed to initialize services', error);
    process.exit(1);
  }
};

initializeServices();

const app = express();

// Configure trust proxy for production
configureTrustProxy(app);

// Request ID middleware (must be first)
app.use(addRequestId);

// Security headers middleware (early in the chain)
app.use(securityHeaders);

// IP filtering and security audit logging
app.use(ipFilter);
app.use(securityAuditLogger);

// Performance monitoring middleware
app.use(performanceMonitor);

// Error monitoring middleware
app.use(errorMonitoringMiddleware);

// CORS configuration with environment-specific origins
app.use(cors(corsOptions));

// Request size limiting
app.use(requestSizeLimiter);

// General rate limiting for all routes
app.use(generalRateLimit);

// Body parsing middleware with security considerations
app.use(express.json({
  limit: config.security.maxFileSize,
  strict: true, // Only parse arrays and objects
  type: 'application/json'
}));
app.use(express.urlencoded({
  extended: true,
  limit: config.security.maxFileSize,
  parameterLimit: 100 // Limit number of parameters
}));

// Input sanitization for all requests
app.use(inputSanitizer());

// Response compression and optimization - TEMPORARILY DISABLED TO FIX AUTH
// app.use(createCompressionMiddleware({
//   level: config.isProduction ? 6 : 1, // Higher compression in production
//   threshold: 1024 // Only compress responses larger than 1KB
// }));

// Root route
app.get("/", (req, res) => {
  res.send("Welcome to the Loan Management System API");
});

// Health monitoring routes
app.use("/health", healthRoutes);

// API routes with specific security middleware
app.use("/api/auth", strictInputSanitizer, authRoutes);
app.use("/clientsAPI", clientRoutes);
app.use("/api/staff", strictInputSanitizer, staffRoutes);
app.use("/api/loans", loanRoutes);
app.use("/api/loans", require('./routes/optimizedLoanRoutes'));
app.use("/api/performance", require('./routes/performanceRoutes'));
app.use("/api/agents", agentRoutes);
app.use("/api/regional-admin", strictInputSanitizer, regionalAdminRoutes);
app.use("/api/moderate-admin", strictInputSanitizer, moderateAdminRoutes);
app.use("/api/super-admin", strictInputSanitizer, superAdminRoutes);
app.use("/api/ceo", strictInputSanitizer, ceoRoutes);
app.use("/api/mobile", mobileAppRoutes);
app.use("/api/agreements", require('./routes/agreementRoutes'));
app.use("/api/files", fileUploadRateLimit, fileUploadSanitizer, require('./routes/fileRoutes'));
app.use("/api/email", require('./routes/emailRoutes'));

// Global error handling middleware (must be last)
app.use(errorHandler);

// Handle undefined routes
app.all('*', (req, res, next) => {
  const err = new Error(`Can't find ${req.originalUrl} on this server!`);
  err.status = 'fail';
  err.statusCode = 404;
  next(err);
});

const server = app.listen(PORT, () => {
  logInfo(`✅ Server is running on http://localhost:${PORT}`, {
    port: PORT,
    environment: config.nodeEnv,
    isProduction: config.isProduction,
    security: {
      corsOrigins: config.security.corsOrigins,
      rateLimitEnabled: true,
      inputSanitizationEnabled: true,
      securityHeadersEnabled: true
    },
    timestamp: new Date().toISOString()
  });
});
// Export app for testing
module.exports = app;