/**
 * Auth Routes with Google OAuth
 * 
 * Add this route to your existing authRoutes.js
 */

// Add to your imports:
import * as googleAuthController from '../controllers/googleAuthController.js';

// Add this route with your other PUBLIC ROUTES:

/**
 * @route   POST /api/auth/google
 * @desc    Google OAuth login/signup
 * @access  Public
 * @body    { idToken }
 */
router.post('/google', googleAuthController.googleLogin);

// That's it! Just add this one route to your existing authRoutes.js
