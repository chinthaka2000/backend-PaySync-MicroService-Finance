/**
 * @fileoverview Authentication Controller - Handles user authentication operations
 * @module controllers/authController
 */

const bcrypt = require("bcryptjs");
const Staff = require("../models/Staff");
const {
  generateTokenPair,
  refreshAccessToken,
  revokeRefreshToken,
  revokeAllUserTokens,
} = require("../utils/jwtUtils");
const { validateRoleCreation } = require("../utils/permissions");

/**
 * Staff login with enhanced security and JWT token generation
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      if (!res.headersSent)
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Email and password are required",
            timestamp: new Date().toISOString(),
          },
        });
      return;
    }

    const user = await Staff.findOne({ email })
      .select("+passwordHash")
      .populate("region");

    if (!user) {
      if (!res.headersSent)
        return res.status(401).json({
          success: false,
          error: {
            code: "AUTH_ERROR",
            message: "Invalid email or password",
            timestamp: new Date().toISOString(),
          },
        });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      if (!res.headersSent)
        return res.status(401).json({
          success: false,
          error: {
            code: "AUTH_ERROR",
            message: "Invalid email or password",
            timestamp: new Date().toISOString(),
          },
        });
      return;
    }

    const tokens = generateTokenPair(user);

    console.log(
      `Successful login: ${user.email} (${
        user.role
      }) at ${new Date().toISOString()}`
    );

    if (!res.headersSent)
      return res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            region: user.region,
            permissions: user.permissions,
          },
          tokens,
        },
        timestamp: new Date().toISOString(),
      });
  } catch (error) {
    console.error("Login error:", error);
    if (!res.headersSent)
      return res.status(500).json({
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "Internal server error during login",
          timestamp: new Date().toISOString(),
        },
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
      if (!res.headersSent)
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Refresh token is required",
            timestamp: new Date().toISOString(),
          },
        });
      return;
    }

    const getUserById = async (userId) =>
      await Staff.findById(userId).populate("region");

    const tokens = await refreshAccessToken(refreshToken, getUserById);

    if (!res.headersSent)
      return res.status(200).json({
        success: true,
        message: "Token refreshed successfully",
        data: { tokens },
        timestamp: new Date().toISOString(),
      });
  } catch (error) {
    console.error("Token refresh error:", error);
    if (!res.headersSent)
      return res.status(401).json({
        success: false,
        error: {
          code: "AUTH_ERROR",
          message: error.message || "Token refresh failed",
          timestamp: new Date().toISOString(),
        },
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
      if (revoked)
        console.log(
          `Refresh token revoked for user logout at ${new Date().toISOString()}`
        );
    }

    if (!res.headersSent)
      return res.status(200).json({
        success: true,
        message: "Logout successful",
        timestamp: new Date().toISOString(),
      });
  } catch (error) {
    console.error("Logout error:", error);
    if (!res.headersSent)
      return res.status(500).json({
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "Internal server error during logout",
          timestamp: new Date().toISOString(),
        },
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

    console.log(
      `All tokens revoked for user ${userId}: ${revokedCount} tokens at ${new Date().toISOString()}`
    );

    if (!res.headersSent)
      return res.status(200).json({
        success: true,
        message: "Logged out from all devices successfully",
        data: { revokedTokens: revokedCount },
        timestamp: new Date().toISOString(),
      });
  } catch (error) {
    console.error("Logout all error:", error);
    if (!res.headersSent)
      return res.status(500).json({
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "Internal server error during logout all",
          timestamp: new Date().toISOString(),
        },
      });
  }
};

/**
 * Get current user profile
 */
exports.getProfile = async (req, res) => {
  try {
    const user = await Staff.findById(req.user.userId)
      .populate("region")
      .populate("createdBy", "name email role");

    if (!user) {
      if (!res.headersSent)
        return res.status(404).json({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "User not found",
            timestamp: new Date().toISOString(),
          },
        });
      return;
    }

    if (!res.headersSent)
      return res.status(200).json({
        success: true,
        message: "Profile retrieved successfully",
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
            createdAt: user.createdAt,
          },
        },
        timestamp: new Date().toISOString(),
      });
  } catch (error) {
    console.error("Get profile error:", error);
    if (!res.headersSent)
      return res.status(500).json({
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "Internal server error while fetching profile",
          timestamp: new Date().toISOString(),
        },
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

    if (!currentPassword || !newPassword) {
      if (!res.headersSent)
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Current password and new password are required",
            timestamp: new Date().toISOString(),
          },
        });
      return;
    }

    if (newPassword.length < 6) {
      if (!res.headersSent)
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "New password must be at least 6 characters long",
            timestamp: new Date().toISOString(),
          },
        });
      return;
    }

    const user = await Staff.findById(userId).select("+passwordHash");
    if (!user) {
      if (!res.headersSent)
        return res.status(404).json({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "User not found",
            timestamp: new Date().toISOString(),
          },
        });
      return;
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash
    );
    if (!isCurrentPasswordValid) {
      if (!res.headersSent)
        return res.status(400).json({
          success: false,
          error: {
            code: "AUTH_ERROR",
            message: "Current password is incorrect",
            timestamp: new Date().toISOString(),
          },
        });
      return;
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await Staff.findByIdAndUpdate(userId, { passwordHash: newPasswordHash });
    revokeAllUserTokens(userId);

    console.log(
      `Password changed for user ${user.email} at ${new Date().toISOString()}`
    );

    if (!res.headersSent)
      return res.status(200).json({
        success: true,
        message: "Password changed successfully. Please login again.",
        timestamp: new Date().toISOString(),
      });
  } catch (error) {
    console.error("Change password error:", error);
    if (!res.headersSent)
      return res.status(500).json({
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "Internal server error while changing password",
          timestamp: new Date().toISOString(),
        },
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
      if (!res.headersSent)
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Target role is required",
            timestamp: new Date().toISOString(),
          },
        });
      return;
    }

    const validation = validateRoleCreation(creatorRole, targetRole);

    if (!res.headersSent)
      return res.status(200).json({
        success: true,
        message: "Role creation validation completed",
        data: {
          canCreate: validation.valid,
          reason: validation.message,
          creatorRole,
          targetRole,
        },
        timestamp: new Date().toISOString(),
      });
  } catch (error) {
    console.error("Role validation error:", error);
    if (!res.headersSent)
      return res.status(500).json({
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "Internal server error during role validation",
          timestamp: new Date().toISOString(),
        },
      });
  }
};

/**
 * Client login
 */
exports.clientLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Email and password are required",
          timestamp: new Date().toISOString(),
        },
      });
    }

    const ClientUser = require("../models/clientUsers");
    const user = await ClientUser.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "AUTH_ERROR",
          message: "Invalid email or password",
          timestamp: new Date().toISOString(),
        },
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: {
          code: "AUTH_ERROR",
          message: "Invalid email or password",
          timestamp: new Date().toISOString(),
        },
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: {
          code: "AUTH_ERROR",
          message: "Account is not active",
          timestamp: new Date().toISOString(),
        },
      });
    }

    const tokens = generateTokenPair(user);

    console.log(
      `Successful client login: ${user.email} at ${new Date().toISOString()}`
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          clientId: user.clientId,
        },
        tokens,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Client login error:", error);
    return res.status(500).json({
      success: false,
      error: {
        code: "SERVER_ERROR",
        message: "Internal server error during login",
        timestamp: new Date().toISOString(),
      },
    });
  }
};
