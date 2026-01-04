/**
 * Database Configuration Module
 * 
 * Handles MongoDB connection with:
 * - Automatic reconnection
 * - Connection event logging
 * - Graceful error handling
 * - Production-ready settings
 */

import mongoose from 'mongoose';
import config from './env.js';

/**
 * Connect to MongoDB with retry logic
 */
const connectDB = async () => {
  try {
    // Connection options (Mongoose 7+ handles most automatically)
    const options = {
      // Mongoose 8 doesn't need these anymore, but keeping for reference
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
    };

    // Connect to MongoDB
    const conn = await mongoose.connect(config.database.uri, options);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);

    // Development only: Log queries
    if (config.isDevelopment()) {
      mongoose.set('debug', true);
    }

    return conn;
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    // Exit process with failure in production
    // In development, you might want to continue and retry
    process.exit(1);
  }
};

/**
 * Handle MongoDB connection events
 */
mongoose.connection.on('connected', () => {
  console.log('🔗 Mongoose connected to DB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('🔌 Mongoose disconnected');
});

/**
 * Graceful shutdown handler
 * Ensures database connections are closed properly
 */
const gracefulShutdown = async (msg) => {
  try {
    await mongoose.connection.close();
    console.log(`\n💤 Mongoose disconnected through ${msg}`);
    process.exit(0);
  } catch (err) {
    console.error('Error during graceful shutdown:', err);
    process.exit(1);
  }
};

// Listen for termination signals
process.on('SIGINT', () => gracefulShutdown('app termination (SIGINT)'));
process.on('SIGTERM', () => gracefulShutdown('app termination (SIGTERM)'));

// For nodemon restarts
process.once('SIGUSR2', async () => {
  await gracefulShutdown('nodemon restart');
  process.kill(process.pid, 'SIGUSR2');
});

export default connectDB;
