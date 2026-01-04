/**
 * Email Service
 * 
 * High-level email sending functions with templates.
 * 
 * BEST PRACTICES:
 * - Separate email logic from business logic
 * - Use HTML templates for better user experience
 * - Include both HTML and plain text versions
 * - Use consistent branding
 * - Include clear call-to-action buttons
 * - Test emails before deploying
 * 
 * FUTURE IMPROVEMENTS:
 * - Use email template engine (Handlebars, Pug)
 * - Store templates in separate files
 * - Add email queue (Bull/BullMQ) for reliability
 * - Track email delivery and opens
 * - Support multiple languages
 */

import { sendEmail } from '../config/email.js';
import config from '../config/env.js';

/**
 * Email Templates
 * 
 * In production, these should be in separate files or use a template engine.
 * For now, we'll keep them inline for simplicity.
 */

/**
 * Generate verification email HTML
 */
const getVerificationEmailTemplate = (verificationLink, firstName) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">Welcome${firstName ? ` ${firstName}` : ''}!</h1>
      </div>
      
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #667eea; margin-top: 0;">Verify Your Email Address</h2>
        
        <p>Thank you for signing up! Please verify your email address to get started.</p>
        
        <p>Click the button below to verify your email:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" 
             style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                    color: white; 
                    padding: 15px 40px; 
                    text-decoration: none; 
                    border-radius: 5px; 
                    display: inline-block;
                    font-weight: bold;">
            Verify Email
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">
          Or copy and paste this link into your browser:<br>
          <a href="${verificationLink}" style="color: #667eea; word-break: break-all;">
            ${verificationLink}
          </a>
        </p>
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        
        <p style="color: #666; font-size: 12px; margin-bottom: 0;">
          This link will expire in 24 hours.<br>
          If you didn't create an account, please ignore this email.
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>&copy; ${new Date().getFullYear()} Your App Name. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate password reset email HTML
 */
const getPasswordResetEmailTemplate = (resetLink, firstName) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">Password Reset</h1>
      </div>
      
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #f5576c; margin-top: 0;">Reset Your Password</h2>
        
        <p>Hi${firstName ? ` ${firstName}` : ''},</p>
        
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" 
             style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); 
                    color: white; 
                    padding: 15px 40px; 
                    text-decoration: none; 
                    border-radius: 5px; 
                    display: inline-block;
                    font-weight: bold;">
            Reset Password
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">
          Or copy and paste this link into your browser:<br>
          <a href="${resetLink}" style="color: #f5576c; word-break: break-all;">
            ${resetLink}
          </a>
        </p>
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        
        <p style="color: #666; font-size: 12px; margin-bottom: 0;">
          This link will expire in 1 hour.<br>
          If you didn't request a password reset, please ignore this email and your password will remain unchanged.
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>&copy; ${new Date().getFullYear()} Your App Name. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
};

/**
 * Plain text versions (fallback for email clients that don't support HTML)
 */

const getVerificationEmailText = (verificationLink, firstName) => {
  return `
Welcome${firstName ? ` ${firstName}` : ''}!

Thank you for signing up! Please verify your email address to get started.

Click this link to verify your email:
${verificationLink}

This link will expire in 24 hours.

If you didn't create an account, please ignore this email.

---
© ${new Date().getFullYear()} Your App Name. All rights reserved.
  `.trim();
};

const getPasswordResetEmailText = (resetLink, firstName) => {
  return `
Hi${firstName ? ` ${firstName}` : ''},

We received a request to reset your password.

Click this link to reset your password:
${resetLink}

This link will expire in 1 hour.

If you didn't request a password reset, please ignore this email and your password will remain unchanged.

---
© ${new Date().getFullYear()} Your App Name. All rights reserved.
  `.trim();
};

/**
 * Email Service Functions
 */

/**
 * Send email verification email
 * 
 * @param {Object} user - User object
 * @param {string} token - Verification token
 * @returns {Promise<void>}
 */
export const sendVerificationEmail = async (user, token) => {
  // Construct verification link
  const verificationLink = `${config.clientUrl}/verify-email/${token}`;

  // Get templates
  const html = getVerificationEmailTemplate(verificationLink, user.firstName);
  const text = getVerificationEmailText(verificationLink, user.firstName);

  // Send email
  await sendEmail({
    to: user.email,
    subject: 'Verify Your Email Address',
    text,
    html,
  });

  console.log(`📧 Verification email sent to ${user.email}`);
};

/**
 * Send password reset email
 * 
 * @param {Object} user - User object
 * @param {string} token - Reset token
 * @returns {Promise<void>}
 */
export const sendPasswordResetEmail = async (user, token) => {
  // Construct reset link
  const resetLink = `${config.clientUrl}/reset-password/${token}`;

  // Get templates
  const html = getPasswordResetEmailTemplate(resetLink, user.firstName);
  const text = getPasswordResetEmailText(resetLink, user.firstName);

  // Send email
  await sendEmail({
    to: user.email,
    subject: 'Reset Your Password',
    text,
    html,
  });

  console.log(`📧 Password reset email sent to ${user.email}`);
};

/**
 * Send welcome email (after successful verification)
 * 
 * @param {Object} user - User object
 * @returns {Promise<void>}
 */
export const sendWelcomeEmail = async (user) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">Welcome to Our Platform!</h1>
      </div>
      
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #667eea;">You're All Set!</h2>
        
        <p>Hi ${user.firstName || 'there'},</p>
        
        <p>Your email has been verified successfully! You can now access all features of our platform.</p>
        
        <p>Here are some things you can do:</p>
        <ul>
          <li>Complete your profile</li>
          <li>Explore our features</li>
          <li>Connect with other users</li>
        </ul>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${config.clientUrl}/dashboard" 
             style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                    color: white; 
                    padding: 15px 40px; 
                    text-decoration: none; 
                    border-radius: 5px; 
                    display: inline-block;
                    font-weight: bold;">
            Get Started
          </a>
        </div>
        
        <p>If you have any questions, feel free to reach out to our support team.</p>
      </div>
    </body>
    </html>
  `;

  const text = `
Welcome to Our Platform!

Hi ${user.firstName || 'there'},

Your email has been verified successfully! You can now access all features of our platform.

Get started: ${config.clientUrl}/dashboard

If you have any questions, feel free to reach out to our support team.
  `.trim();

  await sendEmail({
    to: user.email,
    subject: 'Welcome to Our Platform!',
    text,
    html,
  });

  console.log(`📧 Welcome email sent to ${user.email}`);
};

export default {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
};

/**
 * USAGE EXAMPLES:
 * 
 * 1. Send verification email:
 * ```
 * import { sendVerificationEmail } from './services/emailService.js';
 * 
 * await sendVerificationEmail(user, verificationToken);
 * ```
 * 
 * 2. Send password reset email:
 * ```
 * import { sendPasswordResetEmail } from './services/emailService.js';
 * 
 * await sendPasswordResetEmail(user, resetToken);
 * ```
 * 
 * 3. Send welcome email:
 * ```
 * import { sendWelcomeEmail } from './services/emailService.js';
 * 
 * await sendWelcomeEmail(user);
 * ```
 */
