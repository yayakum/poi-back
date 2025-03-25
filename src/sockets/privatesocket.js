import { awardPointsForMessage } from '../socket.js';

const configurePrivateSocket = (io, prisma, sharedState) => {
  const { userSockets, userConnections } = sharedState;
  
  // Seguimiento de qué usuarios están en qué chats
  const userActiveChatRooms = {};

  io.on('connection', (socket) => {
    console.log('Usuario conectado a mensajería privada:', socket.id);
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
          
          // Actualizar mensajes pendientes a entregados cuando el usuario se conecta
          await updatePendingMessages(userId);
        } else {
          console.log(`Usuario ${userId} ya estaba autenticado, no se actualiza estado`);
        }
        
        // Inicializar la lista de chats activos del usuario si no existe
        if (!userActiveChatRooms[userId]) {
          userActiveChatRooms[userId] = new Set();
        }
        
        // Incrementar contador de conexiones
        userConnections[userId]++;
        
        // Guardar la asociación entre el ID de usuario y el socket
        userSockets[userId] = socket.id;
        
        console.log(`Usuario ${userId} autenticado en chat privado (${userConnections[userId]} conexiones)`);
      } catch (error) {
        console.error('Error en autenticación de chat privado:', error);
      }
    });

    // Función para actualizar mensajes pendientes a entregados
    const updatePendingMessages = async (userId) => {
      try {
        // Buscar todos los mensajes pendientes dirigidos a este usuario
        const pendingMessages = await prisma.mensaje.findMany({
          where: {
            destinatario_id: parseInt(userId),
            estado: 'pendiente'
          }
        });
        
        if (pendingMessages.length > 0) {
          // Actualizar todos los mensajes pendientes a entregados
          await prisma.mensaje.updateMany({
            where: {
              destinatario_id: parseInt(userId),
              estado: 'pendiente'
            },
            data: {
              estado: 'entregado'
            }
          });
          
          console.log(`${pendingMessages.length} mensajes actualizados de pendiente a entregado para usuario ${userId}`);
          
          // Notificar a los remitentes que sus mensajes han sido entregados
          const senderIds = [...new Set(pendingMessages.map(msg => msg.remitente_id))];
          
          for (const senderId of senderIds) {
            const messagesBySender = pendingMessages.filter(msg => msg.remitente_id === senderId);
            const messageIds = messagesBySender.map(msg => msg.id);
            
            const senderSocketId = userSockets[senderId.toString()];
            if (senderSocketId) {
              io.to(senderSocketId).emit('messagesDelivered', {
                receiverId: userId,
                messageIds
              });
            }
          }
        }
      } catch (error) {
        console.error('Error al actualizar mensajes pendientes:', error);
      }
    };

    // Unirse a un chat (para mensajes privados)
    socket.on('joinChat', async ({ userId, targetId }) => {
      const roomId = [userId, targetId].sort().join('-');
      socket.join(roomId);
      
      // Registrar que el usuario está activo en este chat
      if (!userActiveChatRooms[userId]) {
        userActiveChatRooms[userId] = new Set();
      }
      userActiveChatRooms[userId].add(roomId);
      
      console.log(`Usuario ${userId} se unió al chat con ${targetId}, sala: ${roomId}`);
      
      // Marcar mensajes como leídos automáticamente al unirse al chat
      try {
        // Buscar mensajes no leídos (pendientes o entregados)
        const unreadMessages = await prisma.mensaje.findMany({
          where: {
            remitente_id: parseInt(targetId),
            destinatario_id: parseInt(userId),
            estado: { in: ['pendiente', 'entregado'] } // Incluir ambos estados
          },
          select: {
            id: true
          }
        });
        
        if (unreadMessages.length > 0) {
          const messageIds = unreadMessages.map(msg => msg.id);
          
          // Actualizar mensajes a leídos
          await prisma.mensaje.updateMany({
            where: {
              id: { in: messageIds }
            },
            data: {
              estado: 'leido'
            }
          });
          
          console.log(`${messageIds.length} mensajes marcados como leídos automáticamente para usuario ${userId} en chat con ${targetId}`);
          
          // Emitir confirmación al usuario actual
          socket.emit('messagesReadConfirmation', {
            success: true,
            messageIds
          });
          
          // Notificar al remitente que sus mensajes han sido leídos
          const senderSocketId = userSockets[targetId];
          if (senderSocketId) {
            io.to(senderSocketId).emit('messagesRead', {
              readerId: userId,
              messageIds
            });
          }
          
          // Emitir actualización a todos en la sala para que actualicen la UI
          io.to(roomId).emit('messagesStatusChanged', {
            messageIds,
            newStatus: 'leido'
          });
        }
      } catch (error) {
        console.error('Error al marcar mensajes como leídos al unirse al chat:', error);
      }
    });
    
    // Dejar un chat (para mensajes privados)
    socket.on('leaveChat', ({ userId, targetId }) => {
      const roomId = [userId, targetId].sort().join('-');
      socket.leave(roomId);
      
      // Eliminar el chat de la lista de chats activos del usuario
      if (userActiveChatRooms[userId]) {
        userActiveChatRooms[userId].delete(roomId);
      }
      
      console.log(`Usuario ${userId} salió del chat con ${targetId}, sala: ${roomId}`);
    });

    // Enviar mensaje privado
    socket.on('sendPrivateMessage', async (data) => {
      try {
        const { senderId, receiverId, text, senderName } = data;
        
        // Verificar si el destinatario está en línea
        const isReceiverOnline = userConnections[receiverId] && userConnections[receiverId] > 0;
        
        // Determinar la sala de chat
        const roomId = [senderId, receiverId].sort().join('-');
        
        // NUEVO: Verificar si el usuario está activo en este chat específico
        const isReceiverInChat = isReceiverOnline && 
                                userActiveChatRooms[receiverId] && 
                                userActiveChatRooms[receiverId].has(roomId);
        
        // Establecer el estado inicial del mensaje según la situación del receptor
        let initialStatus;
        if (!isReceiverOnline) {
          initialStatus = 'pendiente';
        } else if (isReceiverInChat) {
          initialStatus = 'leido'; // El receptor está en el chat, marcar como leído
        } else {
          initialStatus = 'entregado'; // El receptor está online pero no en el chat
        }
        
        // Crear mensaje en la base de datos
        const message = await prisma.mensaje.create({
          data: {
            remitente_id: parseInt(senderId),
            destinatario_id: parseInt(receiverId),
            contenido: text,
            tipo: 'texto',
            estado: initialStatus
          }
        });
        
        // Otorgar puntos al usuario por enviar mensaje de texto
        await awardPointsForMessage(senderId, 'texto');
        
        // Crear el objeto de mensaje formateado
        const formattedMessage = {
          id: message.id,
          senderId,
          senderName,
          receiverId,
          text,
          timestamp: message.created_at,
          status: initialStatus
        };
        
        // Enviar mensaje al receptor (si está en la sala)
        socket.to(roomId).emit('privateMessage', formattedMessage);
        
        // Enviar confirmación al remitente con el mismo formato
        socket.emit('privateMessageConfirmation', formattedMessage);
        
        // Si el receptor no está en el chat pero está online, enviar notificación
        if (isReceiverOnline && !isReceiverInChat) {
          const receiverSocketId = userSockets[receiverId];
          if (receiverSocketId) {
            io.to(receiverSocketId).emit('newMessageNotification', {
              senderId,
              senderName,
              preview: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
              messageId: message.id
            });
          }
        }
        
        console.log(`Mensaje enviado de ${senderId} a ${receiverId} con estado: ${initialStatus}`);
      } catch (error) {
        console.error('Error al enviar mensaje privado:', error);
        socket.emit('messageError', { error: 'No se pudo enviar el mensaje' });
      }
    });

    // Manejar la notificación de archivo enviado
socket.on('fileMessageSent', async (data) => {
  try {
    const { messageId, receiverId } = data;
    
    // Verificar si el mensaje existe
    const message = await prisma.mensaje.findUnique({
      where: { id: parseInt(messageId) },
      include: {
        usuarios_mensajes_remitente_idTousuarios: {
          select: {
            id: true,
            nombre: true,
            foto_perfil: true
          }
        },
        archivos: true
      }
    });
    
    if (!message) {
      console.error(`Mensaje no encontrado: ${messageId}`);
      return;
    }
    
    const archivo = message.archivos[0]; // Asumimos que hay al menos un archivo
    if (!archivo) {
      console.error(`Archivo no encontrado para el mensaje: ${messageId}`);
      return;
    }
    
    // Determinar la sala para este chat
    const roomId = [message.remitente_id, parseInt(receiverId)].sort().join('-');
    
    // NUEVO: Verificar si el usuario está activo en este chat específico
    const isReceiverOnline = userConnections[receiverId] && userConnections[receiverId] > 0;
    const isReceiverInChat = isReceiverOnline && 
                            userActiveChatRooms[receiverId] && 
                            userActiveChatRooms[receiverId].has(roomId);
    
    // Actualizar el estado del mensaje según el contexto del receptor
    let newStatus = message.estado;
    
    if (!isReceiverOnline) {
      newStatus = 'pendiente';
    } else if (isReceiverInChat) {
      newStatus = 'leido';
    } else {
      newStatus = 'entregado';
    }
    
    // Solo actualizar si el estado ha cambiado
    if (message.estado !== newStatus) {
      await prisma.mensaje.update({
        where: { id: parseInt(messageId) },
        data: { estado: newStatus }
      });
      message.estado = newStatus;
    }
    
    // Crear URL completa para el archivo
    const serverUrl = 'http://localhost:3000'; // Ajusta según tu configuración
    const fileUrl = `${serverUrl}${archivo.ruta}`;
    
    const sender = message.usuarios_mensajes_remitente_idTousuarios;
    
    // Crear objeto de mensaje formateado
    const formattedMessage = {
      id: message.id,
      senderId: message.remitente_id,
      senderName: sender.nombre,
      senderImage: sender.foto_perfil,
      receiverId: parseInt(receiverId),
      text: message.contenido,
      timestamp: message.created_at,
      time: message.created_at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: message.estado,
      type: message.tipo,
      file: {
        id: archivo.id,
        name: archivo.nombre_original,
        url: fileUrl,
        type: archivo.tipo_mime,
        size: archivo.tama_o
      }
    };
    
    // Enviar mensaje a todos en la sala (excepto el remitente)
    socket.to(roomId).emit('privateMessage', formattedMessage);
    
    // Si el receptor está en línea pero no en la sala, enviar notificación
    if (isReceiverOnline && !isReceiverInChat) {
      const receiverSocketId = userSockets[receiverId];
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('newMessageNotification', {
          senderId: message.remitente_id,
          senderName: sender.nombre,
          preview: `Archivo: ${archivo.nombre_original}`,
          messageId: message.id,
          type: message.tipo
        });
      }
    }
    
    console.log(`Archivo enviado de ${message.remitente_id} a ${receiverId} notificado vía Socket.IO con estado: ${message.estado}`);
    
  } catch (error) {
    console.error('Error en fileMessageSent via socket:', error);
  }
});

// Manejar la subida de archivos directamente vía Socket.IO
socket.on('uploadFile', async (data, callback) => {
  try {
    // Nota: Esta función es más compleja y requiere manejo de buffers de archivo
    // La implementación actual usa HTTP multipart/form-data que es más adecuado para
    // archivos grandes, así que recomendamos seguir usando ese enfoque.
    
    callback({ 
      success: false, 
      message: 'Para subir archivos usa el endpoint HTTP. Socket.IO no está optimizado para archivos grandes.'
    });
    
  } catch (error) {
    console.error('Error en uploadFile via socket:', error);
    if (callback) {
      callback({ success: false, message: 'Error interno del servidor' });
    }
  }
});
    
    // Marcar mensajes como leídos
    socket.on('markMessagesAsRead', async (data) => {
      try {
        const { userId, senderId, messageIds } = data;

        if (!messageIds || messageIds.length === 0) {
          socket.emit('messageError', { error: 'No se especificaron mensajes para marcar' });
          return;
        }

        // Actualizar los mensajes a estado "leido"
        await prisma.mensaje.updateMany({
          where: { 
            id: { in: messageIds.map(id => parseInt(id)) },
            remitente_id: parseInt(senderId),
            destinatario_id: parseInt(userId),
            estado: { not: 'leido' } // Solo actualizar si no están ya leídos
          },
          data: { 
            estado: 'leido' 
          }
        });

        socket.emit('messagesReadConfirmation', { 
          success: true, 
          messageIds 
        });
        
        // Notificar al remitente que sus mensajes han sido leídos
        const senderSocketId = userSockets[senderId];
        if (senderSocketId) {
          io.to(senderSocketId).emit('messagesRead', {
            readerId: userId,
            messageIds
          });
        }
        
        // NUEVO: Emitir actualización a todos en la sala para que actualicen la UI
        const roomId = [userId, senderId].sort().join('-');
        io.to(roomId).emit('messagesStatusChanged', {
          messageIds,
          newStatus: 'leido'
        });
        
        console.log(`Usuario ${userId} marcó como leídos ${messageIds.length} mensajes de ${senderId}`);
      } catch (error) {
        console.error('Error al marcar mensajes como leídos:', error);
        socket.emit('messageError', { error: 'Error al marcar mensajes como leídos' });
      }
    });
    
    // Desconexión del usuario
    socket.on('disconnect', async () => {
      try {
        // Solo procesar si el usuario se autenticó con este socket
        if (authenticatedUserId) {
          // Limpiar la lista de chats activos del usuario
          if (userActiveChatRooms[authenticatedUserId]) {
            userActiveChatRooms[authenticatedUserId].clear();
          }
          
          // Decrementar contador de conexiones
          userConnections[authenticatedUserId]--;
          
          console.log(`Usuario ${authenticatedUserId} desconectó un socket de chat privado (${userConnections[authenticatedUserId]} conexiones restantes)`);
          
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
            delete userActiveChatRooms[authenticatedUserId];
            
            // Informar a todos los usuarios conectados
            io.emit('userStatusChanged', { userId: authenticatedUserId, status: 'offline' });
            
            console.log(`Usuario ${authenticatedUserId} completamente desconectado`);
          }
        }
      } catch (error) {
        console.error('Error en desconexión de chat privado:', error);
      }
    });
    
    // Manejo explícito de cierre de sesión
    socket.on('logout', async (userId) => {
      try {
        if (userId) {
          // Limpiar la lista de chats activos del usuario
          if (userActiveChatRooms[userId]) {
            userActiveChatRooms[userId].clear();
            delete userActiveChatRooms[userId];
          }
          
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
          
          console.log(`Usuario ${userId} cerró sesión desde chat privado`);
        }
      } catch (error) {
        console.error('Error en logout desde chat privado:', error);
      }
    });
  });
};

export default configurePrivateSocket;