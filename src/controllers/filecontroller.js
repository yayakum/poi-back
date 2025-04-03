// filecontroller.js
import prisma from '../lib/prisma.js';
import path from 'path';
import fs from 'fs';



// Función para determinar el tipo de mensaje basado en MIME type
const getMessageTypeFromMime = (mimeType) => {
  // Tipos de imagen
  if (mimeType.startsWith('image/')) return 'imagen';
  
  // Tipos de video
  if (mimeType.startsWith('video/')) return 'video';
  
  // Tipos específicos de documento
  if (mimeType === 'application/pdf') return 'archivo';
  if (mimeType === 'text/plain') return 'archivo';
  if (mimeType === 'application/msword') return 'archivo';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'archivo';
  if (mimeType === 'application/vnd.ms-excel') return 'archivo';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'archivo';
  if (mimeType === 'application/vnd.ms-powerpoint') return 'archivo';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return 'archivo';
  
  // Para cualquier otro tipo, usar 'archivo'
  return 'archivo';
};

// Subir archivo y crear mensaje asociado
export const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se ha enviado ningún archivo' });
    }

    const { remitente_id, destinatario_id, grupo_id } = req.body;

    // Validación básica
    if (!remitente_id || (!destinatario_id && !grupo_id)) {
      // Si se subió un archivo pero hay error de validación, eliminarlo
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Datos incompletos' });
    }

    // Determinar el tipo de mensaje basado en el tipo MIME
    const tipoMensaje = getMessageTypeFromMime(req.file.mimetype);

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
    const mensaje = await prisma.mensaje.create({
      data: {
        remitente_id: parseInt(remitente_id),
        destinatario_id: destinatario_id ? parseInt(destinatario_id) : null,
        grupo_id: grupo_id ? parseInt(grupo_id) : null,
        contenido: req.file.originalname, // Usar el nombre del archivo como contenido
        tipo: tipoMensaje, // Tipo basado en MIME
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

    // Crear registro del archivo en la base de datos
    const archivo = await prisma.archivos.create({
      data: {
        mensaje_id: mensaje.id,
        usuario_id: parseInt(remitente_id),
        nombre_original: req.file.originalname,
        ruta: `/uploads/${req.file.filename}`, // Ruta para acceder al archivo
        tipo_mime: req.file.mimetype,
        tama_o: req.file.size // Tamaño en bytes
      }
    });

    const sender = mensaje.usuarios_mensajes_remitente_idTousuarios;
    const formattedMessage = {
      id: mensaje.id,
      text: mensaje.contenido,
      timestamp: mensaje.created_at,
      senderId: sender.id,
      senderName: sender.nombre,
      senderImage: sender.foto_perfil,
      status: mensaje.estado,
      type: tipoMensaje,
      file: {
        id: archivo.id,
        name: archivo.nombre_original,
        url: archivo.ruta,
        type: archivo.tipo_mime,
        size: archivo.tama_o
      }
    };

    res.status(201).json({ 
      message: 'Archivo subido y mensaje creado', 
      data: formattedMessage 
    });
  } catch (error) {
    console.error('Error al subir archivo:', error);
    
    // Si hubo un error y se subió un archivo, eliminarlo
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Nueva función para subir archivos para grupos
export const uploadGroupFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se ha enviado ningún archivo' });
    }

    const { remitente_id, grupo_id } = req.body;

    // Validación básica
    if (!remitente_id || !grupo_id) {
      // Si se subió un archivo pero hay error de validación, eliminarlo
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Datos incompletos' });
    }

    // Verificar que el usuario sea miembro del grupo
    const memberExists = await prisma.grupo_usuarios.findFirst({
      where: {
        grupo_id: parseInt(grupo_id),
        usuario_id: parseInt(remitente_id)
      }
    });

    if (!memberExists) {
      // Si el usuario no es miembro del grupo, eliminar el archivo
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ message: 'No eres miembro de este grupo' });
    }

    // Determinar el tipo de mensaje basado en el tipo MIME
    const tipoMensaje = getMessageTypeFromMime(req.file.mimetype);

    // En mensajes de grupo, el estado es siempre "entregado"
    const estadoInicial = 'entregado';

    // Crear mensaje en la base de datos
    const mensaje = await prisma.mensaje.create({
      data: {
        remitente_id: parseInt(remitente_id),
        grupo_id: parseInt(grupo_id),
        contenido: req.file.originalname, // Usar el nombre del archivo como contenido
        tipo: tipoMensaje, // Tipo basado en MIME
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

    // Crear registro del archivo en la base de datos
    const archivo = await prisma.archivos.create({
      data: {
        mensaje_id: mensaje.id,
        usuario_id: parseInt(remitente_id),
        nombre_original: req.file.originalname,
        ruta: `/uploads/${req.file.filename}`, // Ruta para acceder al archivo
        tipo_mime: req.file.mimetype,
        tama_o: req.file.size // Tamaño en bytes
      }
    });

    const sender = mensaje.usuarios_mensajes_remitente_idTousuarios;
    const formattedMessage = {
      id: mensaje.id,
      text: mensaje.contenido,
      timestamp: mensaje.created_at,
      senderId: sender.id,
      senderName: sender.nombre,
      senderImage: sender.foto_perfil,
      groupId: parseInt(grupo_id),
      status: mensaje.estado,
      type: tipoMensaje,
      file: {
        id: archivo.id,
        name: archivo.nombre_original,
        url: archivo.ruta,
        type: archivo.tipo_mime,
        size: archivo.tama_o
      }
    };

    res.status(201).json({ 
      message: 'Archivo subido y mensaje creado para el grupo', 
      data: formattedMessage 
    });
  } catch (error) {
    console.error('Error al subir archivo al grupo:', error);
    
    // Si hubo un error y se subió un archivo, eliminarlo
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};