/**
 * @fileoverview Authentication Controller - Handles user authentication operations
 * @module controllers/authController
 */

const bcrypt = require('bcryptjs');
const Staff = require('../models/Staff');
const { generateTokenPair, refreshAccessToken, revokeRefreshToken, revokeAllUserTokens } = require('../utils/jwtUtils');
const { validateRoleCreation } = require('../utils/permissions');

/**
 * Staff login with enhanced security and JWT token generation
 * @async
 * @function login
 * @param {Object} req - Express request object
 * @param {Object} req.body - Login credentials
 * @param {string} req.body.email - User email address
 * @param {string} req.body.password - User password
 * @param {Object} res - Express response object
 * @returns {Promise<void>} JSON response with authentication result
 * 
 * @example
 * // POST /api/auth/login
 * {
 *   "email": "user@example.com",
 *   "password": "password123"
 * }
 * 
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "message": "Login successful",
 *   "data": {
 *     "user": {
 *       "id": "507f1f77bcf86cd799439011",
 *       "email": "user@example.com",
 *       "firstName": "John",
 *       "lastName": "Doe",
 *       "role": "agent"
 *     },
 *     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *     "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *   }
 * }
 * 
 * @example
 * // Error Response (401)
 * {
 *   "success": false,
 *   "error": {
 *     "code": "AUTH_ERROR",
 *     "message": "Invalid email or password",
 *     "timestamp": "2024-01-01T10:00:00.000Z"
 *   }
 * }
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Find user with password field
    const user = await Staff.findOne({ email }).select('+passwordHash').populate('region');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Invalid email or password',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Invalid email or password',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Generate token pair
    const tokens = generateTokenPair(user);

    // Log successful login
    console.log(`Successful login: ${user.email} (${user.role}) at ${new Date().toISOString()}`);

    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          region: user.region,
          permissions: user.permissions
        },
        tokens
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Login error:', error);

    // Check if response has already been sent
    if (res.headersSent) {
      return;
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error during login',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Refresh access token
 */
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Refresh token is required',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Function to get user by ID
    const getUserById = async (userId) => {
      return await Staff.findById(userId).populate('region');
    };

    // Refresh the access token
    const tokens = await refreshAccessToken(refreshToken, getUserById);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: { tokens },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: error.message || 'Token refresh failed',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Logout user (revoke refresh token)
 */
exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      const revoked = revokeRefreshToken(refreshToken);
      if (revoked) {
        console.log(`Refresh token revoked for user logout at ${new Date().toISOString()}`);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Logout successful',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error during logout',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Logout from all devices (revoke all refresh tokens)
 */
exports.logoutAll = async (req, res) => {
  try {
    const userId = req.user.userId;

    const revokedCount = revokeAllUserTokens(userId);

    console.log(`All tokens revoked for user ${userId}: ${revokedCount} tokens at ${new Date().toISOString()}`);

    res.status(200).json({
      success: true,
      message: 'Logged out from all devices successfully',
      data: { revokedTokens: revokedCount },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error during logout all',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Get current user profile
 */
exports.getProfile = async (req, res) => {
  try {
    const user = await Staff.findById(req.user.userId)
      .populate('region')
      .populate('createdBy', 'name email role');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          region: user.region,
          area: user.area,
          permissions: user.permissions,
          createdBy: user.createdBy,
          createdAt: user.createdAt
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error while fetching profile',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Change password
 */
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Current password and new password are required',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'New password must be at least 6 characters long',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Get user with password
    const user = await Staff.findById(userId).select('+passwordHash');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Current password is incorrect',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await Staff.findByIdAndUpdate(userId, { passwordHash: newPasswordHash });

    // Revoke all existing refresh tokens to force re-login
    revokeAllUserTokens(userId);

    console.log(`Password changed for user ${user.email} at ${new Date().toISOString()}`);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully. Please login again.',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error while changing password',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Validate role creation permissions
 */
exports.validateRoleCreation = async (req, res) => {
  try {
    const { targetRole } = req.body;
    const creatorRole = req.user.role;

    if (!targetRole) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Target role is required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const validation = validateRoleCreation(creatorRole, targetRole);

    res.status(200).json({
      success: true,
      message: 'Role creation validation completed',
      data: {
        canCreate: validation.valid,
        reason: validation.message,
        creatorRole,
        targetRole
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Role validation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error during role validation',
        timestamp: new Date().toISOString()
      }
    });
  }
};

module.exports = exports;