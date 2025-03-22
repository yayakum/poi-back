import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Función auxiliar para asignar puntos por enviar mensajes
const awardPointsForMessage = async (userId, messageType) => {
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

const configureSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "http://localhost:3001",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Almacenar conexiones de usuario
  const userSockets = {};
  
  // Seguimiento de conexiones múltiples para un usuario
  const userConnections = {};

  // Seguimiento de llamadas activas
  const activeVideoCalls = {};

  io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);
    let authenticatedUserId = null;
    
    // Autenticar usuario
    socket.on('authenticate', async (userId) => {
      try {
        authenticatedUserId = userId;
        
        // Inicializar contador de conexiones si no existe
        if (!userConnections[userId]) {
          userConnections[userId] = 0;
          
          // Solo actualizar estado a "online" si es la primera conexión del usuario
          await prisma.usuario.update({
            where: { id: parseInt(userId) },
            data: { estado: 'online' }
          });
          
          // Informar a todos los usuarios conectados sobre el cambio de estado
          io.emit('userStatusChanged', { userId, status: 'online' });
          
          console.log(`Usuario ${userId} autenticado y en línea (primera conexión)`);
        } else {
          console.log(`Usuario ${userId} ya estaba autenticado, no se actualiza estado`);
        }
        
        // Incrementar contador de conexiones
        userConnections[userId]++;
        
        // Guardar la asociación entre el ID de usuario y el socket
        userSockets[userId] = socket.id;
        
        console.log(`Usuario ${userId} autenticado (${userConnections[userId]} conexiones)`);
      } catch (error) {
        console.error('Error en autenticación:', error);
      }
    });

    // Unirse a un chat (para mensajes privados)
    socket.on('joinChat', ({ userId, targetId }) => {
      const roomId = [userId, targetId].sort().join('-');
      socket.join(roomId);
      console.log(`Usuario ${userId} se unió al chat con ${targetId}, sala: ${roomId}`);
    });

    // Enviar mensaje privado
    socket.on('sendPrivateMessage', async (data) => {
      try {
        const { senderId, receiverId, text, senderName } = data;
        
        // Crear mensaje en la base de datos
        const message = await prisma.mensaje.create({
          data: {
            remitente_id: parseInt(senderId),
            destinatario_id: parseInt(receiverId),
            contenido: text,
            tipo: 'texto'
          }
        });
        
        // Otorgar puntos al usuario por enviar mensaje de texto
        await awardPointsForMessage(senderId, 'texto');
        
        // Determinar la sala de chat
        const roomId = [senderId, receiverId].sort().join('-');
        
        // Crear el objeto de mensaje formateado
        const formattedMessage = {
          id: message.id,
          senderId,
          senderName,
          receiverId,
          text,
          timestamp: message.created_at
        };
        
        // Enviar mensaje SOLO al receptor (si está en la sala)
        socket.to(roomId).emit('privateMessage', formattedMessage);
        
        // Enviar confirmación al remitente con el mismo formato
        socket.emit('privateMessageConfirmation', formattedMessage);
        
        // Notificar al receptor si no está en la sala de chat
        const receiverSocketId = userSockets[receiverId];
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('newMessageNotification', {
            senderId,
            senderName,
            preview: text.substring(0, 30) + (text.length > 30 ? '...' : '')
          });
        }
        
        console.log(`Mensaje enviado de ${senderId} a ${receiverId}`);
      } catch (error) {
        console.error('Error al enviar mensaje:', error);
        socket.emit('messageError', { error: 'No se pudo enviar el mensaje' });
      }
    });
    
    // Desconexión del usuario
    socket.on('disconnect', async () => {
      try {
        // Solo procesar si el usuario se autenticó con este socket
        if (authenticatedUserId) {
          // Decrementar contador de conexiones
          userConnections[authenticatedUserId]--;
          
          console.log(`Usuario ${authenticatedUserId} desconectó un socket (${userConnections[authenticatedUserId]} conexiones restantes)`);
          
          // Solo marcar como offline si no hay más conexiones activas
          if (userConnections[authenticatedUserId] <= 0) {
            // Actualizar el estado del usuario a "offline"
            await prisma.usuario.update({
              where: { id: parseInt(authenticatedUserId) },
              data: { estado: 'offline' }
            });
            
            // Eliminar la asociación
            delete userSockets[authenticatedUserId];
            delete userConnections[authenticatedUserId];
            
            // Informar a todos los usuarios conectados
            io.emit('userStatusChanged', { userId: authenticatedUserId, status: 'offline' });
            
            console.log(`Usuario ${authenticatedUserId} completamente desconectado`);
          }
        }
      } catch (error) {
        console.error('Error en desconexión:', error);
      }
    });
    
    // Manejo explícito de cierre de sesión
    socket.on('logout', async (userId) => {
      try {
        if (userId) {
          // Actualizar el estado del usuario a "offline"
          await prisma.usuario.update({
            where: { id: parseInt(userId) },
            data: { estado: 'offline' }
          });
          
          // Eliminar todas las conexiones
          delete userSockets[userId];
          delete userConnections[userId];
          
          // Informar a todos los usuarios conectados
          io.emit('userStatusChanged', { userId, status: 'offline' });
          
          console.log(`Usuario ${userId} cerró sesión`);
        }
      } catch (error) {
        console.error('Error en logout:', error);
      }
    });
  });

  return io;
};

export default configureSocket;