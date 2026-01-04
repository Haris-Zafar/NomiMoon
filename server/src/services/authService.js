/**
 * Authentication Service
 * 
 * This is the HEART of our authentication system.
 * All authentication business logic lives here.
 * 
 * ARCHITECTURE PRINCIPLE: Service Layer
 * - Controllers handle HTTP (req/res)
 * - Services handle business logic
 * - Models handle data
 * 
 * BENEFITS:
 * - Business logic is reusable (can call from API, CLI, tests)
 * - Easy to test (no HTTP mocking needed)
 * - Single responsibility principle
 * - Clear separation of concerns
 */

import User from '../models/User.js';
import Token from '../models/Token.js';
import { generateTokens } from './jwtService.js';
import { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } from './emailService.js';
import { badRequest, unauthorized, conflict, notFound } from '../utils/AppError.js';
import config from '../config/env.js';

/**
 * User Signup
 * 
 * Flow:
 * 1. Check if email already exists
 * 2. Create user (password auto-hashed by model)
 * 3. Generate email verification token
 * 4. Send verification email
 * 5. Return success message (don't auto-login until verified)
 * 
 * @param {Object} userData - { email, password, firstName, lastName }
 * @returns {Promise<Object>} - Success message
 */
export const signup = async (userData) => {
  const { email, password, firstName, lastName } = userData;

  // 1. Check if user already exists
  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    throw conflict('Email already in use. Please login or use a different email.');
  }

  // 2. Create user
  const user = await User.create({
    email,
    password, // Will be hashed by pre-save hook
    firstName,
    lastName,
  });

  // 3. Generate verification token (24 hours)
  const { token } = await Token.generateToken(
    user._id,
    'email-verification',
    24 * 60 * 60 * 1000 // 24 hours
  );

  // 4. Send verification email
  try {
    await sendVerificationEmail(user, token);
  } catch (error) {
    console.error('Failed to send verification email:', error);
    // Don't fail the signup if email fails
    // User can request resend later
  }

  // 5. Return success (no JWT yet - must verify email first)
  return {
    status: 'success',
    message: 'Signup successful! Please check your email to verify your account.',
    data: {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    },
  };
};

/**
 * User Login
 * 
 * Flow:
 * 1. Find user with password
 * 2. Check if user exists
 * 3. Check if email is verified
 * 4. Check if account is locked
 * 5. Verify password
 * 6. Reset login attempts
 * 7. Generate JWT tokens
 * 8. Return tokens and user data
 * 
 * @param {Object} credentials - { email, password }
 * @returns {Promise<Object>} - { accessToken, refreshToken, user }
 */
export const login = async (credentials) => {
  const { email, password } = credentials;

  // 1. Find user with password (password is excluded by default)
  const user = await User.findByEmailWithPassword(email);

  // 2. Check if user exists
  // Use generic message to avoid revealing if email exists
  if (!user) {
    throw unauthorized('Invalid email or password');
  }

  // 3. Check if email is verified
  if (!user.isEmailVerified) {
    throw unauthorized(
      'Please verify your email before logging in. Check your inbox for the verification link.'
    );
  }

  // 4. Check if account is locked
  if (user.isLocked()) {
    throw unauthorized(
      'Your account has been locked due to too many failed login attempts. Please try again later or reset your password.'
    );
  }

  // 5. Verify password
  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    // Increment login attempts on failed login
    await user.incLoginAttempts();
    throw unauthorized('Invalid email or password');
  }

  // 6. Reset login attempts on successful login
  await user.resetLoginAttempts();

  // 7. Generate JWT tokens
  const { accessToken, refreshToken } = generateTokens(user._id.toString());

  // 8. Return tokens and user data (exclude sensitive fields)
  return {
    status: 'success',
    message: 'Login successful',
    data: {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isEmailVerified: user.isEmailVerified,
      },
    },
  };
};

/**
 * Verify Email
 * 
 * Flow:
 * 1. Verify token and get userId
 * 2. Find user
 * 3. Check if already verified
 * 4. Mark as verified
 * 5. Send welcome email
 * 6. Generate JWT tokens (auto-login after verification)
 * 
 * @param {string} token - Verification token from email
 * @returns {Promise<Object>} - { accessToken, refreshToken, user }
 */
export const verifyEmail = async (token) => {
  // 1. Verify token (automatically deletes token if valid)
  const userId = await Token.verifyToken(token, 'email-verification');

  if (!userId) {
    throw badRequest(
      'Invalid or expired verification link. Please request a new verification email.'
    );
  }

  // 2. Find user
  const user = await User.findById(userId);
  if (!user) {
    throw notFound('User not found');
  }

  // 3. Check if already verified
  if (user.isEmailVerified) {
    throw badRequest('Email is already verified. You can log in now.');
  }

  // 4. Mark email as verified
  user.isEmailVerified = true;
  user.emailVerifiedAt = new Date();
  await user.save();

  // 5. Send welcome email
  try {
    await sendWelcomeEmail(user);
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    // Don't fail verification if welcome email fails
  }

  // 6. Generate JWT tokens (auto-login after verification)
  const { accessToken, refreshToken } = generateTokens(user._id.toString());

  return {
    status: 'success',
    message: 'Email verified successfully! Welcome aboard!',
    data: {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isEmailVerified: user.isEmailVerified,
      },
    },
  };
};

/**
 * Resend Verification Email
 * 
 * Flow:
 * 1. Find user
 * 2. Check if already verified
 * 3. Check if token already sent recently (prevent spam)
 * 4. Generate new token
 * 5. Send email
 * 
 * @param {string} email - User's email
 * @returns {Promise<Object>} - Success message
 */
export const resendVerificationEmail = async (email) => {
  // 1. Find user
  const user = await User.findByEmail(email);

  if (!user) {
    // Don't reveal if email exists (security)
    return {
      status: 'success',
      message: 'If your email is registered, you will receive a verification link.',
    };
  }

  // 2. Check if already verified
  if (user.isEmailVerified) {
    throw badRequest('Email is already verified. You can log in now.');
  }

  // 3. Check if token already sent recently (prevent spam)
  const hasValidToken = await Token.hasValidToken(user._id, 'email-verification');
  if (hasValidToken) {
    throw badRequest(
      'A verification email was recently sent. Please check your inbox or spam folder. Wait a few minutes before requesting another.'
    );
  }

  // 4. Generate new token
  const { token } = await Token.generateToken(
    user._id,
    'email-verification',
    24 * 60 * 60 * 1000
  );

  // 5. Send email
  await sendVerificationEmail(user, token);

  return {
    status: 'success',
    message: 'Verification email sent. Please check your inbox.',
  };
};

/**
 * Forgot Password (Request Reset)
 * 
 * Flow:
 * 1. Find user
 * 2. Check if token already sent recently
 * 3. Generate reset token
 * 4. Send reset email
 * 
 * SECURITY NOTE: Always return same message regardless of whether email exists
 * 
 * @param {string} email - User's email
 * @returns {Promise<Object>} - Success message
 */
export const forgotPassword = async (email) => {
  // 1. Find user
  const user = await User.findByEmail(email);

  // If user doesn't exist, return generic success message (security)
  if (!user) {
    return {
      status: 'success',
      message: 'If your email is registered, you will receive a password reset link.',
    };
  }

  // 2. Check if token already sent recently (prevent spam)
  const hasValidToken = await Token.hasValidToken(user._id, 'password-reset');
  if (hasValidToken) {
    throw badRequest(
      'A password reset email was recently sent. Please check your inbox or spam folder. Wait a few minutes before requesting another.'
    );
  }

  // 3. Generate reset token (1 hour)
  const { token } = await Token.generateToken(
    user._id,
    'password-reset',
    60 * 60 * 1000 // 1 hour
  );

  // 4. Send reset email
  try {
    await sendPasswordResetEmail(user, token);
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw badRequest('Failed to send password reset email. Please try again later.');
  }

  return {
    status: 'success',
    message: 'If your email is registered, you will receive a password reset link.',
  };
};

/**
 * Reset Password
 * 
 * Flow:
 * 1. Verify token
 * 2. Find user
 * 3. Update password (will be hashed by model)
 * 4. Delete all tokens for user (invalidate other reset tokens)
 * 5. Return success
 * 
 * @param {string} token - Reset token from email
 * @param {string} newPassword - New password
 * @returns {Promise<Object>} - Success message
 */
export const resetPassword = async (token, newPassword) => {
  // 1. Verify token
  const userId = await Token.verifyToken(token, 'password-reset');

  if (!userId) {
    throw badRequest(
      'Invalid or expired password reset link. Please request a new one.'
    );
  }

  // 2. Find user
  const user = await User.findById(userId);
  if (!user) {
    throw notFound('User not found');
  }

  // 3. Update password (will be hashed by pre-save hook)
  user.password = newPassword;
  await user.save();

  // 4. Delete all tokens for this user (invalidate any other reset tokens)
  await Token.deleteUserTokens(userId);

  return {
    status: 'success',
    message: 'Password reset successful! You can now log in with your new password.',
  };
};

/**
 * Refresh Access Token
 * 
 * Flow:
 * 1. Verify refresh token
 * 2. Check if user still exists
 * 3. Generate new access token
 * 4. Return new access token
 * 
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} - { accessToken }
 */
export const refreshAccessToken = async (refreshToken) => {
  // 1. Verify refresh token
  const { verifyRefreshToken } = await import('./jwtService.js');
  const decoded = verifyRefreshToken(refreshToken);

  // 2. Check if user still exists and is active
  const user = await User.findById(decoded.id);
  if (!user) {
    throw unauthorized('User no longer exists. Please log in again.');
  }

  if (!user.isEmailVerified) {
    throw unauthorized('Email not verified. Please verify your email.');
  }

  // 3. Generate new access token
  const { generateAccessToken } = await import('./jwtService.js');
  const accessToken = generateAccessToken(user._id.toString());

  return {
    status: 'success',
    data: {
      accessToken,
    },
  };
};

/**
 * Get Current User (for /me endpoint)
 * 
 * @param {string} userId - User ID from JWT
 * @returns {Promise<Object>} - User data
 */
export const getCurrentUser = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw notFound('User not found');
  }

  return {
    status: 'success',
    data: {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName, // Virtual property
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    },
  };
};

export default {
  signup,
  login,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
  refreshAccessToken,
  getCurrentUser,
};
