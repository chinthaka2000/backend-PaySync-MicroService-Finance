/**
 * Enhanced MongoDB Connection Configuration
 * Implements connection pooling, timeout settings, and production-ready configurations
 */

const mongoose = require('mongoose');
const { config } = require('./environment');
const { logger } = require('../utils/logger');

/**
 * MongoDB Connection Options
 * Optimized for production with proper pooling and timeout settings
 */
const getConnectionOptions = () => {
  const options = {
    ...config.database.options,

    // Connection pool settings
    maxPoolSize: config.database.options.maxPoolSize, // Maximum number of connections
    minPoolSize: config.database.options.minPoolSize, // Minimum number of connections
    maxIdleTimeMS: config.database.options.maxIdleTimeMS, // Close connections after 30 seconds of inactivity

    // Timeout settings
    serverSelectionTimeoutMS: config.database.options.serverSelectionTimeoutMS, // How long to try selecting a server
    socketTimeoutMS: config.database.options.socketTimeoutMS, // How long a send or receive on a socket can take before timing out
    connectTimeoutMS: 10000, // How long to wait for a connection to be established

    // Heartbeat settings
    heartbeatFrequencyMS: 10000, // How often to check the server status

    // Write concern
    w: 'majority', // Wait for majority of replica set members to acknowledge writes
    wtimeoutMS: 5000, // Timeout for write concern

    // Read preference
    readPreference: 'primary', // Read from primary replica set member

    // Other settings
    retryWrites: true, // Retry writes on network errors
    retryReads: true, // Retry reads on network errors
    compressors: ['zlib'], // Enable compression

    // Production-specific settings
    ...(config.isProduction && {
      ssl: true, // Enable SSL in production
      sslValidate: true, // Validate SSL certificates
      authSource: 'admin' // Authentication database
    })
  };

  // Remove unsupported options for this MongoDB driver version
  delete options.bufferCommands;
  delete options.bufferMaxEntries;

  return options;
};

/**
 * Connection Event Handlers
 * Handles various MongoDB connection events for monitoring and logging
 */
const setupConnectionEventHandlers = () => {
  // Connection successful
  mongoose.connection.on('connected', () => {
    logger.info('✅ MongoDB connected successfully', {
      database: mongoose.connection.name,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      readyState: mongoose.connection.readyState
    });
  });

  // Connection error
  mongoose.connection.on('error', (err) => {
    logger.error('❌ MongoDB connection error', {
      error: err.message,
      stack: err.stack
    });
  });

  // Connection disconnected
  mongoose.connection.on('disconnected', () => {
    logger.warn('⚠️ MongoDB disconnected', {
      timestamp: new Date().toISOString()
    });
  });

  // Connection reconnected
  mongoose.connection.on('reconnected', () => {
    logger.info('🔄 MongoDB reconnected', {
      timestamp: new Date().toISOString()
    });
  });

  // Connection close
  mongoose.connection.on('close', () => {
    logger.info('🔒 MongoDB connection closed', {
      timestamp: new Date().toISOString()
    });
  });

  // Full setup completed
  mongoose.connection.on('open', () => {
    logger.info('📂 MongoDB connection opened', {
      database: mongoose.connection.name,
      collections: Object.keys(mongoose.connection.collections).length
    });
  });

  // Buffer overflow (when operations are queued because connection is down)
  mongoose.connection.on('fullsetup', () => {
    logger.info('🎯 MongoDB full setup completed (replica set)');
  });

  // Index build events
  mongoose.connection.on('index', (err) => {
    if (err) {
      logger.error('❌ MongoDB index build error', { error: err.message });
    } else {
      logger.info('📊 MongoDB index built successfully');
    }
  });
};

/**
 * Connection Health Check
 * Checks the health of the MongoDB connection
 */
const checkConnectionHealth = () => {
  const connection = mongoose.connection;

  return {
    isConnected: connection.readyState === 1,
    readyState: connection.readyState,
    readyStateText: getReadyStateText(connection.readyState),
    database: connection.name,
    host: connection.host,
    port: connection.port,
    collections: Object.keys(connection.collections).length,
    bufferCommands: connection.bufferCommands,
    bufferMaxEntries: connection.bufferMaxEntries
  };
};

/**
 * Get human-readable ready state text
 */
const getReadyStateText = (readyState) => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  return states[readyState] || 'unknown';
};

/**
 * Graceful Connection Shutdown
 * Properly closes the MongoDB connection
 */
const gracefulShutdown = async () => {
  try {
    logger.info('🔄 Closing MongoDB connection...');
    await mongoose.connection.close();
    logger.info('✅ MongoDB connection closed successfully');
  } catch (error) {
    logger.error('❌ Error closing MongoDB connection', {
      error: error.message,
      stack: error.stack
    });
  }
};

/**
 * Main Connection Function
 * Establishes connection to MongoDB with enhanced configuration
 */
const connectDB = async () => {
  try {
    // Set up event handlers before connecting
    setupConnectionEventHandlers();

    // Get connection options
    const options = getConnectionOptions();

    logger.info('🔄 Connecting to MongoDB...', {
      uri: config.database.uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'), // Hide credentials in logs
      options: {
        maxPoolSize: options.maxPoolSize,
        minPoolSize: options.minPoolSize,
        serverSelectionTimeoutMS: options.serverSelectionTimeoutMS,
        socketTimeoutMS: options.socketTimeoutMS
      }
    });

    // Connect to MongoDB
    await mongoose.connect(config.database.uri, options);

    // Log successful connection
    const healthCheck = checkConnectionHealth();
    logger.info('✅ MongoDB connection established', healthCheck);

    // Set up graceful shutdown handlers
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGUSR2', gracefulShutdown); // For nodemon restarts

  } catch (error) {
    logger.error('❌ MongoDB connection failed', {
      error: error.message,
      stack: error.stack,
      uri: config.database.uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')
    });

    // Exit process on connection failure
    process.exit(1);
  }
};

/**
 * Connection Retry Logic
 * Implements retry logic for connection failures
 */
const connectWithRetry = async (maxRetries = 5, retryDelay = 5000) => {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      await connectDB();
      return; // Success, exit retry loop
    } catch (error) {
      retries++;
      logger.warn(`MongoDB connection attempt ${retries}/${maxRetries} failed`, {
        error: error.message,
        nextRetryIn: retryDelay
      });

      if (retries >= maxRetries) {
        logger.error('❌ Maximum MongoDB connection retries exceeded');
        throw error;
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      retryDelay *= 1.5; // Exponential backoff
    }
  }
};

module.exports = {
  connectDB,
  connectWithRetry,
  checkConnectionHealth,
  gracefulShutdown,
  getConnectionOptions
};
