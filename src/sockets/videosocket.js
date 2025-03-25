// src/sockets/videosocket.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const configureVideoSocket = (io, prisma, sharedState) => {
  io.on('connection', (socket) => {
    console.log('Cliente conectado al servidor de video', socket.id);
    
    // Usuario se autentica
    socket.on('authenticate', async (userId) => {
      if (!userId) return;
      
      userId = parseInt(userId);
      
      // Verificar y asegurarse de que userSockets[userId] sea un array
      if (!sharedState.userSockets) {
        sharedState.userSockets = {};
      }
      
      // Esto es lo que arregla el error - asegurar que sea un array antes de usar push
      if (!sharedState.userSockets[userId] || !Array.isArray(sharedState.userSockets[userId])) {
        sharedState.userSockets[userId] = [];
      }
      
      // Agregar este socket a la lista del usuario
      sharedState.userSockets[userId].push(socket.id);
      
      console.log(`Usuario ${userId} autenticado en el servidor de video con socketId ${socket.id}`);
      
      // Actualizar contador de conexiones
      if (!sharedState.userConnections) {
        sharedState.userConnections = {};
      }
      
      if (!sharedState.userConnections[userId]) {
        sharedState.userConnections[userId] = 0;
      }
      sharedState.userConnections[userId]++;
      
      // Si es la primera conexión, actualizar estado a online
      if (sharedState.userConnections[userId] === 1) {
        try {
          await prisma.usuario.update({
            where: { id: userId },
            data: { estado: 'online' }
          });
          
          // Notificar a otros usuarios sobre el cambio de estado
          socket.broadcast.emit('userStatusChanged', {
            userId: userId,
            status: 'online'
          });
        } catch (error) {
          console.error(`Error al actualizar estado de usuario ${userId}:`, error);
        }
      }
    });
    
    // Iniciar una llamada
    socket.on('initiateCall', async (data) => {
      try {
        const { callerId, callerName, receiverId, roomId, isVideo, callId } = data;
        
        // Verificar que el receptor existe
        const receiver = await prisma.usuario.findUnique({
          where: { id: parseInt(receiverId) }
        });
        
        if (!receiver) {
          socket.emit('callError', { message: 'Usuario no encontrado' });
          return;
        }
        
        console.log(`Llamada iniciada de ${callerId} a ${receiverId}, ID: ${callId}`);
        
        // Verificar si el receptor está en línea
        if (sharedState.userSockets[receiverId] && sharedState.userSockets[receiverId].length > 0) {
          // Enviar notificación de llamada entrante al receptor
          sharedState.userSockets[receiverId].forEach(socketId => {
            io.to(socketId).emit('incomingCall', {
              callId,
              callerId: parseInt(callerId),
              callerName,
              roomId,
              isVideo
            });
          });
          
          // Notificar al emisor que la llamada fue enviada
          socket.emit('callInitiated', {
            callId,
            receiverId,
            roomId
          });
        } else {
          // Si el receptor no está en línea, marcar la llamada como rechazada
          await prisma.videollamadas.update({
            where: { id: callId },
            data: {
              estado: 'rechazada',
              fin_tiempo: new Date()
            }
          });
          
          // Notificar al emisor que el usuario no está disponible
          socket.emit('callRejected', {
            callId,
            reason: 'El usuario no está en línea'
          });
        }
      } catch (error) {
        console.error('Error al iniciar llamada:', error);
        socket.emit('callError', { message: 'Error al iniciar la llamada' });
      }
    });
    
    // Aceptar una llamada
    socket.on('acceptCall', async (data) => {
      try {
        const { callId, receiverId, callerId, roomId } = data;
        
        // Actualizar la llamada en la base de datos
        const updatedCall = await prisma.videollamadas.update({
          where: { id: parseInt(callId) },
          data: { estado: 'conectada' }
        });
        
        console.log(`Llamada ${callId} aceptada por ${receiverId}`);
        
        // Notificar al emisor que la llamada fue aceptada
        if (sharedState.userSockets[callerId] && sharedState.userSockets[callerId].length > 0) {
          sharedState.userSockets[callerId].forEach(socketId => {
            io.to(socketId).emit('callAccepted', {
              callId,
              roomId,
              receiverId
            });
          });
        }
      } catch (error) {
        console.error('Error al aceptar llamada:', error);
        socket.emit('callError', { message: 'Error al aceptar la llamada' });
      }
    });
    
    // Rechazar una llamada
    socket.on('rejectCall', async (data) => {
      try {
        const { callId, receiverId, callerId, reason } = data;
        
        // Actualizar la llamada en la base de datos
        await prisma.videollamadas.update({
          where: { id: parseInt(callId) },
          data: {
            estado: 'rechazada',
            fin_tiempo: new Date()
          }
        });
        
        console.log(`Llamada ${callId} rechazada por ${receiverId}`);
        
        // Notificar al emisor que la llamada fue rechazada
        if (sharedState.userSockets[callerId] && sharedState.userSockets[callerId].length > 0) {
          sharedState.userSockets[callerId].forEach(socketId => {
            io.to(socketId).emit('callRejected', {
              callId,
              receiverId,
              reason: reason || 'Llamada rechazada por el usuario'
            });
          });
        }
      } catch (error) {
        console.error('Error al rechazar llamada:', error);
        socket.emit('callError', { message: 'Error al rechazar la llamada' });
      }
    });
    
    // Cancelar una llamada (el emisor cancela antes de que el receptor conteste)
    socket.on('cancelCall', async (data) => {
      try {
        const { callId, callerId, receiverId } = data;
        
        // Actualizar la llamada en la base de datos
        await prisma.videollamadas.update({
          where: { id: parseInt(callId) },
          data: {
            estado: 'finalizada',
            fin_tiempo: new Date()
          }
        });
        
        console.log(`Llamada ${callId} cancelada por ${callerId}`);
        
        // Notificar al receptor que la llamada fue cancelada (si está en línea)
        if (sharedState.userSockets[receiverId] && sharedState.userSockets[receiverId].length > 0) {
          sharedState.userSockets[receiverId].forEach(socketId => {
            io.to(socketId).emit('callCancelled', {
              callId,
              callerId
            });
          });
        }
      } catch (error) {
        console.error('Error al cancelar llamada:', error);
        socket.emit('callError', { message: 'Error al cancelar la llamada' });
      }
    });
    
    // Finalizar una llamada en curso
    socket.on('endCall', async (data) => {
      try {
        const { callId, userId, partnerId } = data;
        
        // Actualizar la llamada en la base de datos
        await prisma.videollamadas.update({
          where: { id: parseInt(callId) },
          data: {
            estado: 'finalizada',
            fin_tiempo: new Date()
          }
        });
        
        console.log(`Llamada ${callId} finalizada por ${userId}`);
        
        // Notificar al otro participante que la llamada fue finalizada
        if (sharedState.userSockets[partnerId] && sharedState.userSockets[partnerId].length > 0) {
          sharedState.userSockets[partnerId].forEach(socketId => {
            io.to(socketId).emit('callEnded', {
              callId,
              endedBy: parseInt(userId)
            });
          });
        }
      } catch (error) {
        console.error('Error al finalizar llamada:', error);
        socket.emit('callError', { message: 'Error al finalizar la llamada' });
      }
    });
    
    // Desconexión del socket
    socket.on('disconnect', async () => {
      // Encontrar qué usuario tenía este socket
      let disconnectedUserId = null;
      
      for (const [userId, socketIds] of Object.entries(sharedState.userSockets)) {
        const index = socketIds.indexOf(socket.id);
        if (index !== -1) {
          disconnectedUserId = parseInt(userId);
          // Eliminar este socket de la lista del usuario
          sharedState.userSockets[userId].splice(index, 1);
          break;
        }
      }
      
      if (disconnectedUserId) {
        // Decrementar contador de conexiones
        sharedState.userConnections[disconnectedUserId]--;
        
        // Si no hay más conexiones, actualizar estado a offline
        if (sharedState.userConnections[disconnectedUserId] <= 0) {
          try {
            await prisma.usuario.update({
              where: { id: disconnectedUserId },
              data: { estado: 'offline' }
            });
            
            // Notificar a otros usuarios sobre el cambio de estado
            socket.broadcast.emit('userStatusChanged', {
              userId: disconnectedUserId,
              status: 'offline'
            });
            
            // Buscar llamadas activas y marcarlas como finalizadas
            const activeCall = await prisma.videollamadas.findFirst({
              where: {
                OR: [
                  { iniciador_id: disconnectedUserId },
                  { receptor_id: disconnectedUserId }
                ],
                estado: {
                  in: ['iniciada', 'conectada']
                }
              }
            });
            
            if (activeCall) {
              await prisma.videollamadas.update({
                where: { id: activeCall.id },
                data: {
                  estado: 'finalizada',
                  fin_tiempo: new Date()
                }
              });
              
              // Notificar al otro participante
              const partnerId = activeCall.iniciador_id === disconnectedUserId
                ? activeCall.receptor_id
                : activeCall.iniciador_id;
              
              if (sharedState.userSockets[partnerId] && sharedState.userSockets[partnerId].length > 0) {
                sharedState.userSockets[partnerId].forEach(socketId => {
                  io.to(socketId).emit('callEnded', {
                    callId: activeCall.id,
                    reason: 'El otro usuario se ha desconectado'
                  });
                });
              }
            }
          } catch (error) {
            console.error(`Error al actualizar estado de usuario ${disconnectedUserId}:`, error);
          }
        }
      }
      
      console.log('Cliente desconectado del servidor de video', socket.id);
    });
  });
};

export default configureVideoSocket;