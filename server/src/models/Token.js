/**
 * Token Model - Complete Explanation
 *
 * This model handles temporary security tokens for:
 * 1. Email verification
 * 2. Password reset
 *
 * KEY SECURITY PRINCIPLES:
 * - Tokens are single-use (deleted after verification)
 * - Tokens expire (time-limited)
 * - Tokens are hashed in DB (even if DB is compromised, tokens are useless)
 * - Tokens are cryptographically random (can't be guessed)
 */

import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * ============================================
 * PART 1: SCHEMA DEFINITION
 * ============================================
 */

const tokenSchema = new mongoose.Schema(
  {
    // ==========================================
    // FIELD: userId
    // ==========================================
    // Links token to a specific user
    userId: {
      type: mongoose.Schema.Types.ObjectId, // Reference to User._id
      ref: 'User', // Reference to User model
      required: true,
      index: true, // Index for fast lookups
    },

    // ==========================================
    // FIELD: token (HASHED)
    // ==========================================
    // This is the HASHED token stored in database
    // The UNHASHED token is sent to user's email
    token: {
      type: String,
      required: true,
      index: true, // Fast lookups when verifying
    },

    // ==========================================
    // FIELD: type
    // ==========================================
    // What is this token for?
    type: {
      type: String,
      enum: ['email-verification', 'password-reset'],
      required: true,
      // Enum ensures only these two values are allowed
    },

    // ==========================================
    // FIELD: expiresAt
    // ==========================================
    // When does this token expire?
    expiresAt: {
      type: Date,
      required: true,
      index: true, // For cleanup queries
    },

    // ==========================================
    // FIELD: createdAt (with TTL)
    // ==========================================
    // Automatic deletion after 24 hours
    createdAt: {
      type: Date,
      default: Date.now,

      // TTL INDEX (Time To Live)
      // MongoDB automatically deletes document after this time
      expires: 86400, // 24 hours in seconds

      // This is a safety net - we also manually delete tokens
    },
  },
  {
    timestamps: false, // We only need createdAt (defined above)
  }
);

/**
 * ============================================
 * PART 2: COMPOUND INDEXES
 * ============================================
 *
 * Compound indexes optimize queries with multiple fields.
 *
 * Example query: "Find all email-verification tokens for user X"
 * Without compound index: MongoDB checks userId, then filters by type
 * With compound index: MongoDB uses optimized lookup for both fields
 */

// Find tokens by user and type
tokenSchema.index({ userId: 1, type: 1 });

// Find and verify tokens
tokenSchema.index({ token: 1, type: 1 });

/**
 * ============================================
 * PART 3: STATIC METHODS
 * ============================================
 *
 * Static methods are called on the Token Model itself
 */

/**
 * Generate a New Token
 *
 * This is the MOST IMPORTANT method!
 *
 * Flow:
 * 1. Delete any existing tokens (prevent spam)
 * 2. Generate random token (crypto-secure)
 * 3. Hash token before storing
 * 4. Return UNHASHED token (send to user's email)
 *
 * @param {ObjectId} userId - User's ID
 * @param {string} type - 'email-verification' or 'password-reset'
 * @param {number} expiresInMs - Expiry time in milliseconds
 * @returns {Promise<{token: string, hashedToken: string}>}
 */
tokenSchema.statics.generateToken = async function (userId, type, expiresInMs) {
  // ==========================================
  // STEP 1: Delete existing tokens
  // ==========================================
  // This ensures user can only have ONE valid token at a time
  // Prevents:
  // - Multiple verification emails confusing user
  // - Token spam/abuse
  await this.deleteMany({ userId, type });

  // ==========================================
  // STEP 2: Generate random token
  // ==========================================
  // crypto.randomBytes is cryptographically secure
  // 32 bytes = 256 bits of randomness
  // Converted to hex = 64 characters
  //
  // Example: "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456"
  const randomToken = crypto.randomBytes(32).toString('hex');

  // ==========================================
  // STEP 3: Hash the token
  // ==========================================
  // Why hash tokens in database?
  //
  // If database is compromised:
  // - Attacker sees: "$abc123def456..." (hashed)
  // - Attacker CAN'T use it (needs unhashed version)
  // - User's email remains secure
  //
  // We use SHA256 (fast, one-way hash)
  // bcrypt is overkill here (tokens are temporary and random)
  const hashedToken = crypto
    .createHash('sha256')
    .update(randomToken)
    .digest('hex');

  // ==========================================
  // STEP 4: Calculate expiry time
  // ==========================================
  const expiresAt = new Date(Date.now() + expiresInMs);

  // ==========================================
  // STEP 5: Store hashed token in database
  // ==========================================
  await this.create({
    userId,
    token: hashedToken, // Store hashed version
    type,
    expiresAt,
  });

  // ==========================================
  // STEP 6: Return unhashed token
  // ==========================================
  // We send THIS to user's email
  // We NEVER store the unhashed token!
  return {
    token: randomToken, // Send this to user
    hashedToken, // This is in database
  };
};

/**
 * Verify and Consume a Token
 *
 * This method:
 * 1. Hashes provided token
 * 2. Finds matching token in DB
 * 3. Checks if expired
 * 4. Deletes token (single-use)
 * 5. Returns userId if valid, null if invalid
 *
 * Flow:
 * User clicks: https://yourapp.com/verify-email/abc123def456...
 *                                                   ↑ unhashed token
 * Backend:
 * 1. Extract token from URL
 * 2. Hash it
 * 3. Compare with database
 * 4. If match and not expired → verify email
 * 5. Delete token (can't be reused)
 *
 * @param {string} token - Unhashed token from user
 * @param {string} type - Token type to verify
 * @returns {Promise<ObjectId|null>} - User ID if valid, null otherwise
 */
tokenSchema.statics.verifyToken = async function (token, type) {
  // ==========================================
  // STEP 1: Hash the provided token
  // ==========================================
  // User gives us: "abc123def456..."
  // We hash it to: "$xyz789ghi012..."
  // Then compare with database
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  // ==========================================
  // STEP 2: Find token in database
  // ==========================================
  const tokenDoc = await this.findOne({
    token: hashedToken,
    type,
  });

  // ==========================================
  // STEP 3: Token not found
  // ==========================================
  if (!tokenDoc) {
    return null; // Invalid token
  }

  // ==========================================
  // STEP 4: Check if expired
  // ==========================================
  if (tokenDoc.expiresAt < new Date()) {
    // Token expired! Delete it and return null
    await this.deleteOne({ _id: tokenDoc._id });
    return null;
  }

  // ==========================================
  // STEP 5: Token is valid! Get userId
  // ==========================================
  const userId = tokenDoc.userId;

  // ==========================================
  // STEP 6: Delete token (single-use)
  // ==========================================
  // This prevents token reuse
  // Once verified, token is gone forever
  await this.deleteOne({ _id: tokenDoc._id });

  return userId; // Return userId for further processing
};

/**
 * Delete All Tokens for a User
 *
 * Useful when:
 * - User changes password (invalidate reset tokens)
 * - User deletes account
 *
 * @param {ObjectId} userId - User's ID
 * @param {string} type - Optional: specific token type
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
 * Cleanup Expired Tokens
 *
 * Run this periodically with a cron job to remove expired tokens.
 * Although TTL index handles this automatically, manual cleanup
 * provides better control and immediate deletion.
 *
 * @returns {Promise<number>} - Number of tokens deleted
 */
tokenSchema.statics.cleanupExpired = async function () {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() }, // Less than current time
  });

  return result.deletedCount;
};

/**
 * Check if User Has Valid Token
 *
 * Prevents spam by checking if user already has a valid token.
 *
 * Use case:
 * "Resend verification email" button should be disabled if
 * user already has a valid token from recent request.
 *
 * @param {ObjectId} userId - User's ID
 * @param {string} type - Token type
 * @returns {Promise<boolean>} - True if user has valid token
 */
tokenSchema.statics.hasValidToken = async function (userId, type) {
  const token = await this.findOne({
    userId,
    type,
    expiresAt: { $gt: new Date() }, // Greater than current time (not expired)
  });

  return !!token; // Convert to boolean
};

/**
 * ============================================
 * PART 4: CREATE MODEL
 * ============================================
 */
const Token = mongoose.model('Token', tokenSchema);

export default Token;

/**
 * ============================================
 * USAGE EXAMPLES
 * ============================================
 *
 * 1. Generate email verification token:
 * ```javascript
 * const { token } = await Token.generateToken(
 *   user._id,
 *   'email-verification',
 *   24 * 60 * 60 * 1000 // 24 hours
 * );
 *
 * // Send 'token' to user's email
 * await sendEmail({
 *   to: user.email,
 *   subject: 'Verify Your Email',
 *   body: `Click: https://yourapp.com/verify/${token}`
 * });
 * ```
 *
 * 2. Verify token:
 * ```javascript
 * // User clicks link, you get token from URL
 * const userId = await Token.verifyToken(
 *   req.params.token,
 *   'email-verification'
 * );
 *
 * if (userId) {
 *   // Token valid! Mark user as verified
 *   await User.findByIdAndUpdate(userId, {
 *     isEmailVerified: true
 *   });
 * } else {
 *   // Token invalid or expired
 *   throw new Error('Invalid verification link');
 * }
 * ```
 *
 * 3. Generate password reset token:
 * ```javascript
 * const { token } = await Token.generateToken(
 *   user._id,
 *   'password-reset',
 *   60 * 60 * 1000 // 1 hour
 * );
 * ```
 *
 * 4. Prevent spam:
 * ```javascript
 * const hasToken = await Token.hasValidToken(
 *   userId,
 *   'email-verification'
 * );
 *
 * if (hasToken) {
 *   throw new Error('Verification email already sent. Please check your inbox.');
 * }
 * ```
 */
