/**
 * Base Repository Class
 * Provides common CRUD operations for all repositories
 */

const { AppError } = require('../utils/customErrors');
const { logger } = require('../utils/logger');

class BaseRepository {
  constructor(model) {
    this.model = model;
    this.modelName = model.modelName;
  }

  /**
   * Create a new document
   * @param {Object} data - Document data
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Created document
   */
  async create(data, options = {}) {
    try {
      logger.info(`Creating new ${this.modelName}`, { data: this._sanitizeLogData(data) });

      const document = new this.model(data);
      const savedDocument = await document.save(options);

      logger.info(`${this.modelName} created successfully`, {
        id: savedDocument._id,
        modelName: this.modelName
      });

      return savedDocument;
    } catch (error) {
      logger.error(`Error creating ${this.modelName}`, error, { data: this._sanitizeLogData(data) });
      throw this._handleError(error, 'CREATE');
    }
  }

  /**
   * Find document by ID
   * @param {String} id - Document ID
   * @param {Object} options - Query options (populate, select, etc.)
   * @returns {Promise<Object|null>} Found document or null
   */
  async findById(id, options = {}) {
    try {
      logger.debug(`Finding ${this.modelName} by ID`, { id, modelName: this.modelName });

      let query = this.model.findById(id);

      if (options.populate) {
        query = query.populate(options.populate);
      }

      if (options.select) {
        query = query.select(options.select);
      }

      const document = await query.exec();

      if (!document) {
        logger.warn(`${this.modelName} not found`, { id, modelName: this.modelName });
        return null;
      }

      return document;
    } catch (error) {
      logger.error(`Error finding ${this.modelName} by ID`, error, { id, modelName: this.modelName });
      throw this._handleError(error, 'FIND_BY_ID');
    }
  }

  /**
   * Find documents with filters
   * @param {Object} filters - Query filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of documents
   */
  async find(filters = {}, options = {}) {
    try {
      logger.debug(`Finding ${this.modelName} documents`, {
        filters: this._sanitizeLogData(filters),
        modelName: this.modelName
      });

      let query = this.model.find(filters);

      if (options.populate) {
        query = query.populate(options.populate);
      }

      if (options.select) {
        query = query.select(options.select);
      }

      if (options.sort) {
        query = query.sort(options.sort);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.skip) {
        query = query.skip(options.skip);
      }

      const documents = await query.exec();

      logger.debug(`Found ${documents.length} ${this.modelName} documents`);

      return documents;
    } catch (error) {
      logger.error(`Error finding ${this.modelName} documents`, error, {
        filters: this._sanitizeLogData(filters),
        modelName: this.modelName
      });
      throw this._handleError(error, 'FIND');
    }
  }

  /**
   * Find one document with filters
   * @param {Object} filters - Query filters
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>} Found document or null
   */
  async findOne(filters = {}, options = {}) {
    try {
      logger.debug(`Finding one ${this.modelName} document`, {
        filters: this._sanitizeLogData(filters),
        modelName: this.modelName
      });

      let query = this.model.findOne(filters);

      if (options.populate) {
        query = query.populate(options.populate);
      }

      if (options.select) {
        query = query.select(options.select);
      }

      if (options.sort) {
        query = query.sort(options.sort);
      }

      const document = await query.exec();

      return document;
    } catch (error) {
      logger.error(`Error finding one ${this.modelName} document`, error, {
        filters: this._sanitizeLogData(filters),
        modelName: this.modelName
      });
      throw this._handleError(error, 'FIND_ONE');
    }
  }

  /**
   * Update document by ID
   * @param {String} id - Document ID
   * @param {Object} updateData - Update data
   * @param {Object} options - Update options
   * @returns {Promise<Object|null>} Updated document or null
   */
  async updateById(id, updateData, options = {}) {
    try {
      logger.info(`Updating ${this.modelName} by ID`, {
        id,
        updateData: this._sanitizeLogData(updateData),
        modelName: this.modelName
      });

      const defaultOptions = { new: true, runValidators: true };
      const mergedOptions = { ...defaultOptions, ...options };

      const document = await this.model.findByIdAndUpdate(id, updateData, mergedOptions);

      if (!document) {
        logger.warn(`${this.modelName} not found for update`, { id, modelName: this.modelName });
        return null;
      }

      logger.info(`${this.modelName} updated successfully`, {
        id: document._id,
        modelName: this.modelName
      });

      return document;
    } catch (error) {
      logger.error(`Error updating ${this.modelName} by ID`, error, {
        id,
        updateData: this._sanitizeLogData(updateData),
        modelName: this.modelName
      });
      throw this._handleError(error, 'UPDATE_BY_ID');
    }
  }

  /**
   * Update multiple documents
   * @param {Object} filters - Query filters
   * @param {Object} updateData - Update data
   * @param {Object} options - Update options
   * @returns {Promise<Object>} Update result
   */
  async updateMany(filters, updateData, options = {}) {
    try {
      logger.info(`Updating multiple ${this.modelName} documents`, {
        filters: this._sanitizeLogData(filters),
        updateData: this._sanitizeLogData(updateData),
        modelName: this.modelName
      });

      const result = await this.model.updateMany(filters, updateData, options);

      logger.info(`Updated ${result.modifiedCount} ${this.modelName} documents`, {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        modelName: this.modelName
      });

      return result;
    } catch (error) {
      logger.error(`Error updating multiple ${this.modelName} documents`, error, {
        filters: this._sanitizeLogData(filters),
        updateData: this._sanitizeLogData(updateData),
        modelName: this.modelName
      });
      throw this._handleError(error, 'UPDATE_MANY');
    }
  }

  /**
   * Delete document by ID
   * @param {String} id - Document ID
   * @returns {Promise<Object|null>} Deleted document or null
   */
  async deleteById(id) {
    try {
      logger.info(`Deleting ${this.modelName} by ID`, { id, modelName: this.modelName });

      const document = await this.model.findByIdAndDelete(id);

      if (!document) {
        logger.warn(`${this.modelName} not found for deletion`, { id, modelName: this.modelName });
        return null;
      }

      logger.info(`${this.modelName} deleted successfully`, {
        id: document._id,
        modelName: this.modelName
      });

      return document;
    } catch (error) {
      logger.error(`Error deleting ${this.modelName} by ID`, error, {
        id,
        modelName: this.modelName
      });
      throw this._handleError(error, 'DELETE_BY_ID');
    }
  }

  /**
   * Delete multiple documents
   * @param {Object} filters - Query filters
   * @returns {Promise<Object>} Delete result
   */
  async deleteMany(filters) {
    try {
      logger.info(`Deleting multiple ${this.modelName} documents`, {
        filters: this._sanitizeLogData(filters),
        modelName: this.modelName
      });

      const result = await this.model.deleteMany(filters);

      logger.info(`Deleted ${result.deletedCount} ${this.modelName} documents`, {
        deletedCount: result.deletedCount,
        modelName: this.modelName
      });

      return result;
    } catch (error) {
      logger.error(`Error deleting multiple ${this.modelName} documents`, error, {
        filters: this._sanitizeLogData(filters),
        modelName: this.modelName
      });
      throw this._handleError(error, 'DELETE_MANY');
    }
  }

  /**
   * Count documents
   * @param {Object} filters - Query filters
   * @returns {Promise<Number>} Document count
   */
  async count(filters = {}) {
    try {
      logger.debug(`Counting ${this.modelName} documents`, {
        filters: this._sanitizeLogData(filters),
        modelName: this.modelName
      });

      const count = await this.model.countDocuments(filters);

      logger.debug(`Found ${count} ${this.modelName} documents`);

      return count;
    } catch (error) {
      logger.error(`Error counting ${this.modelName} documents`, error, {
        filters: this._sanitizeLogData(filters),
        modelName: this.modelName
      });
      throw this._handleError(error, 'COUNT');
    }
  }

  /**
   * Check if document exists
   * @param {Object} filters - Query filters
   * @returns {Promise<Boolean>} True if exists, false otherwise
   */
  async exists(filters) {
    try {
      logger.debug(`Checking if ${this.modelName} exists`, {
        filters: this._sanitizeLogData(filters),
        modelName: this.modelName
      });

      const document = await this.model.findOne(filters).select('_id').lean();

      return !!document;
    } catch (error) {
      logger.error(`Error checking if ${this.modelName} exists`, error, {
        filters: this._sanitizeLogData(filters),
        modelName: this.modelName
      });
      throw this._handleError(error, 'EXISTS');
    }
  }

  /**
   * Paginate documents
   * @param {Object} filters - Query filters
   * @param {Object} options - Pagination options
   * @returns {Promise<Object>} Paginated result
   */
  async paginate(filters = {}, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sort = { createdAt: -1 },
        populate,
        select
      } = options;

      const skip = (page - 1) * limit;

      logger.debug(`Paginating ${this.modelName} documents`, {
        filters: this._sanitizeLogData(filters),
        page,
        limit,
        modelName: this.modelName
      });

      // Get total count
      const total = await this.count(filters);

      // Get documents
      const documents = await this.find(filters, {
        skip,
        limit,
        sort,
        populate,
        select
      });

      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      const result = {
        documents,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage,
          hasPrevPage,
          nextPage: hasNextPage ? page + 1 : null,
          prevPage: hasPrevPage ? page - 1 : null
        }
      };

      logger.debug(`Paginated ${documents.length} ${this.modelName} documents`, {
        total,
        page,
        totalPages,
        modelName: this.modelName
      });

      return result;
    } catch (error) {
      logger.error(`Error paginating ${this.modelName} documents`, error, {
        filters: this._sanitizeLogData(filters),
        options,
        modelName: this.modelName
      });
      throw this._handleError(error, 'PAGINATE');
    }
  }

  /**
   * Aggregate documents
   * @param {Array} pipeline - Aggregation pipeline
   * @returns {Promise<Array>} Aggregation result
   */
  async aggregate(pipeline) {
    try {
      logger.debug(`Aggregating ${this.modelName} documents`, {
        pipelineLength: pipeline.length,
        modelName: this.modelName
      });

      const result = await this.model.aggregate(pipeline);

      logger.debug(`Aggregated ${result.length} ${this.modelName} results`);

      return result;
    } catch (error) {
      logger.error(`Error aggregating ${this.modelName} documents`, error, {
        pipelineLength: pipeline.length,
        modelName: this.modelName
      });
      throw this._handleError(error, 'AGGREGATE');
    }
  }

  /**
   * Handle database errors and convert to application errors
   * @param {Error} error - Database error
   * @param {String} operation - Operation type
   * @returns {AppError} Application error
   * @private
   */
  _handleError(error, operation) {
    // Mongoose validation error
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return new AppError(`Validation failed: ${messages.join(', ')}`, 400, 'VALIDATION_ERROR');
    }

    // Mongoose cast error (invalid ObjectId)
    if (error.name === 'CastError') {
      return new AppError(`Invalid ${error.path}: ${error.value}`, 400, 'INVALID_ID');
    }

    // Duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return new AppError(`${field} already exists`, 409, 'DUPLICATE_KEY');
    }

    // MongoDB connection error
    if (error.name === 'MongoNetworkError' || error.name === 'MongoTimeoutError') {
      return new AppError('Database connection error', 503, 'DATABASE_ERROR');
    }

    // Default error
    return new AppError(
      `Database operation failed: ${operation}`,
      500,
      'DATABASE_OPERATION_ERROR'
    );
  }

  /**
   * Sanitize data for logging (remove sensitive fields)
   * @param {Object} data - Data to sanitize
   * @returns {Object} Sanitized data
   * @private
   */
  _sanitizeLogData(data) {
    if (!data || typeof data !== 'object') return data;

    const sensitiveFields = ['password', 'passwordHash', 'token', 'secret'];
    const sanitized = { ...data };

    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }
}

module.exports = BaseRepository;