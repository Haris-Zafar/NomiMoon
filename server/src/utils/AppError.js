/**
 * Custom Application Error Class
 * 
 * Extends the native Error class to include:
 * - HTTP status codes
 * - Operational vs programming error distinction
 * - Better error serialization
 * 
 * This pattern is crucial for:
 * - Consistent error responses across the API
 * - Proper error logging and monitoring
 * - Security (prevents leaking stack traces to clients)
 */

class AppError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {number} statusCode - HTTP status code (400, 404, 500, etc.)
   */
  constructor(message, statusCode) {
    super(message);

    this.statusCode = statusCode;
    // HTTP status codes in 4xx range are client errors (operational)
    // 5xx range are server errors (programming errors)
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    
    // Operational errors are expected errors (like validation failures)
    // Programming errors are bugs that need to be fixed
    this.isOperational = true;

    // Captures stack trace for debugging (but we won't send this to clients)
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON for API responses
   * Useful for consistent error formatting
   */
  toJSON() {
    return {
      status: this.status,
      message: this.message,
      ...(process.env.NODE_ENV === 'development' && { stack: this.stack }),
    };
  }
}

/**
 * Common error factory functions
 * These make it easier to throw consistent errors throughout the app
 */

export const badRequest = (message = 'Bad Request') => 
  new AppError(message, 400);

export const unauthorized = (message = 'Unauthorized') => 
  new AppError(message, 401);

export const forbidden = (message = 'Forbidden') => 
  new AppError(message, 403);

export const notFound = (message = 'Resource not found') => 
  new AppError(message, 404);

export const conflict = (message = 'Resource already exists') => 
  new AppError(message, 409);

export const tooManyRequests = (message = 'Too many requests') => 
  new AppError(message, 429);

export const serverError = (message = 'Internal server error') => 
  new AppError(message, 500);

export default AppError;
