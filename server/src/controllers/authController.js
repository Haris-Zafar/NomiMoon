/**
 * Authentication Controller
 * 
 * Controllers are the bridge between HTTP (Express) and business logic (Services).
 * 
 * CONTROLLER RESPONSIBILITIES:
 * 1. Extract data from request (body, params, query, headers)
 * 2. Call appropriate service function
 * 3. Format response
 * 4. Set HTTP status codes
 * 5. Handle cookies (if using)
 * 
 * WHAT CONTROLLERS SHOULD NOT DO:
 * - Business logic (that's in services)
 * - Database queries (that's in services/models)
 * - Validation (that's in validators middleware)
 * 
 * THIN CONTROLLERS PATTERN:
 * Controllers should be thin - just extract data, call service, send response.
 */

import * as authService from '../services/authService.js';
import catchAsync from '../utils/catchAsync.js';

/**
 * Signup
 * 
 * POST /api/auth/signup
 * Body: { email, password, passwordConfirm, firstName?, lastName? }
 */
export const signup = catchAsync(async (req, res) => {
  // Extract data from request body
  const { email, password, firstName, lastName } = req.body;

  // Call service
  const result = await authService.signup({
    email,
    password,
    firstName,
    lastName,
  });

  // Send response
  res.status(201).json(result);
});

/**
 * Login
 * 
 * POST /api/auth/login
 * Body: { email, password }
 */
export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  const result = await authService.login({ email, password });

  // Optional: Set JWT in httpOnly cookie (more secure than localStorage)
  // res.cookie('accessToken', result.data.accessToken, {
  //   httpOnly: true,
  //   secure: config.isProduction(), // Only over HTTPS in production
  //   sameSite: 'strict',
  //   maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  // });

  res.status(200).json(result);
});

/**
 * Verify Email
 * 
 * GET /api/auth/verify-email/:token
 * Params: { token }
 */
export const verifyEmail = catchAsync(async (req, res) => {
  const { token } = req.params;

  const result = await authService.verifyEmail(token);

  res.status(200).json(result);
});

/**
 * Resend Verification Email
 * 
 * POST /api/auth/resend-verification
 * Body: { email }
 */
export const resendVerification = catchAsync(async (req, res) => {
  const { email } = req.body;

  const result = await authService.resendVerificationEmail(email);

  res.status(200).json(result);
});

/**
 * Forgot Password
 * 
 * POST /api/auth/forgot-password
 * Body: { email }
 */
export const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;

  const result = await authService.forgotPassword(email);

  res.status(200).json(result);
});

/**
 * Reset Password
 * 
 * POST /api/auth/reset-password/:token
 * Params: { token }
 * Body: { password, passwordConfirm }
 */
export const resetPassword = catchAsync(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  const result = await authService.resetPassword(token, password);

  res.status(200).json(result);
});

/**
 * Refresh Token
 * 
 * POST /api/auth/refresh-token
 * Body: { refreshToken }
 */
export const refreshToken = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;

  const result = await authService.refreshAccessToken(refreshToken);

  res.status(200).json(result);
});

/**
 * Logout
 * 
 * POST /api/auth/logout
 * 
 * With JWT, logout is client-side (delete token from localStorage/cookies).
 * This endpoint is optional and mainly for clearing cookies if you use them.
 */
export const logout = catchAsync(async (req, res) => {
  // Clear cookie if you're using cookies
  res.cookie('accessToken', '', {
    httpOnly: true,
    expires: new Date(0),
  });

  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully',
  });
});

/**
 * Get Current User
 * 
 * GET /api/auth/me
 * Requires authentication middleware
 */
export const getMe = catchAsync(async (req, res) => {
  // req.user is set by authenticate middleware
  const result = await authService.getCurrentUser(req.user.id);

  res.status(200).json(result);
});

/**
 * Update Password (for authenticated users)
 * 
 * PATCH /api/auth/update-password
 * Body: { currentPassword, newPassword, passwordConfirm }
 * Requires authentication middleware
 * 
 * This is different from reset password (which uses a token).
 * This requires the user to be logged in and know their current password.
 */
export const updatePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Get user with password
  const User = (await import('../models/User.js')).default;
  const user = await User.findById(req.user.id).select('+password');

  // Verify current password
  const isPasswordValid = await user.comparePassword(currentPassword);
  if (!isPasswordValid) {
    const { unauthorized } = await import('../utils/AppError.js');
    throw unauthorized('Current password is incorrect');
  }

  // Update password
  user.password = newPassword;
  await user.save();

  // Generate new tokens (invalidate old ones)
  const { generateTokens } = await import('../services/jwtService.js');
  const { accessToken, refreshToken } = generateTokens(user._id.toString());

  res.status(200).json({
    status: 'success',
    message: 'Password updated successfully',
    data: {
      accessToken,
      refreshToken,
    },
  });
});

/**
 * Update Profile
 * 
 * PATCH /api/auth/profile
 * Body: { firstName?, lastName? }
 * Requires authentication middleware
 */
export const updateProfile = catchAsync(async (req, res) => {
  const { firstName, lastName } = req.body;

  const User = (await import('../models/User.js')).default;
  const user = await User.findById(req.user.id);

  // Update fields
  if (firstName !== undefined) user.firstName = firstName;
  if (lastName !== undefined) user.lastName = lastName;

  await user.save();

  res.status(200).json({
    status: 'success',
    message: 'Profile updated successfully',
    data: {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
      },
    },
  });
});

/**
 * Delete Account (soft delete)
 * 
 * DELETE /api/auth/account
 * Requires authentication middleware
 */
export const deleteAccount = catchAsync(async (req, res) => {
  const User = (await import('../models/User.js')).default;
  
  // Soft delete (set isActive to false)
  await User.findByIdAndUpdate(req.user.id, { isActive: false });

  res.status(200).json({
    status: 'success',
    message: 'Account deleted successfully',
  });
});

export default {
  signup,
  login,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  refreshToken,
  logout,
  getMe,
  updatePassword,
  updateProfile,
  deleteAccount,
};

/**
 * HTTP STATUS CODES USED:
 * 
 * 200 OK - Successful GET, PATCH, DELETE
 * 201 Created - Successful POST that creates a resource (signup)
 * 400 Bad Request - Invalid input (handled by validators)
 * 401 Unauthorized - Authentication failed
 * 403 Forbidden - Authenticated but not authorized
 * 404 Not Found - Resource doesn't exist
 * 409 Conflict - Resource already exists (email in use)
 * 500 Internal Server Error - Unexpected server error
 * 
 * RESPONSE FORMAT:
 * All responses follow this structure:
 * {
 *   status: 'success' | 'fail' | 'error',
 *   message?: string,
 *   data?: { ... }
 * }
 */
