// utils/jwtUtils.js

const jwt = require('jsonwebtoken');
const { generateJWTPayload } = require('./permissions');

// Token storage (in production, use Redis)
const refreshTokenStore = new Map();

/**
 * Generate access token
 * @param {Object} user - User object from database
 * @returns {string} JWT access token
 */
function generateAccessToken(user) {
  const payload = generateJWTPayload(user);

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    issuer: 'paysync-backend',
    audience: 'paysync-client'
  });
}

/**
 * Generate refresh token
 * @param {Object} user - User object from database
 * @returns {string} JWT refresh token
 */
function generateRefreshToken(user) {
  const payload = {
    userId: user._id,
    email: user.email,
    type: 'refresh'
  };

  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    issuer: 'paysync-backend',
    audience: 'paysync-client'
  });

  // Store refresh token (in production, use Redis with TTL)
  refreshTokenStore.set(refreshToken, {
    userId: user._id.toString(),
    createdAt: new Date(),
    isActive: true
  });

  return refreshToken;
}

/**
 * Generate both access and refresh tokens
 * @param {Object} user - User object from database
 * @returns {Object} Object containing both tokens
 */
function generateTokenPair(user) {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m'
  };
}

/**
 * Verify and decode access token
 * @param {string} token - JWT access token
 * @returns {Object} Decoded token payload
 */
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'paysync-backend',
      audience: 'paysync-client'
    });
  } catch (error) {
    throw new Error(`Invalid access token: ${error.message}`);
  }
}

/**
 * Verify and decode refresh token
 * @param {string} token - JWT refresh token
 * @returns {Object} Decoded token payload
 */
function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
      issuer: 'paysync-backend',
      audience: 'paysync-client'
    });

    // Check if refresh token is stored and active
    const storedToken = refreshTokenStore.get(token);
    if (!storedToken || !storedToken.isActive) {
      throw new Error('Refresh token not found or inactive');
    }

    return decoded;
  } catch (error) {
    throw new Error(`Invalid refresh token: ${error.message}`);
  }
}

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - JWT refresh token
 * @param {Function} getUserById - Function to get user by ID
 * @returns {Object} New token pair
 */
async function refreshAccessToken(refreshToken, getUserById) {
  try {
    const decoded = verifyRefreshToken(refreshToken);

    // Get fresh user data
    const user = await getUserById(decoded.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate new access token with fresh user data
    const newAccessToken = generateAccessToken(user);

    return {
      accessToken: newAccessToken,
      refreshToken: refreshToken, // Keep the same refresh token
      tokenType: 'Bearer',
      expiresIn: process.env.JWT_EXPIRES_IN || '15m'
    };
  } catch (error) {
    throw new Error(`Token refresh failed: ${error.message}`);
  }
}

/**
 * Revoke refresh token
 * @param {string} refreshToken - JWT refresh token to revoke
 * @returns {boolean} Success status
 */
function revokeRefreshToken(refreshToken) {
  const storedToken = refreshTokenStore.get(refreshToken);
  if (storedToken) {
    storedToken.isActive = false;
    return true;
  }
  return false;
}

/**
 * Revoke all refresh tokens for a user
 * @param {string} userId - User ID
 * @returns {number} Number of tokens revoked
 */
function revokeAllUserTokens(userId) {
  let revokedCount = 0;

  for (const [token, data] of refreshTokenStore.entries()) {
    if (data.userId === userId.toString() && data.isActive) {
      data.isActive = false;
      revokedCount++;
    }
  }

  return revokedCount;
}

/**
 * Clean up expired refresh tokens
 * @returns {number} Number of tokens cleaned up
 */
function cleanupExpiredTokens() {
  let cleanedCount = 0;
  const now = new Date();
  const refreshTokenTTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

  for (const [token, data] of refreshTokenStore.entries()) {
    const tokenAge = now - data.createdAt;
    if (tokenAge > refreshTokenTTL) {
      refreshTokenStore.delete(token);
      cleanedCount++;
    }
  }

  return cleanedCount;
}

/**
 * Get token statistics
 * @returns {Object} Token statistics
 */
function getTokenStats() {
  const totalTokens = refreshTokenStore.size;
  let activeTokens = 0;
  let inactiveTokens = 0;

  for (const data of refreshTokenStore.values()) {
    if (data.isActive) {
      activeTokens++;
    } else {
      inactiveTokens++;
    }
  }

  return {
    totalTokens,
    activeTokens,
    inactiveTokens
  };
}

/**
 * Extract token from authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} Extracted token or null
 */
function extractTokenFromHeader(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.split(' ')[1];
}

/**
 * Validate token format
 * @param {string} token - Token to validate
 * @returns {boolean} True if token format is valid
 */
function isValidTokenFormat(token) {
  if (!token || typeof token !== 'string') {
    return false;
  }

  // JWT tokens have 3 parts separated by dots
  const parts = token.split('.');
  return parts.length === 3;
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  refreshAccessToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  cleanupExpiredTokens,
  getTokenStats,
  extractTokenFromHeader,
  isValidTokenFormat
};