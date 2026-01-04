/**
 * Email Service Configuration
 * 
 * Handles email configuration using Nodemailer.
 * 
 * PRODUCTION CONSIDERATIONS:
 * - Use a transactional email service (SendGrid, AWS SES, Mailgun, Postmark)
 * - Gmail is fine for development but has limits (500 emails/day)
 * - Monitor delivery rates and bounces
 * - Implement email queues for reliability (Bull, BullMQ)
 * - Use templates for consistent branding
 * 
 * SECURITY:
 * - Use App Passwords for Gmail (not your regular password)
 * - Enable 2FA on email account
 * - Use environment variables for credentials
 * - Validate email addresses before sending
 */

import nodemailer from 'nodemailer';
import config from '../config/env.js';

/**
 * Create email transporter
 * 
 * This is the "mail server connection" that Nodemailer uses to send emails.
 * Different for development vs production.
 */
const createTransporter = () => {
  // Development: Use Gmail or any SMTP service
  if (config.isDevelopment()) {
    return nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: false, // true for 465, false for other ports
      auth: {
        user: config.email.user,
        pass: config.email.password,
      },
    });
  }

  // Production: Use a transactional email service
  // Example for SendGrid:
  // return nodemailer.createTransport({
  //   host: 'smtp.sendgrid.net',
  //   port: 587,
  //   auth: {
  //     user: 'apikey',
  //     pass: process.env.SENDGRID_API_KEY,
  //   },
  // });

  // For now, use same config in production
  // In real production, switch to SendGrid/SES/Mailgun
  return nodemailer.createTransporter({
    host: config.email.host,
    port: config.email.port,
    secure: config.isProduction(), // Use TLS in production
    auth: {
      user: config.email.user,
      pass: config.email.password,
    },
  });
};

const transporter = createTransporter();

/**
 * Verify transporter configuration on startup
 * This helps catch configuration errors early
 */
const verifyTransporter = async () => {
  try {
    await transporter.verify();
    console.log('✅ Email service is ready');
  } catch (error) {
    console.error('❌ Email service configuration error:', error.message);
    // Don't exit process - emails will fail gracefully
    // In production, you might want to exit here
  }
};

// Verify on module load
verifyTransporter();

/**
 * Base email sending function
 * 
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text version
 * @param {string} options.html - HTML version
 * @returns {Promise<void>}
 */
const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const mailOptions = {
      from: `${config.email.from} <${config.email.user}>`,
      to,
      subject,
      text,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    
    if (config.isDevelopment()) {
      console.log('📧 Email sent:', info.messageId);
      console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
    }

    return info;
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    throw new Error('Failed to send email. Please try again later.');
  }
};

export { transporter, sendEmail };
export default { transporter, sendEmail };
