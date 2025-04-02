// Modified app.js with HTTPS support
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import http from 'http';
import https from 'https'; // Import HTTPS module
import fs from 'fs'; // Import FS to read certificate files
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import userRoutes from './routes/user.routes.js';
import groupRoutes from './routes/group.routes.js';
import messageRoutes from './routes/message.routes.js';
import taskRoutes from './routes/task.routes.js';
import rewardsRoutes from './routes/rewards.routes.js';
import videoRoutes from './routes/video.routes.js';
import configureSocket from './socket.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Get server URL from environment or use default
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const USE_HTTPS = process.env.USE_HTTPS === 'true' || false;
const PORT = process.env.PORT || 3000;

// Initialize Prisma
const prisma = new PrismaClient();

// Initialize Express
const app = express();

// Set up HTTP or HTTPS server based on configuration
let server;

if (USE_HTTPS) {
  try {
    // Read SSL certificate and key files
    // For development, you can generate self-signed certificates
    const privateKey = fs.readFileSync('server.key', 'utf8');
    const certificate = fs.readFileSync('server.cert', 'utf8');
    const credentials = { key: privateKey, cert: certificate };
    
    // Create HTTPS server
    server = https.createServer(credentials, app);
    console.log('Starting server with HTTPS enabled');
  } catch (error) {
    console.error('Error setting up HTTPS server:', error);
    console.log('Falling back to HTTP server');
    server = http.createServer(app);
  }
} else {
  server = http.createServer(app);
  console.log('Starting server with HTTP (no HTTPS)');
}

// Configure Socket.IO with namespaces
const socketInstances = configureSocket(server);

// Get current directory (needed for ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3001', 'http://192.168.50.145:3001', 'https://192.168.50.145:3001'];

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
};

// Middleware
app.use(cors(corsOptions)); // Use configured CORS options
app.use(express.json()); // Parse request body as JSON
app.use(morgan('dev')); // Request logging
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Routes
app.use('/api', userRoutes); // Prefix '/api' for user routes
app.use('/api', groupRoutes); // Prefix '/api' for group routes
app.use('/api', messageRoutes); // Prefix '/api' for message routes
app.use('/api', taskRoutes); // Prefix '/api' for task routes
app.use('/api', rewardsRoutes);
app.use('/api', videoRoutes);

// Welcome route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Bienvenido a la API de Chat',
    serverUrl: SERVER_URL,
    socketNamespaces: {
      private: '/private',
      group: '/group',
      video: '/video'
    },
    secure: req.secure
  });
});

// Handle not found routes
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

// Start server
server.listen(PORT, () => {
  const protocol = USE_HTTPS ? 'https' : 'http';
  console.log(`Servidor corriendo en ${protocol}://localhost:${PORT}`);
  console.log(`También accesible en ${protocol}://192.168.50.145:${PORT}`);
  console.log(`Socket.IO privado en namespace: /private`);
  console.log(`Socket.IO grupal en namespace: /group`);
  console.log(`Socket.IO video en namespace: /video`);
});

// Handle Prisma errors
prisma.$on('query', (e) => {
  console.log('Query: ' + e.query);
  console.log('Params: ' + e.params);
  console.log('Duration: ' + e.duration + 'ms');
});

// Close database connection when app closes
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});