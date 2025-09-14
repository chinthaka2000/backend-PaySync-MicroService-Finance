/**
 * @fileoverview Pagination Utility - Handles pagination for large datasets
 * @module utils/pagination
 */

const mongoose = require('mongoose');
const { logger } = require('./logger');

/**
 * Pagination configuration constants
 */
const PAGINATION_CONSTANTS = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1
};

/**
 * Pagination utility class
 * Provides consistent pagination across the application
 */
class PaginationHelper {
  /**
   * Parse pagination parameters from request
   * @param {Object} query - Request query parameters
   * @param {number} [query.page] - Page number (1-based)
   * @param {number} [query.limit] - Items per page
   * @param {string} [query.sortBy] - Field to sort by
   * @param {string} [query.sortOrder] - Sort order (asc/desc)
   * @returns {Object} Parsed pagination parameters
   */
  static parsePaginationParams(query) {
    const page = Math.max(1, parseInt(query.page) || PAGINATION_CONSTANTS.DEFAULT_PAGE);
    const limit = Math.min(
      PAGINATION_CONSTANTS.MAX_LIMIT,
      Math.max(PAGINATION_CONSTANTS.MIN_LIMIT, parseInt(query.limit) || PAGINATION_CONSTANTS.DEFAULT_LIMIT)
    );
    const skip = (page - 1) * limit;

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const sort = { [sortBy]: sortOrder };

    return {
      page,
      limit,
      skip,
      sort,
      sortBy,
      sortOrder: query.sortOrder || 'desc'
    };
  }

  /**
   * Create pagination metadata
   * @param {number} totalItems - Total number of items
   * @param {number} page - Current page
   * @param {number} limit - Items per page
   * @returns {Object} Pagination metadata
   */
  static createPaginationMeta(totalItems, page, limit) {
    const totalPages = Math.ceil(totalItems / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return {
      currentPage: page,
      totalPages,
      totalItems,
      itemsPerPage: limit,
      hasNextPage,
      hasPrevPage,
      nextPage: hasNextPage ? page + 1 : null,
      prevPage: hasPrevPage ? page - 1 : null,
      startIndex: (page - 1) * limit + 1,
      endIndex: Math.min(page * limit, totalItems)
    };
  }

  /**
   * Paginate Mongoose query
   * @param {Object} model - Mongoose model
   * @param {Object} filter - Query filter
   * @param {Object} options - Pagination options
   * @param {number} [options.page=1] - Page number
   * @param {number} [options.limit=20] - Items per page
   * @param {Object} [options.sort] - Sort criteria
   * @param {string|Array} [options.populate] - Fields to populate
   * @param {Object} [options.select] - Fields to select
   * @returns {Promise<Object>} Paginated results
   */
  static async paginateQuery(model, filter = {}, options = {}) {
    try {
      const {
        page = PAGINATION_CONSTANTS.DEFAULT_PAGE,
        limit = PAGINATION_CONSTANTS.DEFAULT_LIMIT,
        sort = { createdAt: -1 },
        populate,
        select
      } = options;

      const skip = (page - 1) * limit;

      // Build the query
      let query = model.find(filter);

      // Apply selection
      if (select) {
        query = query.select(select);
      }

      // Apply population
      if (populate) {
        if (Array.isArray(populate)) {
          populate.forEach(pop => {
            query = query.populate(pop);
          });
        } else {
          query = query.populate(populate);
        }
      }

      // Apply sorting, skip, and limit
      query = query.sort(sort).skip(skip).limit(limit);

      // Execute query and count in parallel
      const [items, totalItems] = await Promise.all([
        query.exec(),
        model.countDocuments(filter)
      ]);

      // Create pagination metadata
      const pagination = this.createPaginationMeta(totalItems, page, limit);

      return {
        success: true,
        data: items,
        pagination
      };
    } catch (error) {
      logger.error('Pagination query failed', {
        error: error.message,
        filter,
        options
      });
      throw error;
    }
  }

  /**
   * Paginate aggregation pipeline
   * @param {Object} model - Mongoose model
   * @param {Array} pipeline - Aggregation pipeline
   * @param {Object} options - Pagination options
   * @param {number} [options.page=1] - Page number
   * @param {number} [options.limit=20] - Items per page
   * @returns {Promise<Object>} Paginated results
   */
  static async paginateAggregation(model, pipeline = [], options = {}) {
    try {
      const {
        page = PAGINATION_CONSTANTS.DEFAULT_PAGE,
        limit = PAGINATION_CONSTANTS.DEFAULT_LIMIT
      } = options;

      const skip = (page - 1) * limit;

      // Create count pipeline (without skip/limit)
      const countPipeline = [
        ...pipeline,
        { $count: 'totalItems' }
      ];

      // Create data pipeline (with skip/limit)
      const dataPipeline = [
        ...pipeline,
        { $skip: skip },
        { $limit: limit }
      ];

      // Execute both pipelines in parallel
      const [countResult, items] = await Promise.all([
        model.aggregate(countPipeline),
        model.aggregate(dataPipeline)
      ]);

      const totalItems = countResult.length > 0 ? countResult[0].totalItems : 0;
      const pagination = this.createPaginationMeta(totalItems, page, limit);

      return {
        success: true,
        data: items,
        pagination
      };
    } catch (error) {
      logger.error('Aggregation pagination failed', {
        error: error.message,
        pipeline,
        options
      });
      throw error;
    }
  }

  /**
   * Cursor-based pagination for large datasets
   * More efficient for very large collections
   * @param {Object} model - Mongoose model
   * @param {Object} filter - Query filter
   * @param {Object} options - Pagination options
   * @param {string} [options.cursor] - Cursor for next page
   * @param {number} [options.limit=20] - Items per page
   * @param {string} [options.cursorField='_id'] - Field to use for cursor
   * @param {Object} [options.sort] - Sort criteria
   * @param {string|Array} [options.populate] - Fields to populate
   * @returns {Promise<Object>} Cursor-paginated results
   */
  static async paginateCursor(model, filter = {}, options = {}) {
    try {
      const {
        cursor,
        limit = PAGINATION_CONSTANTS.DEFAULT_LIMIT,
        cursorField = '_id',
        sort = { [cursorField]: -1 },
        populate
      } = options;

      // Add cursor filter if provided
      const queryFilter = { ...filter };
      if (cursor) {
        const sortDirection = Object.values(sort)[0];
        const operator = sortDirection === 1 ? '$gt' : '$lt';
        queryFilter[cursorField] = { [operator]: cursor };
      }

      // Build query
      let query = model.find(queryFilter)
        .sort(sort)
        .limit(limit + 1); // Get one extra to check if there's a next page

      // Apply population
      if (populate) {
        if (Array.isArray(populate)) {
          populate.forEach(pop => {
            query = query.populate(pop);
          });
        } else {
          query = query.populate(populate);
        }
      }

      const items = await query.exec();
      const hasNextPage = items.length > limit;

      // Remove the extra item if it exists
      if (hasNextPage) {
        items.pop();
      }

      // Get next cursor
      const nextCursor = hasNextPage && items.length > 0
        ? items[items.length - 1][cursorField]
        : null;

      return {
        success: true,
        data: items,
        pagination: {
          hasNextPage,
          nextCursor,
          limit,
          count: items.length
        }
      };
    } catch (error) {
      logger.error('Cursor pagination failed', {
        error: error.message,
        filter,
        options
      });
      throw error;
    }
  }

  /**
   * Search with pagination
   * Combines text search with pagination
   * @param {Object} model - Mongoose model
   * @param {string} searchTerm - Search term
   * @param {Array<string>} searchFields - Fields to search in
   * @param {Object} filter - Additional filters
   * @param {Object} options - Pagination options
   * @returns {Promise<Object>} Paginated search results
   */
  static async paginateSearch(model, searchTerm, searchFields, filter = {}, options = {}) {
    try {
      if (!searchTerm || !searchFields || searchFields.length === 0) {
        return this.paginateQuery(model, filter, options);
      }

      // Create search filter
      const searchFilter = {
        $or: searchFields.map(field => ({
          [field]: { $regex: searchTerm, $options: 'i' }
        }))
      };

      // Combine with existing filter
      const combinedFilter = {
        $and: [filter, searchFilter]
      };

      return this.paginateQuery(model, combinedFilter, options);
    } catch (error) {
      logger.error('Search pagination failed', {
        error: error.message,
        searchTerm,
        searchFields,
        filter,
        options
      });
      throw error;
    }
  }

  /**
   * Validate pagination parameters
   * @param {Object} params - Pagination parameters
   * @returns {Object} Validation result
   */
  static validatePaginationParams(params) {
    const errors = [];

    if (params.page && (isNaN(params.page) || params.page < 1)) {
      errors.push('Page must be a positive integer');
    }

    if (params.limit && (isNaN(params.limit) || params.limit < 1 || params.limit > PAGINATION_CONSTANTS.MAX_LIMIT)) {
      errors.push(`Limit must be between 1 and ${PAGINATION_CONSTANTS.MAX_LIMIT}`);
    }

    if (params.sortOrder && !['asc', 'desc'].includes(params.sortOrder.toLowerCase())) {
      errors.push('Sort order must be either "asc" or "desc"');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Create pagination links for API responses
   * @param {string} baseUrl - Base URL for pagination links
   * @param {Object} pagination - Pagination metadata
   * @param {Object} queryParams - Additional query parameters
   * @returns {Object} Pagination links
   */
  static createPaginationLinks(baseUrl, pagination, queryParams = {}) {
    const createUrl = (page) => {
      const params = new URLSearchParams({
        ...queryParams,
        page: page.toString(),
        limit: pagination.itemsPerPage.toString()
      });
      return `${baseUrl}?${params.toString()}`;
    };

    const links = {
      self: createUrl(pagination.currentPage),
      first: createUrl(1),
      last: createUrl(pagination.totalPages)
    };

    if (pagination.hasPrevPage) {
      links.prev = createUrl(pagination.prevPage);
    }

    if (pagination.hasNextPage) {
      links.next = createUrl(pagination.nextPage);
    }

    return links;
  }
}

/**
 * Express middleware for automatic pagination
 * @param {Object} options - Middleware options
 * @param {number} [options.defaultLimit] - Default items per page
 * @param {number} [options.maxLimit] - Maximum items per page
 * @returns {Function} Express middleware
 */
const paginationMiddleware = (options = {}) => {
  const {
    defaultLimit = PAGINATION_CONSTANTS.DEFAULT_LIMIT,
    maxLimit = PAGINATION_CONSTANTS.MAX_LIMIT
  } = options;

  return (req, res, next) => {
    // Parse pagination parameters
    const paginationParams = PaginationHelper.parsePaginationParams(req.query);

    // Apply custom limits
    paginationParams.limit = Math.min(maxLimit, paginationParams.limit || defaultLimit);
    paginationParams.skip = (paginationParams.page - 1) * paginationParams.limit;

    // Validate parameters
    const validation = PaginationHelper.validatePaginationParams(paginationParams);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PAGINATION_PARAMS',
          message: 'Invalid pagination parameters',
          details: validation.errors
        }
      });
    }

    // Attach to request object
    req.pagination = paginationParams;

    // Add helper method to response
    res.paginate = (data, totalItems) => {
      const pagination = PaginationHelper.createPaginationMeta(
        totalItems,
        paginationParams.page,
        paginationParams.limit
      );

      const links = PaginationHelper.createPaginationLinks(
        `${req.protocol}://${req.get('host')}${req.path}`,
        pagination,
        req.query
      );

      return res.json({
        success: true,
        data,
        pagination,
        links
      });
    };

    next();
  };
};

module.exports = {
  PaginationHelper,
  paginationMiddleware,
  PAGINATION_CONSTANTS
};