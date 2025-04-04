import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import configurePrivateSocket from './sockets/privatesocket.js';
import configureGroupSocket from './sockets/groupsocket.js';
import configureVideoSocket from './sockets/videosocket.js';

const prisma = new PrismaClient();

// Función auxiliar para asignar puntos por enviar mensajes (compartida)
export const awardPointsForMessage = async (userId, messageType) => {
  try {
    // Solo otorgar puntos si el mensaje es de tipo texto
    if (messageType === 'texto') {
      await prisma.usuario.update({
        where: { id: parseInt(userId) },
        data: {
          puntos_acumulados: {
            increment: 100
          }
        }
      });
      
      // Registrar la transacción de puntos
      await prisma.puntos.create({
        data: {
          usuario_id: parseInt(userId),
          puntos: 100,
          descripcion: 'Puntos por enviar mensaje de texto'
        }
      });
      
      console.log(`100 puntos otorgados al usuario ${userId} por enviar mensaje de texto`);
    }
  } catch (error) {
    console.error('Error al otorgar puntos por mensaje:', error);
  }
};

// Variables compartidas entre todos los servidores de sockets
export const sharedState = {
  // Almacenar conexiones de usuario (inicializar como objeto vacío)
  userSockets: {},
  
  // Seguimiento de conexiones múltiples para un usuario
  userConnections: {},

  // Seguimiento de usuarios por grupos
  groupMembers: {},
  
  // Seguimiento de qué usuarios están en qué chats
  userActiveChatRooms: {},
  
  // Referencia a io principal (se asignará más abajo)
  io: null
};

const configureSocket = (server) => {
  // Crear instancias separadas de Socket.IO usando namespaces
  const privateNamespace = '/private';
  const groupNamespace = '/group';
  const videoNamespace = '/video';
  const allowedOrigins = process.env.ALLOWED_ORIGINS;
  const io = new Server(server, {
    cors: {
      // origin: ['http://localhost:3001', 'http://192.168.50.145:3001', 'https://192.168.50.145:3001'],
      origin: '*', 
      // origin: allowedOrigins,
      methods: ["GET", "POST", "PUT", "DELETE"],
      // allowedHeaders: ["Content-Type", "Authorization"],
      // credentials: true
    }
  });
  
  // Guardar referencia a io en el estado compartido
  sharedState.io = io;

  // Configurar servidores separados usando namespaces
  const privateIo = io.of(privateNamespace);
  const groupIo = io.of(groupNamespace);
  const videoIo = io.of(videoNamespace);

  // Pasar las instancias a sus respectivos configuradores
  configurePrivateSocket(privateIo, prisma, sharedState);
  configureGroupSocket(groupIo, prisma, sharedState);
  configureVideoSocket(videoIo, prisma, sharedState);

  return {
    io,
    privateIo,
    groupIo,
    videoIo
  };
};

export default configureSocket;