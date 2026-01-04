/**
 * Authentication Middleware
 * 
 * Middleware to protect routes and verify JWT tokens.
 * 
 * MIDDLEWARE CONCEPT:
 * Middleware functions have access to req, res, and next.
 * They can:
 * - Execute code
 * - Modify req/res objects
 * - End request-response cycle
 * - Call next() to pass control to next middleware
 * 
 * AUTH MIDDLEWARE FLOW:
 * Request → authenticate → (if valid) → next() → protected route
 *                       ↓ (if invalid)
 *                     Error response
 */

import User from '../models/User.js';
import { verifyAccessToken, extractTokenFromHeader } from '../services/jwtService.js';
import { unauthorized } from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';

/**
 * Authenticate User
 * 
 * Verifies JWT token and attaches user to request object.
 * 
 * Flow:
 * 1. Extract token from Authorization header
 * 2. Verify token
 * 3. Check if user still exists
 * 4. Check if user changed password after token was issued
 * 5. Attach user to request object
 * 6. Call next()
 * 
 * Usage:
 * ```
 * router.get('/protected', authenticate, controller.protectedRoute);
 * ```
 */
export const authenticate = catchAsync(async (req, res, next) => {
  // 1. Extract token from Authorization header
  const token = extractTokenFromHeader(req.headers.authorization);

  if (!token) {
    throw unauthorized(
      'You are not logged in. Please log in to access this resource.'
    );
  }

  // 2. Verify token (throws error if invalid)
  const decoded = verifyAccessToken(token);

  // 3. Check if user still exists
  // User might have been deleted after token was issued
  const user = await User.findById(decoded.id).select('+passwordChangedAt');

  if (!user) {
    throw unauthorized(
      'The user belonging to this token no longer exists. Please log in again.'
    );
  }

  // 4. Check if user changed password after token was issued
  // If they did, the token should be invalid
  if (user.changedPasswordAfter(decoded.iat)) {
    throw unauthorized(
      'You recently changed your password. Please log in again.'
    );
  }

  // 5. Check if email is verified
  if (!user.isEmailVerified) {
    throw unauthorized(
      'Please verify your email before accessing this resource.'
    );
  }

  // 6. Attach user to request object (available in next middleware/controller)
  req.user = {
    id: user._id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    isEmailVerified: user.isEmailVerified,
  };

  // 7. Grant access to protected route
  next();
});

/**
 * Optional Authentication
 * 
 * Attaches user to request if token is valid, but doesn't fail if invalid.
 * Useful for routes that have different behavior for authenticated/unauthenticated users.
 * 
 * Usage:
 * ```
 * router.get('/post', optionalAuth, controller.getPost);
 * // If authenticated: req.user exists
 * // If not: req.user is undefined, but request continues
 * ```
 */
export const optionalAuth = catchAsync(async (req, res, next) => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      return next(); // No token, but that's okay
    }

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.id);

    if (user && !user.changedPasswordAfter(decoded.iat)) {
      req.user = {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isEmailVerified: user.isEmailVerified,
      };
    }
  } catch (error) {
    // Silently fail - invalid token just means unauthenticated
  }

  next();
});

/**
 * Require Email Verification
 * 
 * Must be used AFTER authenticate middleware.
 * Ensures user has verified their email.
 * 
 * Usage:
 * ```
 * router.post('/post', authenticate, requireEmailVerification, controller.createPost);
 * ```
 */
export const requireEmailVerification = catchAsync(async (req, res, next) => {
  if (!req.user) {
    throw unauthorized('Authentication required');
  }

  if (!req.user.isEmailVerified) {
    throw unauthorized(
      'Please verify your email before accessing this resource. Check your inbox for the verification link.'
    );
  }

  next();
});

/**
 * Restrict To Roles
 * 
 * Restricts access to specific user roles.
 * 
 * NOTE: We haven't implemented roles yet, but this shows the pattern.
 * You'd need to add a 'role' field to User model.
 * 
 * Usage:
 * ```
 * router.delete('/user/:id', authenticate, restrictTo('admin'), controller.deleteUser);
 * ```
 * 
 * @param  {...string} roles - Allowed roles
 * @returns {Function} - Middleware function
 */
export const restrictTo = (...roles) => {
  return catchAsync(async (req, res, next) => {
    // req.user.role would be set by authenticate middleware
    if (!roles.includes(req.user.role)) {
      throw unauthorized(
        'You do not have permission to perform this action.'
      );
    }
    next();
  });
};

/**
 * Rate Limit By User
 * 
 * More sophisticated rate limiting per user (not just IP).
 * Requires Redis or similar for production.
 * 
 * This is a placeholder showing the pattern.
 */
export const rateLimitByUser = catchAsync(async (req, res, next) => {
  // In production, check Redis for user's request count
  // For now, just pass through
  next();
});

export default {
  authenticate,
  optionalAuth,
  requireEmailVerification,
  restrictTo,
  rateLimitByUser,
};

/**
 * MIDDLEWARE USAGE PATTERNS:
 * 
 * 1. Simple protected route:
 * ```
 * router.get('/profile', authenticate, getProfile);
 * ```
 * 
 * 2. Multiple middleware:
 * ```
 * router.post(
 *   '/admin/users',
 *   authenticate,
 *   requireEmailVerification,
 *   restrictTo('admin'),
 *   createUser
 * );
 * ```
 * 
 * 3. Optional auth:
 * ```
 * router.get('/posts', optionalAuth, getPosts);
 * // In controller:
 * if (req.user) {
 *   // Show personalized posts
 * } else {
 *   // Show public posts
 * }
 * ```
 * 
 * 4. Chain multiple middleware:
 * ```
 * router.use(authenticate); // Apply to all routes below
 * router.get('/me', getMe);
 * router.put('/me', updateMe);
 * router.delete('/me', deleteMe);
 * ```
 */
