/**
 * Email Service Configuration
 * FIXED: Development mode doesn't require real email
 */

import nodemailer from 'nodemailer';
import config from '../config/env.js';

/**
 * Create email transporter
 */
const createTransporter = () => {
  // DEVELOPMENT MODE: Use Ethereal (fake email service)
  if (config.isDevelopment()) {
    // Return a fake transporter for development
    // Emails won't actually be sent, but we'll log them to console
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: 'test@ethereal.email',
        pass: 'test',
      },
    });
  }

  // PRODUCTION: Use real email service
  return nodemailer.createTransporter({
    host: config.email.host,
    port: config.email.port,
    secure: config.isProduction(),
    auth: {
      user: config.email.user,
      pass: config.email.password,
    },
  });
};

const transporter = createTransporter();

/**
 * Verify transporter (skip in development)
 */
const verifyTransporter = async () => {
  if (config.isDevelopment()) {
    console.log(
      '📧 Email service: DEVELOPMENT MODE (emails will be logged, not sent)'
    );
    return;
  }

  try {
    await transporter.verify();
    console.log('✅ Email service is ready');
  } catch (error) {
    console.error('❌ Email service configuration error:', error.message);
    console.log(
      '💡 TIP: For Gmail, use App Password: https://support.google.com/accounts/answer/185833'
    );
  }
};

verifyTransporter();

/**
 * Send Email - DEVELOPMENT MODE LOGS INSTEAD
 */
const sendEmail = async ({ to, subject, text, html }) => {
  try {
    // DEVELOPMENT: Just log the email instead of sending
    if (config.isDevelopment()) {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📧 EMAIL (Development Mode - Not Actually Sent)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log('─────────────────────────────────────────');
      console.log(text);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      return { messageId: 'dev-mode-' + Date.now() };
    }

    // PRODUCTION: Actually send email
    const mailOptions = {
      from: `${config.email.from} <${config.email.user}>`,
      to,
      subject,
      text,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('📧 Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    throw new Error('Failed to send email. Please try again later.');
  }
};

export { transporter, sendEmail };
export default { transporter, sendEmail };
