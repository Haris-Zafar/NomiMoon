/**
 * Global Error Handling Middleware
 * 
 * This is THE central error handler for the entire application.
 * All errors should eventually flow through this middleware.
 * 
 * KEY PRINCIPLES:
 * 1. Never expose internal error details to clients in production
 * 2. Log all errors for debugging
 * 3. Send appropriate HTTP status codes
 * 4. Differentiate between operational and programming errors
 */

import config from '../config/env.js';
import AppError from '../utils/AppError.js';

/**
 * Handle specific Mongoose errors and convert to AppError
 */
const handleMongooseError = (err) => {
  // Duplicate key error (e.g., email already exists)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return new AppError(`${field} already exists`, 409);
  }

  // Validation error (e.g., invalid email format)
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((el) => el.message);
    return new AppError(`Validation failed: ${errors.join('. ')}`, 400);
  }

  // Invalid ObjectId
  if (err.name === 'CastError') {
    return new AppError(`Invalid ${err.path}: ${err.value}`, 400);
  }

  return err;
};

/**
 * Handle JWT errors
 */
const handleJWTError = () => 
  new AppError('Invalid token. Please log in again.', 401);

const handleJWTExpiredError = () => 
  new AppError('Your token has expired. Please log in again.', 401);

/**
 * Send error response in development mode
 * Includes stack trace for debugging
 */
const sendErrorDev = (err, res) => {
  res.status(err.statusCode || 500).json({
    status: err.status || 'error',
    message: err.message,
    error: err,
    stack: err.stack,
  });
};

/**
 * Send error response in production mode
 * Hides internal error details from clients
 */
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } 
  // Programming or unknown error: don't leak error details
  else {
    // 1) Log error for internal debugging
    console.error('💥 ERROR:', err);

    // 2) Send generic message to client
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong. Please try again later.',
    });
  }
};

/**
 * Main error handling middleware
 * Must have 4 parameters for Express to recognize it as error middleware
 */
const errorHandler = (err, req, res, next) => {
  // Set defaults
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log error in development
  if (config.isDevelopment()) {
    console.error('❌ Error:', err);
  }

  // Handle specific error types
  let error = { ...err };
  error.message = err.message;
  error.name = err.name;

  // Mongoose errors
  if (err.name === 'ValidationError' || err.code === 11000 || err.name === 'CastError') {
    error = handleMongooseError(err);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  }
  if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  }

  // Send response based on environment
  if (config.isDevelopment()) {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

/**
 * Handle 404 errors for undefined routes
 * This should be the last route in your app
 */
export const notFoundHandler = (req, res, next) => {
  const error = new AppError(
    `Cannot find ${req.originalUrl} on this server`,
    404
  );
  next(error);
};

export default errorHandler;
