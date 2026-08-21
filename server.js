require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const { checkDatabaseConnection, prisma } = require('./src/config/database');

const PORT = process.env.PORT || 3000;

async function startServer() {
  // Verify database connection on startup
  const dbConnected = await checkDatabaseConnection();
  if (!dbConnected) {
    console.warn('⚠️ Warning: Database connection failed on startup. Verify your DATABASE_URL in .env');
  }

  const server = http.createServer(app);

  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Library Management System is running!`);
    console.log(`📡 Local URL:    http://localhost:${PORT}`);
    console.log(`🌍 Environment:  ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔐 Admin Login:  admin@library.local / ChangeThisPassword123!`);
    console.log(`📚 Student Login: student1@college.edu / Student123!`);
    console.log(`=======================================================`);
  });

  // Graceful shutdown handling
  const shutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      console.log('✓ HTTP server closed.');
      await prisma.$disconnect();
      console.log('✓ Database connection closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer();
