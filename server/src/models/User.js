/**
 * User Model - Complete Explanation
 *
 * This model defines how user data is structured and secured.
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import config from '../config/env.js';

/**
 * ============================================
 * PART 1: SCHEMA DEFINITION
 * ============================================
 *
 * A schema is like a blueprint that defines:
 * - What fields exist
 * - What type each field is
 * - Validation rules
 * - Default values
 */

const userSchema = new mongoose.Schema(
  {
    // ==========================================
    // FIELD: email
    // ==========================================
    email: {
      // Type: What kind of data is stored
      type: String,

      // Required: Field must be provided
      // Can be boolean or array [boolean, errorMessage]
      required: [true, 'Email is required'],

      // Unique: No two users can have same email
      // This creates a database INDEX automatically
      unique: true,

      // Lowercase: Convert to lowercase before saving
      // "John@GMAIL.com" → "john@gmail.com"
      lowercase: true,

      // Trim: Remove whitespace from start/end
      // "  john@gmail.com  " → "john@gmail.com"
      trim: true,

      // Custom validation function
      validate: {
        validator: function (email) {
          // Simple regex to check email format
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        },
        message: 'Please provide a valid email address',
      },
    },

    // ==========================================
    // FIELD: password
    // ==========================================
    password: {
      type: String,

      // Conditional required: Only required if no googleId
      // This allows Google OAuth users to not have passwords
      required: function () {
        return !this.googleId;
      },

      // Minimum length validation
      minlength: [8, 'Password must be at least 8 characters'],

      // SELECT: false means password is NEVER returned in queries
      // This is CRITICAL for security!
      // Even if you query User.find(), password won't be included
      select: false,
    },

    // ==========================================
    // PROFILE FIELDS (Optional)
    // ==========================================
    firstName: {
      type: String,
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },

    lastName: {
      type: String,
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },

    // ==========================================
    // EMAIL VERIFICATION FIELDS
    // ==========================================
    isEmailVerified: {
      type: Boolean,
      default: false, // New users start unverified
    },

    emailVerifiedAt: {
      type: Date,
      default: null, // Null until verified
    },

    // ==========================================
    // SECURITY FIELDS
    // ==========================================
    isActive: {
      type: Boolean,
      default: true,
      select: false, // Hidden from queries
    },

    passwordChangedAt: {
      type: Date,
      select: false,
      // Used to invalidate old JWTs after password change
    },

    // ==========================================
    // LOGIN TRACKING (Prevent Brute Force)
    // ==========================================
    lastLoginAt: {
      type: Date,
    },

    loginAttempts: {
      type: Number,
      default: 0,
      select: false,
    },

    lockUntil: {
      type: Date,
      select: false,
      // If user fails 5 login attempts, lock for 2 hours
    },

    // ==========================================
    // GOOGLE OAUTH FIELDS
    // ==========================================
    googleId: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values
      select: false,
      // Sparse index: Only indexes non-null values
      // Without sparse, only ONE user could have googleId=null
    },

    avatar: {
      type: String, // URL to profile picture
    },
  },
  {
    // ==========================================
    // SCHEMA OPTIONS
    // ==========================================

    // Timestamps: Automatically adds createdAt and updatedAt
    timestamps: true,

    // Virtuals: Include virtual properties when converting to JSON/Object
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/**
 * ============================================
 * PART 2: INDEXES
 * ============================================
 *
 * Indexes make queries faster but slow down writes.
 *
 * How indexes work:
 * WITHOUT INDEX: MongoDB scans EVERY document (slow)
 * WITH INDEX: MongoDB uses a sorted tree structure (fast)
 *
 * Example: Finding user by email
 * No index: O(n) - checks all users
 * With index: O(log n) - uses binary search
 */

// Sort users by creation date (newest first)
userSchema.index({ createdAt: -1 }); // -1 = descending

/**
 * ============================================
 * PART 3: VIRTUAL PROPERTIES
 * ============================================
 *
 * Virtual properties are NOT stored in database.
 * They're computed on-the-fly when accessed.
 *
 * Why use virtuals?
 * - Save database space
 * - Keep data normalized (avoid duplication)
 * - Dynamic values that depend on other fields
 */

userSchema.virtual('fullName').get(function () {
  // 'this' refers to the document
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.firstName || this.lastName || '';
});

// Usage: user.fullName → "John Doe"
// Not stored in DB, computed when accessed

/**
 * ============================================
 * PART 4: MIDDLEWARE (HOOKS)
 * ============================================
 *
 * Middleware runs automatically at specific times:
 * - pre('save') → BEFORE saving to database
 * - post('save') → AFTER saving to database
 * - pre('find') → BEFORE querying
 * - etc.
 */

/**
 * PRE-SAVE MIDDLEWARE: Hash Password
 *
 * This runs BEFORE user.save()
 * Automatically hashes password so we never store plain text
 */
userSchema.pre('save', async function (next) {
  // Only hash if password was modified
  // Why? If user updates firstName, don't re-hash password!
  if (!this.isModified('password')) {
    return next(); // Skip hashing, continue saving
  }

  try {
    // Generate salt (random data added to password)
    // Salt rounds = 12 means hash 2^12 = 4096 times
    // Higher = more secure but slower
    const salt = await bcrypt.genSalt(config.security.bcryptRounds);

    // Hash password with salt
    // "password123" → "$2a$12$kFQVHx.../..." (60 chars)
    this.password = await bcrypt.hash(this.password, salt);

    // If updating password (not creating new user)
    if (!this.isNew) {
      // Set passwordChangedAt to invalidate old JWTs
      this.passwordChangedAt = Date.now() - 1000;
      // Subtract 1 second to ensure JWT is created AFTER this
    }

    next(); // Continue with save
  } catch (error) {
    next(error); // Pass error to error handler
  }
});

/**
 * ============================================
 * PART 5: INSTANCE METHODS
 * ============================================
 *
 * Instance methods are available on individual documents.
 *
 * Usage:
 *   const user = await User.findOne({ email: 'john@example.com' });
 *   const isValid = await user.comparePassword('password123');
 *                          ↑ Instance method
 */

/**
 * Compare provided password with hashed password
 *
 * @param {string} candidatePassword - Plain text password
 * @returns {Promise<boolean>} - True if match
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    // bcrypt.compare handles the salt automatically
    // Hashes candidatePassword with same salt and compares
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

/**
 * Check if password was changed after JWT was issued
 *
 * This invalidates old tokens after password change
 *
 * @param {number} JWTTimestamp - When JWT was issued (seconds)
 * @returns {boolean} - True if password changed after JWT
 */
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    // Convert passwordChangedAt to seconds (JWT uses seconds)
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );

    // If JWT was issued before password change, invalidate it
    return JWTTimestamp < changedTimestamp;
  }

  return false; // Password never changed
};

/**
 * Check if account is locked due to failed login attempts
 */
userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

/**
 * Increment login attempts and lock if needed
 */
userSchema.methods.incLoginAttempts = async function () {
  // If previous lock expired, reset attempts
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 },
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCK_TIME = 2 * 60 * 60 * 1000; // 2 hours

  // Lock account after 5 failed attempts
  if (this.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + LOCK_TIME };
  }

  return this.updateOne(updates);
};

/**
 * Reset login attempts after successful login
 */
userSchema.methods.resetLoginAttempts = async function () {
  return this.updateOne({
    $set: { loginAttempts: 0, lastLoginAt: Date.now() },
    $unset: { lockUntil: 1 },
  });
};

/**
 * ============================================
 * PART 6: STATIC METHODS
 * ============================================
 *
 * Static methods are available on the Model itself.
 *
 * Usage:
 *   const user = await User.findByEmail('john@example.com');
 *                     ↑ Static method on User Model
 */

/**
 * Find user by email (helper method)
 */
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() });
};

/**
 * Find user by email WITH password included
 * (password is excluded by default due to select: false)
 */
userSchema.statics.findByEmailWithPassword = function (email) {
  return this.findOne({ email: email.toLowerCase() }).select('+password');
};

/**
 * ============================================
 * PART 7: QUERY MIDDLEWARE
 * ============================================
 *
 * Query middleware runs before/after database queries.
 * Useful for filtering, logging, etc.
 */

/**
 * Exclude inactive users from all find queries (soft delete)
 *
 * This means User.find() automatically filters out deleted users
 */
userSchema.pre(/^find/, function (next) {
  // 'this' is the query object
  this.find({ isActive: { $ne: false } });
  next();
});

/**
 * ============================================
 * PART 8: CREATE MODEL
 * ============================================
 *
 * Convert schema to Model
 * Model = constructor for documents
 */
const User = mongoose.model('User', userSchema);

export default User;

/**
 * ============================================
 * USAGE EXAMPLES
 * ============================================
 *
 * 1. Create user:
 * ```
 * const user = await User.create({
 *   email: 'john@example.com',
 *   password: 'password123', // Will be auto-hashed!
 * });
 * ```
 *
 * 2. Find and verify password:
 * ```
 * const user = await User.findByEmailWithPassword('john@example.com');
 * const isValid = await user.comparePassword('password123');
 * ```
 *
 * 3. Update user:
 * ```
 * user.firstName = 'John';
 * await user.save(); // Triggers pre-save hook
 * ```
 */
