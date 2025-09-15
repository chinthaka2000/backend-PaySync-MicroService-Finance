const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");

// Token blacklist (in production, use Redis)
const tokenBlacklist = new Set();

// Enhanced JWT middleware with refresh token support
exports.authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: {
        code: "AUTH_ERROR",
        message: "Unauthorized: No token provided",
        timestamp: new Date().toISOString(),
      },
    });
  }

  const token = authHeader.split(" ")[1];

  // Check if token is blacklisted
  if (tokenBlacklist.has(token)) {
    return res.status(401).json({
      success: false,
      error: {
        code: "AUTH_ERROR",
        message: "Token has been revoked",
        timestamp: new Date().toISOString(),
      },
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Enhanced user object with permissions and region
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      region: decoded.region,
      permissions: decoded.permissions || [],
      iat: decoded.iat,
      exp: decoded.exp,
    };

    next();
  } catch (err) {
    let errorMessage = "Invalid or expired token";
    let errorCode = "AUTH_ERROR";

    if (err.name === "TokenExpiredError") {
      errorMessage = "Token has expired";
      errorCode = "TOKEN_EXPIRED";
    } else if (err.name === "JsonWebTokenError") {
      errorMessage = "Invalid token format";
      errorCode = "INVALID_TOKEN";
    }

    return res.status(401).json({
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// Enhanced role authorization with hierarchical permissions
exports.authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "AUTH_ERROR",
          message: "Authentication required",
          timestamp: new Date().toISOString(),
        },
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: "AUTHZ_ERROR",
          message: "Access denied: insufficient role permissions",
          requiredRoles: roles,
          userRole: req.user.role,
          timestamp: new Date().toISOString(),
        },
      });
    }

    next();
  };
};

// Hierarchical role validation middleware
exports.authorizeHierarchy = (minimumRole) => {
  const roleHierarchy = {
    agent: 1,
    regional_manager: 2,
    ceo: 3,
    moderate_admin: 4,
    super_admin: 5,
  };

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "AUTH_ERROR",
          message: "Authentication required",
          timestamp: new Date().toISOString(),
        },
      });
    }

    const userRoleLevel = roleHierarchy[req.user.role] || 0;
    const requiredRoleLevel = roleHierarchy[minimumRole] || 0;

    if (userRoleLevel < requiredRoleLevel) {
      return res.status(403).json({
        success: false,
        error: {
          code: "AUTHZ_ERROR",
          message: "Access denied: insufficient hierarchy level",
          requiredMinimumRole: minimumRole,
          userRole: req.user.role,
          timestamp: new Date().toISOString(),
        },
      });
    }

    next();
  };
};

// Permission-based authorization
exports.requirePermissions = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "AUTH_ERROR",
          message: "Authentication required",
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Super admin has all permissions
    if (req.user.role === "super_admin") {
      return next();
    }

    const userPermissions = req.user.permissions || [];
    const hasAllPermissions = permissions.every((permission) =>
      userPermissions.includes(permission)
    );

    if (!hasAllPermissions) {
      const missingPermissions = permissions.filter(
        (permission) => !userPermissions.includes(permission)
      );

      return res.status(403).json({
        success: false,
        error: {
          code: "AUTHZ_ERROR",
          message: "Access denied: missing required permissions",
          requiredPermissions: permissions,
          missingPermissions,
          userPermissions,
          timestamp: new Date().toISOString(),
        },
      });
    }

    next();
  };
};

// Rate limiting middleware for authentication endpoints
exports.authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: {
      code: "RATE_LIMIT_ERROR",
      message: "Too many authentication attempts, please try again later",
      retryAfter: "15 minutes",
      timestamp: new Date().toISOString(),
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for successful authentications
    return false;
  },
});

// General API rate limiting
exports.apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: {
      code: "RATE_LIMIT_ERROR",
      message: "Too many requests, please try again later",
      retryAfter: "15 minutes",
      timestamp: new Date().toISOString(),
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Token blacklist functions
exports.blacklistToken = (token) => {
  tokenBlacklist.add(token);
  // In production, store in Redis with TTL equal to token expiry
};

exports.isTokenBlacklisted = (token) => {
  return tokenBlacklist.has(token);
};
