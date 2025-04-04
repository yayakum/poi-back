// Modified app.js without HTTPS support
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import http from 'http';
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
const SERVER_URL = process.env.SERVER_URL;
const PORT = process.env.PORT || 3000;

// Initialize Prisma
const prisma = new PrismaClient();

// Initialize Express
const app = express();

// Set up HTTP server
const server = http.createServer(app);
console.log('Starting server with HTTP');

// Configure Socket.IO with namespaces
const socketInstances = configureSocket(server);

// Get current directory (needed for ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORS configuration
const corsOptions = {
  origin: 'https://poi-front.vercel.app',
  credentials: true
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
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`También accesible en http://192.168.50.145:${PORT}`);
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