/**
 * User Model
 *
 * This is the core of our authentication system.
 *
 * KEY CONCEPTS:
 * 1. Password Hashing - Never store plain passwords
 * 2. Mongoose Middleware - Auto-hash passwords before saving
 * 3. Instance Methods - Methods available on user documents
 * 4. Indexes - For query performance
 * 5. Virtuals - Computed properties
 *
 * SECURITY PRINCIPLES:
 * - Passwords are hashed with bcrypt (one-way encryption)
 * - Passwords are never returned in queries (select: false)
 * - Email verification required before login
 * - Timestamps for auditing
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import config from '../config/env.js';

const userSchema = new mongoose.Schema(
  {
    // Basic Information
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true, // Convert to lowercase
      trim: true, // Remove whitespace
      validate: {
        validator: function (email) {
          // Simple email regex validation
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        },
        message: 'Please provide a valid email address',
      },
      index: true, // Create index for faster queries
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Never return password in queries by default
    },

    // Optional: User profile fields
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

    // Email Verification
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerifiedAt: {
      type: Date,
      default: null,
    },

    // Security & Account Status
    isActive: {
      type: Boolean,
      default: true,
      select: false, // Don't return in queries by default
    },

    // Password Management
    passwordChangedAt: {
      type: Date,
      select: false,
    },

    // Login tracking (optional but useful)
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
    },
    // Google OAuth fields
    googleId: {
      type: String,
      unique: true,
      sparse: true, // Allows null values to be non-unique
      select: false,
    },

    avatar: {
      type: String, // URL to profile picture
    },

    // Also update the email validation to not require password for Google users
    // Modify the password field:
    password: {
      type: String,
      required: function () {
        // Password only required if not a Google user
        return !this.googleId;
      },
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
    // Virtual properties
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/**
 * INDEXES
 *
 * Indexes improve query performance but slow down writes.
 * Create indexes for fields you frequently query.
 */
userSchema.index({ email: 1 }); // 1 = ascending
userSchema.index({ createdAt: -1 }); // -1 = descending (newest first)

/**
 * VIRTUAL PROPERTIES
 *
 * Computed properties that don't get stored in the database
 */
userSchema.virtual('fullName').get(function () {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.firstName || this.lastName || '';
});

/**
 * MIDDLEWARE (HOOKS)
 *
 * These run automatically at specific times
 */

/**
 * PRE-SAVE MIDDLEWARE
 *
 * This runs BEFORE saving a document to the database.
 * We use it to hash passwords automatically.
 *
 * IMPORTANT: Only hash if password is modified!
 */
userSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }

  try {
    // Hash password with bcrypt
    // Salt rounds = 12 (higher = more secure but slower)
    const salt = await bcrypt.genSalt(config.security.bcryptRounds);
    this.password = await bcrypt.hash(this.password, salt);

    // If password is being changed (not on creation), update passwordChangedAt
    if (!this.isNew) {
      // Subtract 1 second to ensure token is created after password change
      this.passwordChangedAt = Date.now() - 1000;
    }

    next();
  } catch (error) {
    next(error);
  }
});

/**
 * INSTANCE METHODS
 *
 * These methods are available on individual user documents.
 * Example: user.comparePassword('password123')
 */

/**
 * Compare provided password with hashed password in database
 *
 * @param {string} candidatePassword - Plain text password from login
 * @returns {Promise<boolean>} - True if passwords match
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    // bcrypt.compare automatically handles the salt
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

/**
 * Check if password was changed after a JWT was issued
 *
 * This is important for invalidating old tokens after password change.
 *
 * @param {number} JWTTimestamp - When the JWT was issued (in seconds)
 * @returns {boolean} - True if password was changed after JWT was issued
 */
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    // Convert passwordChangedAt to seconds (JWT timestamp is in seconds)
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    // Return true if password was changed after JWT was issued
    return JWTTimestamp < changedTimestamp;
  }
  // False means password has never been changed
  return false;
};

/**
 * Check if account is locked due to failed login attempts
 *
 * @returns {boolean} - True if account is locked
 */
userSchema.methods.isLocked = function () {
  // Check if lockUntil is set and is in the future
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

/**
 * Increment login attempts and lock account if threshold exceeded
 *
 * @returns {Promise<void>}
 */
userSchema.methods.incLoginAttempts = async function () {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 },
    });
  }

  // Otherwise, increment login attempts
  const updates = { $inc: { loginAttempts: 1 } };

  // Lock the account after 5 failed attempts (configurable)
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCK_TIME = 2 * 60 * 60 * 1000; // 2 hours

  if (this.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + LOCK_TIME };
  }

  return this.updateOne(updates);
};

/**
 * Reset login attempts after successful login
 *
 * @returns {Promise<void>}
 */
userSchema.methods.resetLoginAttempts = async function () {
  return this.updateOne({
    $set: { loginAttempts: 0, lastLoginAt: Date.now() },
    $unset: { lockUntil: 1 },
  });
};

/**
 * STATIC METHODS
 *
 * These methods are available on the Model itself.
 * Example: User.findByEmail('user@example.com')
 */

/**
 * Find user by email (useful for login)
 *
 * @param {string} email - User's email
 * @returns {Promise<Document|null>} - User document or null
 */
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() });
};

/**
 * Get user with password (for authentication)
 *
 * @param {string} email - User's email
 * @returns {Promise<Document|null>} - User document with password or null
 */
userSchema.statics.findByEmailWithPassword = function (email) {
  return this.findOne({ email: email.toLowerCase() }).select('+password');
};

/**
 * QUERY MIDDLEWARE
 *
 * Runs before/after queries
 */

// Exclude inactive users from all find queries (soft delete pattern)
userSchema.pre(/^find/, function (next) {
  // 'this' points to the current query
  // Only show active users
  this.find({ isActive: { $ne: false } });
  next();
});

/**
 * Create and export the User model
 */
const User = mongoose.model('User', userSchema);

export default User;

/**
 * USAGE EXAMPLES:
 *
 * 1. Create a new user:
 * ```
 * const user = await User.create({
 *   email: 'user@example.com',
 *   password: 'password123',
 *   firstName: 'John',
 *   lastName: 'Doe'
 * });
 * // Password is automatically hashed!
 * ```
 *
 * 2. Find user and compare password:
 * ```
 * const user = await User.findByEmailWithPassword('user@example.com');
 * const isMatch = await user.comparePassword('password123');
 * ```
 *
 * 3. Update user (password will be re-hashed):
 * ```
 * user.password = 'newPassword123';
 * await user.save(); // pre-save hook runs automatically
 * ```
 */
