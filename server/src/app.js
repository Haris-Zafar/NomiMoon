/**
 * Express Application Setup
 *
 * This file configures the Express app with all necessary middleware.
 * Keep this file clean - only middleware and route mounting here.
 * No business logic should be in this file.
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import config from './config/env.js';
import errorHandler, { notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';

const app = express();

/**
 * SECURITY MIDDLEWARE
 */

// Helmet sets various HTTP headers for security
// https://helmetjs.github.io/
app.use(helmet());

// CORS configuration
// In production, you should whitelist specific origins
app.use(
  cors({
    origin: config.clientUrl,
    credentials: true, // Allow cookies
  })
);

// Rate limiting to prevent brute force attacks
// This applies to ALL routes - you can create specific limiters for auth routes
const limiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs, // 15 minutes
  max: config.security.rateLimitMaxRequests, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
});

app.use('/api/', limiter);

/**
 * BODY PARSING MIDDLEWARE
 */

// Parse JSON bodies (as sent by API clients)
app.use(express.json({ limit: '10kb' })); // Limit body size for security

// Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

/**
 * ROUTES
 */

// Health check endpoint (useful for monitoring/load balancers)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    environment: config.env,
    timestamp: new Date().toISOString(),
  });
});

// API routes will be mounted here
// Example: app.use('/api/auth', authRoutes);
// We'll add these in the next chunk when we create the routes
app.use('/api/auth', authRoutes);

/**
 * ERROR HANDLING
 */

// Handle 404 errors for undefined routes
// This must come AFTER all other routes
app.use(notFoundHandler);

// Global error handler
// This must be the LAST middleware
app.use(errorHandler);

export default app;
