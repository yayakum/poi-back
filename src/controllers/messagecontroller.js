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
        url: `http://localhost:3000${file.ruta}`, // URL completa
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

// Modificación al método getGroupMessages en messagecontroller.js

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
        archivos: true // Incluir archivos adjuntos
      }
    });

    // Transformar los datos para el cliente
    const formattedMessages = messages.map(message => {
      const sender = message.usuarios_mensajes_remitente_idTousuarios;
      
      // Construir la URL base para archivos
      const serverUrl = 'http://localhost:3000'; // En producción esto podría venir de configuración
      
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
        } : null
      };
    });

    res.json({ messages: formattedMessages });
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

// Agregar a messagecontroller.js

// Obtener cantidad de mensajes no leídos para un usuario
export const getUnreadMessageCounts = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    // Verificar que el usuario exista
    const user = await prisma.usuario.findUnique({ 
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Obtener mensajes no leídos (entregados pero no leídos) para mensajes directos
    const unreadDirectMessages = await prisma.mensaje.groupBy({
      by: ['remitente_id'],
      where: {
        destinatario_id: userId,
        estado: 'entregado' // Solo mensajes entregados pero no leídos
      },
      _count: {
        id: true
      }
    });

    // Obtener mensajes pendientes (no entregados) para mensajes directos
    const pendingDirectMessages = await prisma.mensaje.groupBy({
      by: ['destinatario_id'],
      where: {
        remitente_id: userId,
        estado: 'pendiente' // Mensajes enviados pero aún no entregados
      },
      _count: {
        id: true
      }
    });

    // Obtener mensajes no leídos para grupos
    const unreadGroupMessages = await prisma.mensaje.groupBy({
      by: ['grupo_id'],
      where: {
        grupo_id: { not: null },
        grupos_mensajes_grupo_idTogrupos: {
          grupo_usuarios: {
            some: {
              usuario_id: userId
            }
          }
        },
        // No contar mensajes enviados por el propio usuario
        remitente_id: { not: userId },
        // Condición para que el mensaje no haya sido leído por este usuario
        mensaje_leido_grupos: {
          none: {
            usuario_id: userId
          }
        }
      },
      _count: {
        id: true
      }
    });

    // Formatear resultados
    const unreadCounts = {};
    
    // Formatear mensajes directos no leídos
    unreadDirectMessages.forEach(item => {
      unreadCounts[item.remitente_id] = item._count.id;
    });
    
    // Formatear mensajes pendientes (con prefijo "p" para pendientes)
    pendingDirectMessages.forEach(item => {
      unreadCounts[`p${item.destinatario_id}`] = item._count.id;
    });
    
    // Formatear mensajes de grupo no leídos (con prefijo "g" para grupos)
    unreadGroupMessages.forEach(item => {
      if (item.grupo_id) {
        unreadCounts[`g${item.grupo_id}`] = item._count.id;
      }
    });

    res.json({ unreadCounts });
  } catch (error) {
    console.error('Error al obtener mensajes no leídos:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Enviar mensaje a un grupo (esta función es un respaldo para cuando Socket.IO no está disponible)
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

    // Crear mensaje en la base de datos
    const message = await prisma.mensaje.create({
      data: {
        remitente_id: parseInt(remitente_id),
        grupo_id: parseInt(grupo_id),
        contenido,
        tipo: tipoMensaje,
        estado: 'entregado'  // En mensajes de grupo, marcamos como entregado inmediatamente
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
      status: message.estado
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

// Marcar mensajes de grupo como leídos
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

    // Para cada mensaje, registrar que el usuario lo ha leído
    await Promise.all(messageIds.map(async (messageId) => {
      // Verificar si ya existe un registro de lectura
      const existingRead = await prisma.mensaje_leido_grupos.findFirst({
        where: {
          mensaje_id: parseInt(messageId),
          usuario_id: parseInt(userId)
        }
      });
      
      // Si no existe, crear el registro
      if (!existingRead) {
        await prisma.mensaje_leido_grupos.create({
          data: {
            mensaje_id: parseInt(messageId),
            usuario_id: parseInt(userId),
            fecha_lectura: new Date()
          }
        });
      }
    }));

    res.json({ 
      success: true, 
      message: 'Mensajes de grupo marcados como leídos', 
      messageIds,
      groupId
    });
  } catch (error) {
    console.error('Error al marcar mensajes de grupo como leídos:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};