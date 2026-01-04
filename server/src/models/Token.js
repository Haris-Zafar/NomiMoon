/**
 * Token Model
 * 
 * Handles tokens for:
 * 1. Email verification
 * 2. Password reset
 * 
 * KEY SECURITY PRINCIPLES:
 * - Tokens are single-use (deleted after use)
 * - Tokens expire after a set time
 * - Tokens are hashed in database (even if DB is compromised, tokens are useless)
 * - Random, cryptographically secure token generation
 * 
 * FLOW:
 * 1. Generate random token
 * 2. Hash it and store in DB
 * 3. Send unhashed token to user's email
 * 4. When user uses token, hash it and compare with DB
 * 5. Delete token after successful use
 */

import mongoose from 'mongoose';
import crypto from 'crypto';

const tokenSchema = new mongoose.Schema(
  {
    // Link to user
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true, // For faster lookups
    },

    // Hashed token (stored in DB)
    token: {
      type: String,
      required: true,
      index: true, // For faster lookups
    },

    // Token type
    type: {
      type: String,
      enum: ['email-verification', 'password-reset'],
      required: true,
    },

    // Expiration time
    expiresAt: {
      type: Date,
      required: true,
      index: true, // For cleanup queries
    },

    // Metadata
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 86400, // TTL index - MongoDB will auto-delete after 24 hours
      // This is a safety net; we also manually delete tokens
    },
  },
  {
    timestamps: false, // We only need createdAt, which we defined above
  }
);

/**
 * COMPOUND INDEXES
 * 
 * For queries that filter by multiple fields
 */
tokenSchema.index({ userId: 1, type: 1 });
tokenSchema.index({ token: 1, type: 1 });

/**
 * STATIC METHODS
 */

/**
 * Generate a new token for a user
 * 
 * @param {ObjectId} userId - User's ID
 * @param {string} type - Token type ('email-verification' or 'password-reset')
 * @param {number} expiresInMs - Expiry time in milliseconds
 * @returns {Promise<{token: string, hashedToken: string}>} - Unhashed token (send to user) and hashed token (store in DB)
 */
tokenSchema.statics.generateToken = async function (userId, type, expiresInMs) {
  // Delete any existing tokens of this type for this user
  // This ensures users can only have one valid token at a time
  await this.deleteMany({ userId, type });

  // Generate cryptographically secure random token (32 bytes = 64 hex characters)
  const randomToken = crypto.randomBytes(32).toString('hex');

  // Hash the token before storing (SHA256)
  // Why? If database is compromised, attacker can't use the tokens
  const hashedToken = crypto
    .createHash('sha256')
    .update(randomToken)
    .digest('hex');

  // Calculate expiry time
  const expiresAt = new Date(Date.now() + expiresInMs);

  // Store hashed token in database
  await this.create({
    userId,
    token: hashedToken,
    type,
    expiresAt,
  });

  // Return the UNHASHED token (this is what we send to user's email)
  // We never store the unhashed token!
  return {
    token: randomToken, // Send this to user
    hashedToken, // This is stored in DB
  };
};

/**
 * Verify and consume a token
 * 
 * This method:
 * 1. Hashes the provided token
 * 2. Finds matching token in DB
 * 3. Checks if it's expired
 * 4. Deletes the token (single-use)
 * 5. Returns the userId
 * 
 * @param {string} token - Unhashed token from user
 * @param {string} type - Token type to verify
 * @returns {Promise<ObjectId|null>} - User ID if valid, null otherwise
 */
tokenSchema.statics.verifyToken = async function (token, type) {
  // Hash the provided token
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  // Find the token in database
  const tokenDoc = await this.findOne({
    token: hashedToken,
    type,
  });

  // Token not found
  if (!tokenDoc) {
    return null;
  }

  // Check if token is expired
  if (tokenDoc.expiresAt < new Date()) {
    // Delete expired token
    await this.deleteOne({ _id: tokenDoc._id });
    return null;
  }

  // Token is valid! Get userId before deleting
  const userId = tokenDoc.userId;

  // Delete token (single-use)
  await this.deleteOne({ _id: tokenDoc._id });

  return userId;
};

/**
 * Delete all tokens for a user
 * Useful when user changes password (invalidate all reset tokens)
 * 
 * @param {ObjectId} userId - User's ID
 * @param {string} type - Optional: specific token type to delete
 * @returns {Promise<void>}
 */
tokenSchema.statics.deleteUserTokens = async function (userId, type = null) {
  const query = { userId };
  if (type) {
    query.type = type;
  }
  await this.deleteMany(query);
};

/**
 * Cleanup expired tokens (run this periodically with a cron job)
 * 
 * @returns {Promise<number>} - Number of tokens deleted
 */
tokenSchema.statics.cleanupExpired = async function () {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() },
  });
  return result.deletedCount;
};

/**
 * Check if user has a valid token of a specific type
 * Useful to prevent spam (e.g., limiting verification email resends)
 * 
 * @param {ObjectId} userId - User's ID
 * @param {string} type - Token type
 * @returns {Promise<boolean>} - True if user has a valid token
 */
tokenSchema.statics.hasValidToken = async function (userId, type) {
  const token = await this.findOne({
    userId,
    type,
    expiresAt: { $gt: new Date() },
  });
  return !!token;
};

/**
 * Create and export the Token model
 */
const Token = mongoose.model('Token', tokenSchema);

export default Token;

/**
 * USAGE EXAMPLES:
 * 
 * 1. Generate email verification token:
 * ```
 * const { token } = await Token.generateToken(
 *   user._id,
 *   'email-verification',
 *   24 * 60 * 60 * 1000 // 24 hours
 * );
 * // Send 'token' to user's email
 * ```
 * 
 * 2. Verify token:
 * ```
 * const userId = await Token.verifyToken(
 *   req.params.token,
 *   'email-verification'
 * );
 * if (userId) {
 *   // Token is valid, mark user as verified
 * }
 * ```
 * 
 * 3. Generate password reset token:
 * ```
 * const { token } = await Token.generateToken(
 *   user._id,
 *   'password-reset',
 *   60 * 60 * 1000 // 1 hour
 * );
 * ```
 * 
 * 4. Check if user already has a token:
 * ```
 * const hasToken = await Token.hasValidToken(userId, 'email-verification');
 * if (hasToken) {
 *   throw new Error('Verification email already sent. Please check your inbox.');
 * }
 * ```
 */
