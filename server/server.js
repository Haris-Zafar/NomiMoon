/**
 * Server Entry Point
 * 
 * This is where the application starts.
 * Responsibilities:
 * - Connect to database
 * - Start the Express server
 * - Handle uncaught exceptions
 */

import app from './src/app.js';
import connectDB from './src/config/database.js';
import config from './src/config/env.js';

/**
 * Handle uncaught exceptions
 * These are synchronous errors that weren't caught anywhere in the code
 * This should be at the TOP of the file
 */
process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION! Shutting down...');
  console.error('Error name:', err.name);
  console.error('Error message:', err.message);
  console.error('Stack trace:', err.stack);
  // Exit with failure code
  process.exit(1);
});

/**
 * Start the server
 */
const startServer = async () => {
  try {
    // 1. Connect to database first
    await connectDB();
    console.log('✅ Database connection established');

    // 2. Start Express server
    const server = app.listen(config.port, () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🚀 Server running in ${config.env} mode`);
      console.log(`📡 Listening on port ${config.port}`);
      console.log(`🔗 API: http://localhost:${config.port}/api`);
      console.log(`🏥 Health: http://localhost:${config.port}/health`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });

    /**
     * Handle unhandled promise rejections
     * These are async errors that weren't caught with try-catch or .catch()
     */
    process.on('unhandledRejection', (err) => {
      console.error('💥 UNHANDLED REJECTION! Shutting down gracefully...');
      console.error('Error name:', err.name);
      console.error('Error message:', err.message);
      
      // Close server & exit process
      server.close(() => {
        process.exit(1);
      });
      
      // Force shutdown if server doesn't close in time
      setTimeout(() => {
        console.error('⚠️  Forcefully shutting down...');
        process.exit(1);
      }, 10000);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the application
startServer();
