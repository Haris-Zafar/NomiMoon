/**
 * Express Application Setup
 * FIXED: Stricter rate limiting for easier testing
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
app.use(helmet());

app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
  })
);

/**
 * RATE LIMITING - FIXED WITH STRICTER SETTINGS
 * For development: 10 requests per minute (easy to test)
 * For production: 100 requests per 15 minutes
 */
const limiter = rateLimit({
  windowMs: config.isDevelopment()
    ? 60 * 1000
    : config.security.rateLimitWindowMs,
  max: config.isDevelopment() ? 10 : config.security.rateLimitMaxRequests,
  message: {
    status: 'error',
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip successful requests (only count failed ones for auth routes)
  skipSuccessfulRequests: false,
  // Skip certain requests (like health checks in production)
  skip: (req) => {
    // Don't rate limit health checks in development
    return config.isDevelopment() && req.path === '/health';
  },
  handler: (req, res) => {
    console.log(`⚠️  Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      status: 'error',
      message: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    });
  },
});

// Apply rate limiting to all API routes
app.use('/api/', limiter);

/**
 * BODY PARSING MIDDLEWARE
 */
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

/**
 * ROUTES
 */

// Health check (no rate limit in dev, has rate limit in prod)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    environment: config.env,
    timestamp: new Date().toISOString(),
  });
});

// Auth routes (rate limited)
app.use('/api/auth', authRoutes);

/**
 * ERROR HANDLING
 */
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
