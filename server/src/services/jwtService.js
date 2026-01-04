/**
 * JWT Service
 * 
 * Handles JWT (JSON Web Token) operations for authentication.
 * 
 * JWT STRUCTURE:
 * Header.Payload.Signature
 * 
 * Example JWT:
 * eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMyIsImlhdCI6MTYxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
 * 
 * SECURITY PRINCIPLES:
 * 1. Never store sensitive data in JWT (it's just base64 encoded, not encrypted)
 * 2. Use strong secret keys (256+ bits)
 * 3. Set reasonable expiration times
 * 4. Verify signature on every request
 * 5. Use refresh tokens for long-lived sessions
 * 
 * JWT vs SESSION:
 * - JWT: Stateless, scales horizontally, works across domains
 * - Session: Stateful, requires storage, traditional
 * 
 * We're using JWT for its scalability and modern approach.
 */

import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import { unauthorized } from '../utils/AppError.js';

/**
 * Generate Access Token
 * 
 * Access tokens are short-lived (7 days default) and used for API authentication.
 * 
 * @param {string} userId - User's MongoDB _id
 * @returns {string} - Signed JWT token
 */
export const generateAccessToken = (userId) => {
  // Payload - data we want to store in the token
  const payload = {
    id: userId,
    type: 'access',
  };

  // Sign the token with secret key
  const token = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn, // e.g., '7d'
    issuer: 'your-app-name', // Optional: who issued the token
    audience: 'your-app-users', // Optional: who the token is for
  });

  return token;
};

/**
 * Generate Refresh Token
 * 
 * Refresh tokens are long-lived (30 days default) and used to get new access tokens.
 * 
 * REFRESH TOKEN PATTERN:
 * 1. User logs in → gets access + refresh token
 * 2. Access token expires → frontend uses refresh token to get new access token
 * 3. Refresh token expires → user must log in again
 * 
 * @param {string} userId - User's MongoDB _id
 * @returns {string} - Signed JWT refresh token
 */
export const generateRefreshToken = (userId) => {
  const payload = {
    id: userId,
    type: 'refresh',
  };

  const token = jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn, // e.g., '30d'
    issuer: 'your-app-name',
    audience: 'your-app-users',
  });

  return token;
};

/**
 * Generate both access and refresh tokens
 * 
 * @param {string} userId - User's MongoDB _id
 * @returns {Object} - { accessToken, refreshToken }
 */
export const generateTokens = (userId) => {
  return {
    accessToken: generateAccessToken(userId),
    refreshToken: generateRefreshToken(userId),
  };
};

/**
 * Verify Access Token
 * 
 * Validates token signature, expiration, and extracts payload.
 * 
 * @param {string} token - JWT token to verify
 * @returns {Object} - Decoded token payload
 * @throws {Error} - If token is invalid or expired
 */
export const verifyAccessToken = (token) => {
  try {
    // jwt.verify() automatically checks:
    // 1. Signature is valid (not tampered)
    // 2. Token hasn't expired
    // 3. Issuer and audience match (if specified)
    const decoded = jwt.verify(token, config.jwt.secret, {
      issuer: 'your-app-name',
      audience: 'your-app-users',
    });

    // Check token type
    if (decoded.type !== 'access') {
      throw unauthorized('Invalid token type');
    }

    return decoded;
  } catch (error) {
    // jwt.verify() throws specific errors
    if (error.name === 'TokenExpiredError') {
      throw unauthorized('Token has expired. Please log in again.');
    }
    if (error.name === 'JsonWebTokenError') {
      throw unauthorized('Invalid token. Please log in again.');
    }
    // Re-throw any other errors
    throw error;
  }
};

/**
 * Verify Refresh Token
 * 
 * @param {string} token - JWT refresh token to verify
 * @returns {Object} - Decoded token payload
 * @throws {Error} - If token is invalid or expired
 */
export const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, config.jwt.refreshSecret, {
      issuer: 'your-app-name',
      audience: 'your-app-users',
    });

    // Check token type
    if (decoded.type !== 'refresh') {
      throw unauthorized('Invalid token type');
    }

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw unauthorized('Refresh token has expired. Please log in again.');
    }
    if (error.name === 'JsonWebTokenError') {
      throw unauthorized('Invalid refresh token. Please log in again.');
    }
    throw error;
  }
};

/**
 * Decode token without verification
 * 
 * Useful for:
 * - Reading token payload without validating (e.g., getting expiration time)
 * - Debugging
 * 
 * ⚠️ WARNING: Never trust decoded data without verification!
 * 
 * @param {string} token - JWT token to decode
 * @returns {Object|null} - Decoded token payload or null if invalid
 */
export const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
};

/**
 * Extract token from Authorization header
 * 
 * Supports format: "Bearer <token>"
 * 
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} - Extracted token or null
 */
export const extractTokenFromHeader = (authHeader) => {
  if (!authHeader) {
    return null;
  }

  // Expected format: "Bearer eyJhbGci..."
  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
};

/**
 * Get token expiration time
 * 
 * @param {string} token - JWT token
 * @returns {Date|null} - Expiration date or null
 */
export const getTokenExpiration = (token) => {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) {
    return null;
  }
  // exp is in seconds, Date expects milliseconds
  return new Date(decoded.exp * 1000);
};

/**
 * Check if token is expired
 * 
 * @param {string} token - JWT token
 * @returns {boolean} - True if expired
 */
export const isTokenExpired = (token) => {
  const expiration = getTokenExpiration(token);
  if (!expiration) {
    return true;
  }
  return expiration < new Date();
};

export default {
  generateAccessToken,
  generateRefreshToken,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
  extractTokenFromHeader,
  getTokenExpiration,
  isTokenExpired,
};

/**
 * USAGE EXAMPLES:
 * 
 * 1. Generate tokens on login:
 * ```
 * const { accessToken, refreshToken } = generateTokens(user._id);
 * res.json({ accessToken, refreshToken });
 * ```
 * 
 * 2. Verify token in middleware:
 * ```
 * const token = extractTokenFromHeader(req.headers.authorization);
 * const decoded = verifyAccessToken(token);
 * req.user = { id: decoded.id };
 * ```
 * 
 * 3. Refresh access token:
 * ```
 * const decoded = verifyRefreshToken(refreshToken);
 * const newAccessToken = generateAccessToken(decoded.id);
 * ```
 * 
 * 4. Check token expiration:
 * ```
 * if (isTokenExpired(token)) {
 *   // Redirect to login or refresh token
 * }
 * ```
 */
