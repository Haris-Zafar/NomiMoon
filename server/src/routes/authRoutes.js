/**
 * Authentication Routes
 *
 * Defines all authentication-related API endpoints.
 *
 * ROUTE STRUCTURE:
 * Method + Path + Middleware + Controller
 *
 * MIDDLEWARE ORDER MATTERS:
 * 1. Validation middleware (validates input)
 * 2. Authentication middleware (verifies JWT)
 * 3. Authorization middleware (checks permissions)
 * 4. Controller (handles request)
 *
 * REST API CONVENTIONS:
 * POST   - Create resource (signup, login)
 * GET    - Read resource (get user)
 * PATCH  - Update resource partially (update profile)
 * PUT    - Update resource completely
 * DELETE - Delete resource (delete account)
 */

import express from 'express';
import * as authController from '../controllers/authController.js';
import * as authMiddleware from '../middleware/authMiddleware.js';
import * as googleAuthController from '../controllers/googleAuthController.js';
import {
  signupValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  verifyEmailValidation,
  resendVerificationValidation,
  changePasswordValidation,
  updateProfileValidation,
} from '../utils/validators.js';

const router = express.Router();

/**
 * PUBLIC ROUTES (no authentication required)
 */

/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user
 * @access  Public
 * @body    { email, password, passwordConfirm, firstName?, lastName? }
 */
router.post('/signup', signupValidation, authController.signup);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 * @body    { email, password }
 */
router.post('/login', loginValidation, authController.login);

/**
 * @route   GET /api/auth/verify-email/:token
 * @desc    Verify email address
 * @access  Public
 * @params  token - Verification token from email
 */
router.get(
  '/verify-email/:token',
  verifyEmailValidation,
  authController.verifyEmail
);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend email verification link
 * @access  Public
 * @body    { email }
 */
router.post(
  '/resend-verification',
  resendVerificationValidation,
  authController.resendVerification
);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 * @body    { email }
 */
router.post(
  '/forgot-password',
  forgotPasswordValidation,
  authController.forgotPassword
);

/**
 * @route   POST /api/auth/reset-password/:token
 * @desc    Reset password using token
 * @access  Public
 * @params  token - Reset token from email
 * @body    { password, passwordConfirm }
 */
router.post(
  '/reset-password/:token',
  resetPasswordValidation,
  authController.resetPassword
);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Get new access token using refresh token
 * @access  Public
 * @body    { refreshToken }
 */
router.post('/refresh-token', authController.refreshToken);

/**
 * PROTECTED ROUTES (authentication required)
 * All routes below this middleware require a valid JWT
 */
router.use(authMiddleware.authenticate);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private (requires authentication)
 */
router.get('/me', authController.getMe);

/**
 * @route   PATCH /api/auth/update-password
 * @desc    Update password (requires current password)
 * @access  Private
 * @body    { currentPassword, newPassword, passwordConfirm }
 */
router.patch(
  '/update-password',
  changePasswordValidation,
  authController.updatePassword
);

/**
 * @route   PATCH /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 * @body    { firstName?, lastName? }
 */
router.patch('/profile', updateProfileValidation, authController.updateProfile);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (clear cookies)
 * @access  Private
 */
router.post('/logout', authController.logout);

/**
 * @route   DELETE /api/auth/account
 * @desc    Delete user account (soft delete)
 * @access  Private
 */
router.delete('/account', authController.deleteAccount);

/**
 * @route   POST /api/auth/google
 * @desc    Google OAuth login/signup
 * @access  Public
 * @body    { idToken }
 */
router.post('/google', googleAuthController.googleLogin);

export default router;

/**
 * ROUTE DOCUMENTATION EXAMPLE:
 *
 * POST /api/auth/signup
 * =====================
 *
 * Request:
 * ```json
 * {
 *   "email": "user@example.com",
 *   "password": "password123",
 *   "passwordConfirm": "password123",
 *   "firstName": "John",
 *   "lastName": "Doe"
 * }
 * ```
 *
 * Success Response (201):
 * ```json
 * {
 *   "status": "success",
 *   "message": "Signup successful! Please check your email to verify your account.",
 *   "data": {
 *     "user": {
 *       "id": "507f1f77bcf86cd799439011",
 *       "email": "user@example.com",
 *       "firstName": "John",
 *       "lastName": "Doe"
 *     }
 *   }
 * }
 * ```
 *
 * Error Response (409):
 * ```json
 * {
 *   "status": "fail",
 *   "message": "Email already in use. Please login or use a different email."
 * }
 * ```
 *
 * POST /api/auth/login
 * ====================
 *
 * Request:
 * ```json
 * {
 *   "email": "user@example.com",
 *   "password": "password123"
 * }
 * ```
 *
 * Success Response (200):
 * ```json
 * {
 *   "status": "success",
 *   "message": "Login successful",
 *   "data": {
 *     "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *     "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *     "user": {
 *       "id": "507f1f77bcf86cd799439011",
 *       "email": "user@example.com",
 *       "firstName": "John",
 *       "lastName": "Doe",
 *       "isEmailVerified": true
 *     }
 *   }
 * }
 * ```
 *
 * GET /api/auth/me
 * ================
 *
 * Headers:
 * ```
 * Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 * ```
 *
 * Success Response (200):
 * ```json
 * {
 *   "status": "success",
 *   "data": {
 *     "user": {
 *       "id": "507f1f77bcf86cd799439011",
 *       "email": "user@example.com",
 *       "firstName": "John",
 *       "lastName": "Doe",
 *       "fullName": "John Doe",
 *       "isEmailVerified": true,
 *       "createdAt": "2024-01-15T10:30:00.000Z",
 *       "updatedAt": "2024-01-15T10:30:00.000Z"
 *     }
 *   }
 * }
 * ```
 */
