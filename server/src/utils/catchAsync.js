/**
 * Async Error Handler Wrapper
 * 
 * This utility eliminates the need for try-catch blocks in async route handlers.
 * 
 * WHY THIS IS IMPORTANT:
 * - Without this, unhandled promise rejections can crash the server
 * - Reduces boilerplate code (no repetitive try-catch)
 * - Ensures all errors are passed to error handling middleware
 * 
 * BEFORE (without catchAsync):
 * ```
 * export const signup = async (req, res, next) => {
 *   try {
 *     const user = await User.create(req.body);
 *     res.json({ user });
 *   } catch (error) {
 *     next(error);
 *   }
 * };
 * ```
 * 
 * AFTER (with catchAsync):
 * ```
 * export const signup = catchAsync(async (req, res, next) => {
 *   const user = await User.create(req.body);
 *   res.json({ user });
 * });
 * ```
 */

/**
 * Wraps async functions to catch errors and pass them to Express error handler
 * 
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware function
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    // Execute the function and catch any errors
    // If the function throws or returns a rejected promise,
    // the error is automatically passed to next()
    fn(req, res, next).catch(next);
  };
};

export default catchAsync;

/**
 * USAGE EXAMPLES:
 * 
 * 1. Controller function:
 * ```
 * import catchAsync from '../utils/catchAsync.js';
 * 
 * export const getUser = catchAsync(async (req, res) => {
 *   const user = await User.findById(req.params.id);
 *   if (!user) throw notFound('User not found');
 *   res.json({ user });
 * });
 * ```
 * 
 * 2. With service layer:
 * ```
 * export const signup = catchAsync(async (req, res) => {
 *   const result = await authService.signup(req.body);
 *   res.status(201).json(result);
 * });
 * ```
 */
