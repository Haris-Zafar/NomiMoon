/**
 * Validation Utilities
 * 
 * Input validation is CRITICAL for security.
 * Never trust user input!
 * 
 * WHY VALIDATE ON BACKEND?
 * - Frontend validation can be bypassed
 * - API can be called directly (Postman, curl, etc.)
 * - Security is a backend responsibility
 * 
 * VALIDATION STRATEGY:
 * 1. Validate on both client and server
 * 2. Sanitize inputs (trim, lowercase, etc.)
 * 3. Use allowlists (define what's allowed, not what's forbidden)
 * 4. Provide clear error messages
 * 
 * We use express-validator because:
 * - Built on validator.js (battle-tested)
 * - Middleware-based (fits Express pattern)
 * - Sanitization + validation in one
 * - Clear error messages
 */

import { body, param, validationResult } from 'express-validator';
import AppError from './AppError.js';

/**
 * Middleware to handle validation errors
 * 
 * This checks if validation middleware found any errors
 * and formats them into a consistent error response
 * 
 * @returns {Function} Express middleware
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Format errors into a readable message
    const formattedErrors = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
      value: err.value,
    }));

    // Create detailed error message
    const errorMessage = formattedErrors
      .map((err) => `${err.field}: ${err.message}`)
      .join(', ');

    return next(new AppError(errorMessage, 400));
  }

  next();
};

/**
 * VALIDATION CHAINS
 * 
 * These are reusable validation rules for common fields
 */

/**
 * Email validation
 */
export const validateEmail = () =>
  body('email')
    .trim() // Remove whitespace
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail() // Convert to lowercase, remove dots in Gmail, etc.
    .isLength({ max: 255 })
    .withMessage('Email cannot exceed 255 characters');

/**
 * Password validation
 * 
 * OWASP recommends:
 * - Minimum 8 characters
 * - Maximum 128 characters (to prevent DoS attacks via bcrypt)
 * - No other restrictions (let users choose strong passwords)
 */
export const validatePassword = (fieldName = 'password') =>
  body(fieldName)
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .isLength({ max: 128 })
    .withMessage('Password cannot exceed 128 characters')
    // Optional: Add strength requirements
    // .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    // .matches(/[a-z]/).withMessage('Password must contain a lowercase letter')
    // .matches(/[0-9]/).withMessage('Password must contain a number')
    // .matches(/[!@#$%^&*]/).withMessage('Password must contain a special character')
    ;

/**
 * Name validation (firstName, lastName)
 */
export const validateName = (fieldName) =>
  body(fieldName)
    .optional() // Name is optional
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage(`${fieldName} must be between 1 and 50 characters`)
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage(`${fieldName} can only contain letters, spaces, hyphens, and apostrophes`);

/**
 * Token validation (for URL parameters)
 */
export const validateToken = () =>
  param('token')
    .notEmpty()
    .withMessage('Token is required')
    .isLength({ min: 64, max: 64 })
    .withMessage('Invalid token format')
    .isHexadecimal()
    .withMessage('Invalid token format');

/**
 * VALIDATION RULE SETS
 * 
 * These combine multiple validation rules for specific endpoints
 */

/**
 * Signup validation
 */
export const signupValidation = [
  validateEmail(),
  validatePassword('password'),
  
  // Password confirmation
  body('passwordConfirm')
    .notEmpty()
    .withMessage('Please confirm your password')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),

  // Optional fields
  validateName('firstName'),
  validateName('lastName'),

  // Handle validation errors
  handleValidationErrors,
];

/**
 * Login validation
 */
export const loginValidation = [
  validateEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),

  handleValidationErrors,
];

/**
 * Forgot password validation
 */
export const forgotPasswordValidation = [
  validateEmail(),
  handleValidationErrors,
];

/**
 * Reset password validation
 */
export const resetPasswordValidation = [
  validateToken(),
  
  validatePassword('password'),
  
  body('passwordConfirm')
    .notEmpty()
    .withMessage('Please confirm your password')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),

  handleValidationErrors,
];

/**
 * Email verification validation
 */
export const verifyEmailValidation = [
  validateToken(),
  handleValidationErrors,
];

/**
 * Resend verification email validation
 */
export const resendVerificationValidation = [
  validateEmail(),
  handleValidationErrors,
];

/**
 * Change password validation (for authenticated users)
 */
export const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),

  validatePassword('newPassword'),

  body('passwordConfirm')
    .notEmpty()
    .withMessage('Please confirm your new password')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),

  handleValidationErrors,
];

/**
 * Update profile validation
 */
export const updateProfileValidation = [
  validateName('firstName'),
  validateName('lastName'),
  
  // Email update (if allowed)
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),

  handleValidationErrors,
];

/**
 * Custom validator example: Check if email already exists
 * 
 * This would be used in signup to prevent duplicate emails.
 * We'll implement this in the service layer instead to keep
 * validators focused on format validation, not business logic.
 */

export default {
  signupValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  verifyEmailValidation,
  resendVerificationValidation,
  changePasswordValidation,
  updateProfileValidation,
  handleValidationErrors,
};

/**
 * USAGE IN ROUTES:
 * 
 * ```javascript
 * import { signupValidation } from './utils/validators.js';
 * 
 * router.post('/signup', signupValidation, authController.signup);
 * //                     ^^^^^^^^^^^^^^^^
 * //                     Validates input before controller runs
 * ```
 * 
 * VALIDATION ERROR RESPONSE:
 * ```json
 * {
 *   "status": "fail",
 *   "message": "email: Please provide a valid email, password: Password must be at least 8 characters"
 * }
 * ```
 */
