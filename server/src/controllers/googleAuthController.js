/**
 * Google OAuth Controller
 * 
 * Handles Google OAuth authentication endpoints.
 */

import * as googleAuthService from '../services/googleAuthService.js';
import catchAsync from '../utils/catchAsync.js';
import { badRequest } from '../utils/AppError.js';

/**
 * Google OAuth Login
 * 
 * POST /api/auth/google
 * Body: { idToken }
 * 
 * The frontend gets the idToken from Google Sign-In,
 * then sends it here for verification and authentication.
 */
export const googleLogin = catchAsync(async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    throw badRequest('Google ID token is required');
  }

  const result = await googleAuthService.googleAuth(idToken);

  res.status(200).json(result);
});

export default {
  googleLogin,
};
