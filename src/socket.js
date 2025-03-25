import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import configurePrivateSocket from './sockets/privatesocket.js';
import configureGroupSocket from './sockets/groupsocket.js';
import configureVideoSocket from './sockets/videosocket.js';  // Uncommented

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
  groupMembers: {}
};

const configureSocket = (server) => {
  // Crear instancias separadas de Socket.IO usando namespaces
  const privateNamespace = '/private';
  const groupNamespace = '/group';
  const videoNamespace = '/video';  // Uncommented

  const io = new Server(server, {
    cors: {
      origin: "http://localhost:3001",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Configurar servidores separados usando namespaces
  const privateIo = io.of(privateNamespace);
  const groupIo = io.of(groupNamespace);
  const videoIo = io.of(videoNamespace);  // Uncommented

  // Pasar las instancias a sus respectivos configuradores
  configurePrivateSocket(privateIo, prisma, sharedState);
  configureGroupSocket(groupIo, prisma, sharedState);
  configureVideoSocket(videoIo, prisma, sharedState);  // Uncommented

  return {
    io,
    privateIo,
    groupIo,
    videoIo  // Uncommented
  };
};

export default configureSocket;