import { awardPointsForMessage } from '../socket.js';
const SERVER_URL = process.env.SERVER_URL;
const configureGroupSocket = (io, prisma, sharedState) => {
  const { userSockets, userConnections, groupMembers } = sharedState;

  io.on('connection', (socket) => {
    console.log('Usuario conectado a mensajería grupal:', socket.id);
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
        
        console.log(`Usuario ${userId} autenticado en chat grupal (${userConnections[userId]} conexiones)`);
      } catch (error) {
        console.error('Error en autenticación de chat grupal:', error);
      }
    });

    // Unirse a un chat de grupo
    socket.on('joinGroupChat', async ({ userId, groupId }) => {
      try {
        // Verificar que el usuario sea miembro del grupo
        const memberExists = await prisma.grupo_usuarios.findFirst({
          where: {
            grupo_id: parseInt(groupId),
            usuario_id: parseInt(userId)
          }
        });

        if (!memberExists) {
          socket.emit('groupError', { 
            error: 'No eres miembro de este grupo',
            groupId
          });
          return;
        }

        // Generar el ID de la sala para el grupo
        const roomId = `group-${groupId}`;
        
        // Unir al usuario a la sala
        socket.join(roomId);
        
        // Actualizar seguimiento de miembros de grupo
        if (!groupMembers[groupId]) {
          groupMembers[groupId] = new Set();
        }
        groupMembers[groupId].add(userId);
        
        console.log(`Usuario ${userId} se unió al chat del grupo ${groupId}, sala: ${roomId}`);
        
        // Informar a los demás miembros del grupo
        socket.to(roomId).emit('userJoinedGroup', { userId, groupId });
        
        // Actualizar mensajes pendientes a entregados cuando un usuario se une
        try {
          // Buscar mensajes pendientes donde este usuario no es el remitente
          const pendingMessages = await prisma.mensaje.findMany({
            where: {
              grupo_id: parseInt(groupId),
              estado: 'pendiente',
              remitente_id: { not: parseInt(userId) }
            },
            select: {
              id: true,
              remitente_id: true
            }
          });
          
          if (pendingMessages.length > 0) {
            // Actualizar estos mensajes a "entregado"
            await prisma.mensaje.updateMany({
              where: {
                id: { in: pendingMessages.map(msg => msg.id) }
              },
              data: { estado: 'entregado' }
            });
            
            // Agrupar los mensajes por remitente para notificar
            const messagesByRemitente = {};
            pendingMessages.forEach(msg => {
              if (!messagesByRemitente[msg.remitente_id]) {
                messagesByRemitente[msg.remitente_id] = [];
              }
              messagesByRemitente[msg.remitente_id].push(msg.id);
            });
            
            // Notificar a cada remitente que sus mensajes fueron entregados
            for (const remitenteId in messagesByRemitente) {
              const senderSocketId = userSockets[remitenteId];
              if (senderSocketId) {
                io.to(senderSocketId).emit('messagesStatusUpdate', {
                  messageIds: messagesByRemitente[remitenteId],
                  status: 'entregado',
                  groupId: parseInt(groupId)
                });
              }
            }
          }
        } catch (error) {
          console.error('Error al actualizar mensajes pendientes:', error);
        }
      } catch (error) {
        console.error(`Error al unirse al grupo ${groupId}:`, error);
        socket.emit('groupError', { 
          error: 'Error al unirse al grupo',
          groupId
        });
      }
    });
    
    // Manejar la notificación de archivo enviado a grupo
    socket.on('fileGroupMessageSent', async (data) => {
      try {
        const { messageId, groupId } = data;
        
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
        
        // Crear URL completa para el archivo
        const serverUrl = `${SERVER_URL}`; // Ajusta según tu configuración
        const fileUrl = `${serverUrl}${archivo.ruta}`;
        
        const sender = message.usuarios_mensajes_remitente_idTousuarios;
        
        // Crear objeto de mensaje formateado
        const formattedMessage = {
          id: message.id,
          senderId: message.remitente_id,
          senderName: sender.nombre,
          senderImage: sender.foto_perfil,
          groupId: parseInt(groupId),
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
        
        // Obtener la sala del grupo
        const roomId = `group-${groupId}`;
        
        // Enviar mensaje a todos en la sala (excepto el remitente)
        socket.to(roomId).emit('groupMessage', formattedMessage);
        
        console.log(`Archivo enviado al grupo ${groupId} notificado vía Socket.IO`);
        
      } catch (error) {
        console.error('Error en fileGroupMessageSent via socket:', error);
      }
    });
    
    // Enviar mensaje a un grupo
    // Enviar mensaje a un grupo (versión corregida)
socket.on('sendGroupMessage', async (data) => {
  try {
    const { senderId, groupId, text, senderName, senderImage } = data;
    
    // Verificar que el usuario sea miembro del grupo
    const memberExists = await prisma.grupo_usuarios.findFirst({
      where: {
        grupo_id: parseInt(groupId),
        usuario_id: parseInt(senderId)
      }
    });

    if (!memberExists) {
      socket.emit('groupError', { 
        error: 'No puedes enviar mensajes a este grupo', 
        groupId 
      });
      return;
    }
    
    // CORRECCIÓN: Verificar directamente en la base de datos si hay miembros online
    // que no sean el remitente
    const membersOnline = await prisma.grupo_usuarios.count({
      where: {
        grupo_id: parseInt(groupId),
        usuario_id: { not: parseInt(senderId) },
        usuarios: {
          estado: 'online'
        }
      }
    });
    
    // Determinar estado inicial basado en miembros online
    const estadoInicial = membersOnline > 0 ? 'entregado' : 'pendiente';
    
    // Crear mensaje en la base de datos con el estado inicial correcto
    const message = await prisma.mensaje.create({
      data: {
        remitente_id: parseInt(senderId),
        grupo_id: parseInt(groupId),
        contenido: text,
        tipo: 'texto',
        estado: estadoInicial  // Estado correcto basado en miembros online
      },
      include: {
        usuarios_mensajes_remitente_idTousuarios: {
          select: {
            id: true,
            nombre: true,
            foto_perfil: true
          }
        }
      }
    });
    
    // Otorgar puntos al usuario por enviar mensaje de texto
    await awardPointsForMessage(senderId, 'texto');
    
    // Obtener la sala del grupo
    const roomId = `group-${groupId}`;
    
    // Crear el objeto de mensaje formateado
    const formattedMessage = {
      id: message.id,
      text: message.contenido,
      timestamp: message.created_at,
      time: message.created_at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      senderId: parseInt(senderId),
      senderName: senderName || message.usuarios_mensajes_remitente_idTousuarios.nombre,
      senderImage: senderImage || message.usuarios_mensajes_remitente_idTousuarios.foto_perfil,
      groupId: parseInt(groupId),
      status: estadoInicial,  // Usar el estado inicial correcto
      type: 'texto'
    };
    
    // Enviar mensaje a todos en la sala (excepto el remitente)
    socket.to(roomId).emit('groupMessage', formattedMessage);
    
    // Enviar confirmación al remitente (con el estado correcto)
    socket.emit('groupMessageConfirmation', formattedMessage);
    
    // Verificar miembros activos en la sala para debugging
    const activeMembers = groupMembers[groupId] ? [...groupMembers[groupId]] : [];
    console.log(`Miembros activos según groupMembers: ${activeMembers.length}`);
    console.log(`Miembros online según BD: ${membersOnline}`);
    
    // Notificar a los miembros del grupo que no están en la sala de chat
    try {
      // Obtener todos los miembros del grupo
      const groupUsers = await prisma.grupo_usuarios.findMany({
        where: { grupo_id: parseInt(groupId) },
        select: { usuario_id: true }
      });
      
      // Obtener información del grupo
      const group = await prisma.grupos.findUnique({
        where: { id: parseInt(groupId) },
        select: { nombre: true }
      });
      
      // Notificar a cada miembro que no está actualmente en la sala
      groupUsers.forEach(user => {
        // No notificar al remitente
        if (user.usuario_id === parseInt(senderId)) {
          return;
        }
        
        const memberSocketId = userSockets[user.usuario_id];
        
        // Solo notificar si el miembro tiene un socket activo y no está en la sala
        if (memberSocketId && (!groupMembers[groupId] || !groupMembers[groupId].has(user.usuario_id.toString()))) {
          io.to(memberSocketId).emit('newGroupMessageNotification', {
            senderId: parseInt(senderId),
            senderName: senderName,
            groupId: parseInt(groupId),
            groupName: group ? group.nombre : `Grupo ${groupId}`,
            preview: text.substring(0, 30) + (text.length > 30 ? '...' : '')
          });
        }
      });
    } catch (error) {
      console.error('Error al enviar notificaciones de grupo:', error);
    }
    
    console.log(`Mensaje de grupo enviado por ${senderId} al grupo ${groupId}, estado: ${estadoInicial}`);
  } catch (error) {
    console.error('Error al enviar mensaje de grupo:', error);
    socket.emit('messageError', { 
      error: 'No se pudo enviar el mensaje al grupo',
      groupId: data.groupId 
    });
  }
});
    
    // Marcar mensajes de grupo como leídos
   // Marcar mensajes de grupo como leídos
socket.on('markGroupMessagesAsRead', async (data) => {
  try {
    const { userId, groupId, messageIds } = data;
    
    // Verificar que el usuario sea miembro del grupo
    const memberExists = await prisma.grupo_usuarios.findFirst({
      where: {
        grupo_id: parseInt(groupId),
        usuario_id: parseInt(userId)
      }
    });

    if (!memberExists) {
      socket.emit('groupError', { 
        error: 'No eres miembro de este grupo',
        groupId 
      });
      return;
    }
    
    // Para cada mensaje, registrar que el usuario lo ha leído
    if (messageIds && messageIds.length > 0) {
      const processedMessageIds = [];
      
      await Promise.all(messageIds.map(async (messageId) => {
        const parsedMessageId = parseInt(messageId);
        
        // Verificar si ya existe un registro de lectura
        const existingRead = await prisma.mensaje_leido_grupos.findFirst({
          where: {
            mensaje_id: parsedMessageId,
            usuario_id: parseInt(userId)
          }
        });
        
        // Si no existe, crear el registro
        if (!existingRead) {
          await prisma.mensaje_leido_grupos.create({
            data: {
              mensaje_id: parsedMessageId,
              usuario_id: parseInt(userId),
              fecha_lectura: new Date()
            }
          });
          
          processedMessageIds.push(parsedMessageId);
        }
      }));
      
      // Si se marcaron nuevos mensajes como leídos, verificar si todos los miembros los han leído
      if (processedMessageIds.length > 0) {
        // Para cada mensaje procesado
        for (const messageId of processedMessageIds) {
          // Obtener el mensaje para saber quién es el remitente
          const message = await prisma.mensaje.findUnique({
            where: { id: messageId },
            select: { remitente_id: true, estado: true }
          });
          
          if (!message || message.estado === 'leido') continue;
          
          // Obtener todos los miembros del grupo
          const groupMembers = await prisma.grupo_usuarios.findMany({
            where: { grupo_id: parseInt(groupId) },
            select: { usuario_id: true }
          });
          
          // Obtener todos los registros de lectura para este mensaje
          const readRecords = await prisma.mensaje_leido_grupos.findMany({
            where: { mensaje_id: messageId },
            select: { usuario_id: true }
          });
          
          // Crear un conjunto de IDs de usuarios que han leído el mensaje
          const readUserIds = new Set(readRecords.map(r => r.usuario_id));
          
          // Verificar si todos los miembros (excepto el remitente) han leído el mensaje
          let allMembersRead = true;
          for (const member of groupMembers) {
            // No necesitamos verificar si el remitente leyó su propio mensaje
            if (member.usuario_id === message.remitente_id) continue;
            
            if (!readUserIds.has(member.usuario_id)) {
              allMembersRead = false;
              break;
            }
          }
          
          // Si todos han leído el mensaje, actualizarlo a 'leido'
          if (allMembersRead && message.estado !== 'leido') {
            await prisma.mensaje.update({
              where: { id: messageId },
              data: { estado: 'leido' }
            });
            
            // Notificar al remitente que su mensaje ha sido leído por todos
            const senderSocketId = userSockets[message.remitente_id];
            if (senderSocketId) {
              io.to(senderSocketId).emit('messageStatusUpdate', {
                messageId,
                status: 'leido',
                groupId: parseInt(groupId)
              });
            }
            
            // Notificar a todos los miembros del grupo sobre el cambio de estado
            // CORRECCIÓN: Definir roomId correctamente
            const roomId = `group-${groupId}`;
            io.to(roomId).emit('messageStatusUpdate', {
              messageId,
              status: 'leido', 
              groupId: parseInt(groupId)
            });
          }
        }
      }
      
      console.log(`Usuario ${userId} marcó como leídos ${messageIds.length} mensajes en el grupo ${groupId}`);
      
      // Emitir confirmación
      socket.emit('groupMessagesReadConfirmation', {
        groupId,
        messageIds
      });
    }
  } catch (error) {
    console.error('Error al marcar mensajes de grupo como leídos:', error);
    socket.emit('groupError', { 
      error: 'Error al marcar mensajes como leídos',
      groupId: data.groupId 
    });
  }
});
    
    // Abandonar un chat de grupo
    socket.on('leaveGroupChat', ({ userId, groupId }) => {
      try {
        const roomId = `group-${groupId}`;
        
        // Salir de la sala
        socket.leave(roomId);
        
        // Actualizar seguimiento de miembros
        if (groupMembers[groupId]) {
          groupMembers[groupId].delete(userId);
          if (groupMembers[groupId].size === 0) {
            delete groupMembers[groupId];
          }
        }
        
        console.log(`Usuario ${userId} abandonó el chat del grupo ${groupId}`);
        
        // Informar a los demás miembros
        socket.to(roomId).emit('userLeftGroup', { userId, groupId });
      } catch (error) {
        console.error(`Error al abandonar el grupo ${groupId}:`, error);
      }
    });
    
    // Desconexión del usuario
    socket.on('disconnect', async () => {
      try {
        // Solo procesar si el usuario se autenticó con este socket
        if (authenticatedUserId) {
          // Decrementar contador de conexiones
          userConnections[authenticatedUserId]--;
          
          console.log(`Usuario ${authenticatedUserId} desconectó un socket de chat grupal (${userConnections[authenticatedUserId]} conexiones restantes)`);
          
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
            
            // Eliminar al usuario de todos los grupos en los que estaba activo
            for (const groupId in groupMembers) {
              if (groupMembers[groupId].has(authenticatedUserId)) {
                groupMembers[groupId].delete(authenticatedUserId);
                
                // Si el grupo queda vacío, eliminarlo del seguimiento
                if (groupMembers[groupId].size === 0) {
                  delete groupMembers[groupId];
                }
                
                // Informar a los miembros del grupo
                const roomId = `group-${groupId}`;
                socket.to(roomId).emit('userLeftGroup', { 
                  userId: authenticatedUserId,
                  groupId
                });
              }
            }
            
            console.log(`Usuario ${authenticatedUserId} completamente desconectado`);
          }
        }
      } catch (error) {
        console.error('Error en desconexión de chat grupal:', error);
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
          
          // Eliminar al usuario de todos los grupos en los que estaba activo
          for (const groupId in groupMembers) {
            if (groupMembers[groupId].has(userId)) {
              groupMembers[groupId].delete(userId);
              
              // Si el grupo queda vacío, eliminarlo del seguimiento
              if (groupMembers[groupId].size === 0) {
                delete groupMembers[groupId];
              }
              
              // Informar a los miembros del grupo
              const roomId = `group-${groupId}`;
              socket.to(roomId).emit('userLeftGroup', { userId, groupId });
            }
          }
          
          // Informar a todos los usuarios conectados
          io.emit('userStatusChanged', { userId, status: 'offline' });
          
          console.log(`Usuario ${userId} cerró sesión desde chat grupal`);
        }
      } catch (error) {
        console.error('Error en logout desde chat grupal:', error);
      }
    });
  });
};

export default configureGroupSocket;