/**
 * Google OAuth Service
 * 
 * Handles Google OAuth authentication.
 * 
 * SETUP REQUIRED:
 * 1. Go to Google Cloud Console: https://console.cloud.google.com
 * 2. Create a new project or select existing
 * 3. Enable Google+ API
 * 4. Create OAuth 2.0 credentials
 * 5. Add authorized redirect URIs:
 *    - http://localhost:5000/api/auth/google/callback (development)
 *    - https://your-domain.com/api/auth/google/callback (production)
 * 6. Add to .env:
 *    GOOGLE_CLIENT_ID=your_client_id
 *    GOOGLE_CLIENT_SECRET=your_client_secret
 */

import axios from 'axios';
import config from '../config/env.js';
import User from '../models/User.js';
import { generateTokens } from './jwtService.js';
import { badRequest } from '../utils/AppError.js';

/**
 * Verify Google ID token
 * 
 * @param {string} idToken - Google ID token from frontend
 * @returns {Promise<Object>} - User info from Google
 */
export const verifyGoogleToken = async (idToken) => {
  try {
    // Verify token with Google
    const response = await axios.get(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
    );

    const { data } = response;

    // Verify audience (client ID)
    if (data.aud !== config.google.clientId) {
      throw badRequest('Invalid Google token');
    }

    // Extract user info
    return {
      googleId: data.sub,
      email: data.email,
      emailVerified: data.email_verified === 'true',
      firstName: data.given_name,
      lastName: data.family_name,
      picture: data.picture,
    };
  } catch (error) {
    console.error('Google token verification failed:', error);
    throw badRequest('Invalid Google token');
  }
};

/**
 * Google OAuth Login/Signup
 * 
 * Handles both login and signup for Google OAuth.
 * If user exists, log them in. If not, create account.
 * 
 * @param {string} idToken - Google ID token
 * @returns {Promise<Object>} - Tokens and user data
 */
export const googleAuth = async (idToken) => {
  // Verify token and get user info
  const googleUser = await verifyGoogleToken(idToken);

  // Check if user exists
  let user = await User.findByEmail(googleUser.email);

  if (user) {
    // User exists - log them in
    // Make sure email is verified (Google emails are always verified)
    if (!user.isEmailVerified) {
      user.isEmailVerified = true;
      user.emailVerifiedAt = new Date();
      await user.save();
    }

    // Update last login
    await user.resetLoginAttempts();
  } else {
    // User doesn't exist - create account
    user = await User.create({
      email: googleUser.email,
      password: Math.random().toString(36).slice(-16), // Random password (won't be used)
      firstName: googleUser.firstName,
      lastName: googleUser.lastName,
      isEmailVerified: true, // Google emails are pre-verified
      emailVerifiedAt: new Date(),
      googleId: googleUser.googleId,
      avatar: googleUser.picture,
    });
  }

  // Generate JWT tokens
  const tokens = generateTokens(user._id.toString());

  return {
    status: 'success',
    message: 'Login successful',
    data: {
      ...tokens,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isEmailVerified: user.isEmailVerified,
        avatar: user.avatar,
      },
    },
  };
};

export default {
  verifyGoogleToken,
  googleAuth,
};
