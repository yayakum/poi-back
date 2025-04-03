import { PrismaClient } from '@prisma/client';
const SERVER_URL = process.env.SERVER_URL;
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

// Obtener mensajes entre dos usuarios
export const getUserMessages = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const targetId = parseInt(req.params.targetId);

    // Verificar que ambos usuarios existan
    const [user, target] = await Promise.all([
      prisma.usuario.findUnique({ where: { id: userId } }),
      prisma.usuario.findUnique({ where: { id: targetId } })
    ]);

    if (!user || !target) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Obtener mensajes entre usuarios (en ambas direcciones)
    const messages = await prisma.mensaje.findMany({
      where: {
        OR: [
          { remitente_id: userId, destinatario_id: targetId },
          { remitente_id: targetId, destinatario_id: userId }
        ]
      },
      orderBy: {
        created_at: 'asc'  // Ordenar cronológicamente
      },
      include: {
        usuarios_mensajes_remitente_idTousuarios: {
          select: {
            id: true,
            nombre: true,
            foto_perfil: true
          }
        },
        archivos: true  // Incluir archivos adjuntos
      }
    });

   
  // Y en la parte donde se transforman los datos, asegúrate de que se incluya correctamente el tipo y los archivos:
  const formattedMessages = messages.map(message => {
    const sender = message.usuarios_mensajes_remitente_idTousuarios;
    return {
      id: message.id,
      text: message.contenido,
      senderId: message.remitente_id,
      receiverId: message.destinatario_id,
      sent: message.remitente_id === userId,  // true si el usuario actual es el remitente
      time: message.created_at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: message.created_at,
      sender: sender.nombre,
      senderName: sender.nombre,
      senderImage: sender.foto_perfil,
      status: message.estado,  // Incluir el estado del mensaje
      type: message.tipo,      // Incluir el tipo de mensaje
      attachments: message.archivos.map(file => ({
        id: file.id,
        name: file.nombre_original,
        url: `${SERVER_URL}${file.ruta}`, // URL completa
        type: file.tipo_mime,
        size: file.tama_o
      }))
    };
  });

    // Si el usuario actual es el destinatario, marcar los mensajes no leídos como leídos
    if (messages.length > 0) {
      // Obtener los IDs de mensajes que necesitan ser actualizados (recibidos pero no leídos)
      const unreadMessageIds = messages
        .filter(msg => msg.remitente_id === targetId && msg.destinatario_id === userId && msg.estado !== 'leido')
        .map(msg => msg.id);

      if (unreadMessageIds.length > 0) {
        // Actualizar estado a leído
        await prisma.mensaje.updateMany({
          where: { id: { in: unreadMessageIds } },
          data: { estado: 'leido' }
        });

        // La respuesta ya está creada, así que los nuevos estados se reflejarán en la próxima solicitud
        // Sin embargo, notificamos al frontend que los mensajes están leídos para que pueda actualizar UI
        res.set('X-Messages-Read', JSON.stringify(unreadMessageIds));
      }
    }

    res.json({ messages: formattedMessages });
  } catch (error) {
    console.error('Error al obtener mensajes:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Función modificada para obtener mensajes de grupo con estado correcto
export const getGroupMessages = async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);
    const userId = parseInt(req.query.userId); // ID del usuario que realiza la solicitud

    // Verificar que el grupo exista
    const group = await prisma.grupos.findUnique({ where: { id: groupId } });
    if (!group) {
      return res.status(404).json({ message: 'Grupo no encontrado' });
    }

    // Obtener mensajes del grupo
    const messages = await prisma.mensaje.findMany({
      where: { grupo_id: groupId },
      orderBy: { created_at: 'asc' },
      include: {
        usuarios_mensajes_remitente_idTousuarios: {
          select: {
            id: true,
            nombre: true,
            foto_perfil: true
          }
        },
        archivos: true, // Incluir archivos adjuntos
        mensaje_leido_grupos: true // Incluir registros de lectura para análisis
      }
    });

    // Transformar los datos para el cliente
    const formattedMessages = messages.map(message => {
      const sender = message.usuarios_mensajes_remitente_idTousuarios;
      
      // Construir la URL base para archivos
      const serverUrl = `${SERVER_URL}`; // En producción esto podría venir de configuración
      
      return {
        id: message.id,
        text: message.contenido,
        time: message.created_at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: message.created_at,
        sender: sender.nombre,
        senderName: sender.nombre,
        senderId: sender.id,
        senderImage: sender.foto_perfil,
        status: message.estado,
        type: message.tipo || 'texto', // Asegurarse de que haya un tipo
        file: message.archivos && message.archivos.length > 0 ? {
          id: message.archivos[0].id,
          name: message.archivos[0].nombre_original,
          url: `${serverUrl}${message.archivos[0].ruta}`, // URL completa
          type: message.archivos[0].tipo_mime,
          size: message.archivos[0].tama_o
        } : null,
        readBy: message.mensaje_leido_grupos.map(record => record.usuario_id) // Añadir quién ha leído
      };
    });

    // Recolectar IDs de mensajes que el usuario no ha leído
    const unreadMessageIds = messages
      .filter(message => 
        message.remitente_id !== userId && 
        !message.mensaje_leido_grupos.some(record => record.usuario_id === userId)
      )
      .map(message => message.id);

    res.json({ 
      messages: formattedMessages,
      unreadMessageIds // Enviar al cliente para que pueda marcarlos como leídos
    });
  } catch (error) {
    console.error('Error al obtener mensajes del grupo:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Enviar un mensaje (esta ruta es un respaldo para cuando Socket.IO no está disponible)
export const sendMessage = async (req, res) => {
  try {
    const { remitente_id, destinatario_id, grupo_id, contenido, tipo } = req.body;
    const tipoMensaje = tipo || 'texto';

    // Validación básica
    if (!remitente_id || (!destinatario_id && !grupo_id) || !contenido) {
      return res.status(400).json({ message: 'Datos incompletos' });
    }

    // Comprobar si el destinatario está online para definir el estado inicial
    let estadoInicial = 'pendiente';
    
    if (destinatario_id) {
      const destinatario = await prisma.usuario.findUnique({
        where: { id: parseInt(destinatario_id) },
        select: { estado: true }
      });
      
      if (destinatario && destinatario.estado === 'online') {
        estadoInicial = 'entregado';
      }
    }

    // Crear mensaje en la base de datos
    const message = await prisma.mensaje.create({
      data: {
        remitente_id: parseInt(remitente_id),
        destinatario_id: destinatario_id ? parseInt(destinatario_id) : null,
        grupo_id: grupo_id ? parseInt(grupo_id) : null,
        contenido,
        tipo: tipoMensaje,
        estado: estadoInicial
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
    if (tipoMensaje === 'texto') {
      await awardPointsForMessage(remitente_id, tipoMensaje);
    }

    const sender = message.usuarios_mensajes_remitente_idTousuarios;
    const formattedMessage = {
      id: message.id,
      text: message.contenido,
      timestamp: message.created_at,
      senderId: sender.id,
      senderName: sender.nombre,
      senderImage: sender.foto_perfil,
      status: message.estado
    };

    // Aquí podrías emitir el mensaje a través de Socket.IO si tienes acceso a la instancia
    // (esto requeriría una refactorización adicional para hacer que io sea accesible aquí)

    res.status(201).json({ 
      message: 'Mensaje enviado', 
      data: formattedMessage 
    });
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Eliminar un mensaje
export const deleteMessage = async (req, res) => {
  try {
    const messageId = parseInt(req.params.id);
    const userId = parseInt(req.query.userId); // El usuario que intenta eliminar

    // Verificar que el mensaje exista y pertenezca al usuario
    const message = await prisma.mensaje.findUnique({
      where: { id: messageId },
      select: { id: true, remitente_id: true }
    });

    if (!message) {
      return res.status(404).json({ message: 'Mensaje no encontrado' });
    }

    if (message.remitente_id !== userId) {
      return res.status(403).json({ message: 'No tienes permiso para eliminar este mensaje' });
    }

    // Eliminar el mensaje
    await prisma.mensaje.delete({ where: { id: messageId } });

    res.json({ message: 'Mensaje eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar mensaje:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Marcar mensajes como leídos explícitamente (útil para actualizar desde el cliente)
export const markMessagesAsRead = async (req, res) => {
  try {
    const { userId, senderId, messageIds } = req.body;

    if (!messageIds || messageIds.length === 0) {
      return res.status(400).json({ message: 'No se especificaron mensajes para marcar' });
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

    res.json({ 
      success: true, 
      message: 'Mensajes marcados como leídos', 
      messageIds 
    });
  } catch (error) {
    console.error('Error al marcar mensajes como leídos:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Función modificada para enviar mensajes a grupo con estado inicial correcto
export const sendGroupMessage = async (req, res) => {
  try {
    const { remitente_id, grupo_id, contenido, tipo } = req.body;
    const tipoMensaje = tipo || 'texto';

    // Validación básica
    if (!remitente_id || !grupo_id || !contenido) {
      return res.status(400).json({ message: 'Datos incompletos' });
    }

    // Verificar que el usuario sea miembro del grupo
    const esMiembro = await prisma.grupo_usuarios.findFirst({
      where: {
        grupo_id: parseInt(grupo_id),
        usuario_id: parseInt(remitente_id)
      }
    });

    if (!esMiembro) {
      return res.status(403).json({ message: 'No eres miembro de este grupo' });
    }

    // Verificar si hay miembros online en el grupo (diferentes al remitente)
    const membersOnline = await prisma.grupo_usuarios.count({
      where: {
        grupo_id: parseInt(grupo_id),
        usuario_id: { not: parseInt(remitente_id) },
        usuarios: {
          estado: 'online'
        }
      }
    });

    // Si hay miembros online, marcar como entregado, de lo contrario como pendiente
    const initialStatus = membersOnline > 0 ? 'entregado' : 'pendiente';

    // Crear mensaje en la base de datos
    const message = await prisma.mensaje.create({
      data: {
        remitente_id: parseInt(remitente_id),
        grupo_id: parseInt(grupo_id),
        contenido,
        tipo: tipoMensaje,
        estado: initialStatus
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
    if (tipoMensaje === 'texto') {
      await awardPointsForMessage(remitente_id, tipoMensaje);
    }

    const sender = message.usuarios_mensajes_remitente_idTousuarios;
    const formattedMessage = {
      id: message.id,
      text: message.contenido,
      timestamp: message.created_at,
      time: message.created_at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      senderId: sender.id,
      senderName: sender.nombre,
      senderImage: sender.foto_perfil,
      groupId: parseInt(grupo_id),
      status: initialStatus
    };

    // Aquí podrías emitir el mensaje a través de Socket.IO si tienes acceso a la instancia
    // (esto requeriría una refactorización adicional para hacer que io sea accesible aquí)

    res.status(201).json({ 
      message: 'Mensaje enviado al grupo', 
      data: formattedMessage 
    });
  } catch (error) {
    console.error('Error al enviar mensaje al grupo:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Función modificada para marcar mensajes de grupo como leídos correctamente
// Modificación para markGroupMessagesAsRead en messagecontroller.js
export const markGroupMessagesAsRead = async (req, res) => {
  try {
    const { userId, groupId, messageIds } = req.body;

    if (!messageIds || messageIds.length === 0) {
      return res.status(400).json({ message: 'No se especificaron mensajes para marcar' });
    }

    // Verificar que el usuario sea miembro del grupo
    const esMiembro = await prisma.grupo_usuarios.findFirst({
      where: {
        grupo_id: parseInt(groupId),
        usuario_id: parseInt(userId)
      }
    });

    if (!esMiembro) {
      return res.status(403).json({ message: 'No eres miembro de este grupo' });
    }

    // Lista para mensajes que necesitan actualización
    const processedMessageIds = [];
    const updatedToReadMessages = [];

    // Para cada mensaje, registrar que el usuario lo ha leído
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

    // Para cada mensaje procesado, verificar si todos los miembros lo han leído
    if (processedMessageIds.length > 0) {
      // Obtener todos los miembros del grupo
      const groupMembers = await prisma.grupo_usuarios.findMany({
        where: { grupo_id: parseInt(groupId) },
        select: { usuario_id: true }
      });
      
      // Procesar cada mensaje
      for (const messageId of processedMessageIds) {
        // Obtener el mensaje para saber quién es el remitente
        const message = await prisma.mensaje.findUnique({
          where: { id: messageId },
          select: { remitente_id: true, estado: true }
        });
        
        if (!message || message.estado === 'leido') continue;
        
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
          
          updatedToReadMessages.push(messageId);
          
          // NUEVO: Notificar a través de Socket.IO si está disponible
          // Importa el estado compartido de socket.js
          try {
            const { sharedState } = await import('../socket.js');
            if (sharedState && sharedState.io) {
              // Notificar al remitente
              const senderSocketId = sharedState.userSockets[message.remitente_id];
              if (senderSocketId) {
                sharedState.io.of('/group').to(senderSocketId).emit('messageStatusUpdate', {
                  messageId,
                  status: 'leido',
                  groupId: parseInt(groupId)
                });
              }
              
              // Notificar a todos en el grupo
              const roomId = `group-${groupId}`;
              sharedState.io.of('/group').to(roomId).emit('messageStatusUpdate', {
                messageId,
                status: 'leido',
                groupId: parseInt(groupId)
              });
            }
          } catch (socketError) {
            console.error('Error al notificar por Socket.IO:', socketError);
            // No fallamos la petición si hay error en la notificación
          }
        }
      }
    }

    res.json({ 
      success: true, 
      message: 'Mensajes de grupo marcados como leídos', 
      messageIds,
      updatedToReadMessages,
      groupId
    });
  } catch (error) {
    console.error('Error al marcar mensajes de grupo como leídos:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Reemplaza la función getUnreadMessagesStatus en messagecontroller.js con esta versión

// Nueva función para obtener el estado de mensajes no leídos y enviar notificaciones Socket.IO
export const getUnreadMessagesStatus = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    // Verificar que el usuario exista
    const user = await prisma.usuario.findUnique({ 
      where: { id: userId } 
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Buscar mensajes no leídos (estado 'pendiente' o 'entregado') donde el usuario es el destinatario
    const unreadPrivateMessages = await prisma.mensaje.findMany({
      where: {
        destinatario_id: userId,
        estado: { in: ['pendiente', 'entregado'] },
        grupo_id: null // Solo mensajes privados
      },
      select: {
        remitente_id: true
      }
    });

    // Obtener IDs únicos de remitentes con mensajes no leídos
    const uniqueSenderIds = [...new Set(unreadPrivateMessages.map(msg => msg.remitente_id))];
    
    // Formatear la respuesta para incluir información de mensajes no leídos
    const unreadStatus = uniqueSenderIds.map(senderId => ({
      senderId,
      hasUnread: true
    }));

    // Obtener grupos con mensajes no leídos
    const groupsWithUnreadMessages = await prisma.mensaje.findMany({
      where: {
        grupo_id: { not: null },
        remitente_id: { not: userId },
        mensaje_leido_grupos: {
          none: {
            usuario_id: userId
          }
        }
      },
      select: {
        grupo_id: true
      },
      distinct: ['grupo_id']
    });

    // Agregar información de grupos con mensajes no leídos
    const unreadGroupsStatus = groupsWithUnreadMessages.map(item => ({
      groupId: item.grupo_id,
      hasUnread: true
    }));

    // Enviar notificación de mensajes no leídos a través de Socket.IO
    try {
      // Importar el estado compartido de socket.js
      const { sharedState } = await import('../socket.js');
      
      if (sharedState && sharedState.userSockets && sharedState.userSockets[userId]) {
        const socketId = sharedState.userSockets[userId];
        
        // Enviar actualización para mensajes privados no leídos
        if (unreadStatus.length > 0) {
          unreadStatus.forEach(item => {
            sharedState.io.of('/private').to(socketId).emit('unreadMessagesUpdate', {
              type: 'private',
              senderId: item.senderId,
              hasUnread: true
            });
          });
        }
        
        // Enviar actualización para mensajes de grupo no leídos
        if (unreadGroupsStatus.length > 0) {
          unreadGroupsStatus.forEach(item => {
            sharedState.io.of('/private').to(socketId).emit('unreadMessagesUpdate', {
              type: 'group',
              groupId: item.groupId,
              hasUnread: true
            });
          });
        }
        
        console.log(`Notificaciones de mensajes no leídos enviadas a usuario ${userId} vía Socket.IO`);
      }
    } catch (socketError) {
      console.error('Error al enviar notificaciones por Socket.IO:', socketError);
      // No fallamos la petición si hay error en la notificación
    }

    res.json({ 
      unreadStatus,
      unreadGroupsStatus,
      timestamp: new Date().toISOString() // Añadir timestamp para debug
    });
  } catch (error) {
    console.error('Error al obtener estado de mensajes no leídos:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};