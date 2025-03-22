import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import http from 'http';
import { PrismaClient } from '@prisma/client';
import userRoutes from './routes/user.routes.js';
import groupRoutes from './routes/group.routes.js';
import messageRoutes from './routes/message.routes.js';
import taskRoutes from './routes/task.routes.js';
import rewardsRoutes from './routes/rewards.routes.js';
import configureSocket from './socket.js';

// Inicializar prisma
const prisma = new PrismaClient();

// Inicializar express
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Configurar Socket.IO
const io = configureSocket(server);

// Configuración de CORS
const corsOptions = {
  origin: 'http://localhost:3001', // Asegúrate de que este sea el puerto de tu frontend
  credentials: true,
};

// Middleware
app.use(cors(corsOptions)); // Usar las opciones de CORS configuradas
app.use(express.json()); // Para parsear el cuerpo de las solicitudes en formato JSON
app.use(morgan('dev')); // Para logging de las solicitudes

// Rutas
app.use('/api', userRoutes); // Prefijo '/api' para las rutas de usuario
app.use('/api', groupRoutes); // Prefijo '/api' para las rutas de grupos
app.use('/api', messageRoutes); // Prefijo '/api' para las rutas de mensajes
app.use('/api', taskRoutes); // Prefijo '/api' para las rutas de tareas
app.use('/api', rewardsRoutes);

// Ruta de bienvenida
app.get('/', (req, res) => {
  res.json({ message: 'Bienvenido a la API de Chat' });
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

// Manejo de errores de Prisma
prisma.$on('query', (e) => {
  console.log('Query: ' + e.query);
  console.log('Params: ' + e.params);
  console.log('Duration: ' + e.duration + 'ms');
});

// Cerrar conexión a la base de datos cuando se cierra la aplicación
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});