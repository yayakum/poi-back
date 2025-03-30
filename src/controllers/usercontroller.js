import { PrismaClient } from '@prisma/client';
import { sharedState } from '../socket.js'; // Importar el estado compartido
const prisma = new PrismaClient();

/**
 * Obtiene todos los usuarios
 */
export const getUsers = async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      select: {
        id: true,
        nombre: true,
        telefono: true,
        foto_perfil: true,
        descripcion: true,
        estado: true,
        created_at: true,
      }
    });

    return res.status(200).json({
      ok: true,
      usuarios
    });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error al obtener usuarios',
      error: error.message
    });
  }
};

/**
 * Obtiene un usuario por su ID
 */
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const usuario = await prisma.usuario.findUnique({
      where: {
        id: parseInt(id)
      },
      include: {
        mensajes_mensajes_remitente_idTousuarios: true,
        mensajes_mensajes_destinatario_idTousuarios: true,
        grupos: true,
        grupo_usuarios: true,
        archivos: true
      }
    });

    if (!usuario) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Usuario no encontrado'
      });
    }

    return res.status(200).json({
      ok: true,
      usuario
    });
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error al obtener usuario',
      error: error.message
    });
  }
};

/**
 * Crea un nuevo usuario
 */
export const createUser = async (req, res) => {
  try {
    const { nombre, telefono, foto_perfil, descripcion, password } = req.body;

    // Validaciones mejoradas
    if (!nombre || !telefono || !password) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El nombre, teléfono y contraseña son obligatorios'
      });
    }

    // Validar que el nombre tenga al menos 5 caracteres
    if (nombre.trim().length < 5) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El nombre debe tener al menos 5 caracteres'
      });
    }

    // Validar que el teléfono tenga exactamente 10 caracteres y sean todos dígitos
    if (telefono.length !== 10 || !/^\d+$/.test(telefono)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El número de teléfono debe tener exactamente 10 dígitos'
      });
    }

    // Validar que la contraseña tenga al menos 6 caracteres y contenga al menos un número
    if (password.length < 6) {
      return res.status(400).json({
        ok: false,
        mensaje: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    if (!/\d/.test(password)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'La contraseña debe contener al menos un número'
      });
    }

    // Verificar si el teléfono ya está registrado
    const telefonoExistente = await prisma.usuario.findUnique({
      where: {
        telefono
      }
    });

    if (telefonoExistente) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El número de teléfono ya está registrado'
      });
    }

    // Crear el usuario
    const nuevoUsuario = await prisma.usuario.create({
      data: {
        nombre,
        telefono,
        foto_perfil,
        descripcion,
        password, // En producción: hashear la contraseña antes de guardar
        estado: 'online' // Por defecto online
      }
    });

    return res.status(201).json({
      ok: true,
      mensaje: 'Usuario creado correctamente',
      usuario: nuevoUsuario
    });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error al crear usuario',
      error: error.message
    });
  }
};

/**
 * Actualiza los datos de un usuario
 */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, telefono, foto_perfil, descripcion, password } = req.body;

    // Verificar si el usuario existe
    const usuarioExistente = await prisma.usuario.findUnique({
      where: {
        id: parseInt(id)
      }
    });

    if (!usuarioExistente) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Usuario no encontrado'
      });
    }

    // Validar nombre si se proporciona
    if (nombre && nombre.trim().length < 5) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El nombre debe tener al menos 5 caracteres'
      });
    }

    // Validar teléfono si se proporciona
    if (telefono) {
      if (telefono.length !== 10 || !/^\d+$/.test(telefono)) {
        return res.status(400).json({
          ok: false,
          mensaje: 'El número de teléfono debe tener exactamente 10 dígitos'
        });
      }

      // Si se va a actualizar el teléfono, verificar que no exista ya
      if (telefono !== usuarioExistente.telefono) {
        const telefonoExistente = await prisma.usuario.findUnique({
          where: {
            telefono
          }
        });

        if (telefonoExistente) {
          return res.status(400).json({
            ok: false,
            mensaje: 'El número de teléfono ya está registrado por otro usuario'
          });
        }
      }
    }

    // Validar contraseña si se proporciona
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({
          ok: false,
          mensaje: 'La contraseña debe tener al menos 6 caracteres'
        });
      }
      
      if (!/\d/.test(password)) {
        return res.status(400).json({
          ok: false,
          mensaje: 'La contraseña debe contener al menos un número'
        });
      }
    }

    // Validar que foto_perfil sea una URL válida si se proporciona
    if (foto_perfil && !foto_perfil.startsWith('assets/')) {
      return res.status(400).json({
        ok: false,
        mensaje: 'La foto de perfil debe ser uno de los avatars predefinidos'
      });
    }

    // Actualizar el usuario
    const usuarioActualizado = await prisma.usuario.update({
      where: {
        id: parseInt(id)
      },
      data: {
        ...(nombre && { nombre }),
        ...(telefono && { telefono }),
        ...(foto_perfil !== undefined && { foto_perfil }),
        ...(descripcion !== undefined && { descripcion }),
        ...(password && { password }) // En producción: hashear la contraseña antes de guardar
      }
    });

    // Emitir evento de actualización de perfil a través del socket
    if (sharedState.io) {
      const userProfileUpdate = {
        id: parseInt(id),
        nombre: usuarioActualizado.nombre,
        foto_perfil: usuarioActualizado.foto_perfil,
        descripcion: usuarioActualizado.descripcion
      };

      // Emitir a todos los clientes conectados
      sharedState.io.of('/private').emit('userProfileUpdated', userProfileUpdate);
      sharedState.io.of('/group').emit('userProfileUpdated', userProfileUpdate);
    }

    return res.status(200).json({
      ok: true,
      mensaje: 'Usuario actualizado correctamente',
      usuario: usuarioActualizado
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error al actualizar usuario',
      error: error.message
    });
  }
};

/**
 * Actualiza el estado de un usuario (online/offline)
 */
export const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    // Validar el estado
    if (!estado || !['online', 'offline'].includes(estado)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El estado debe ser "online" u "offline"'
      });
    }

    // Verificar si el usuario existe
    const usuarioExistente = await prisma.usuario.findUnique({
      where: {
        id: parseInt(id)
      }
    });

    if (!usuarioExistente) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Usuario no encontrado'
      });
    }

    // Actualizar estado
    const usuarioActualizado = await prisma.usuario.update({
      where: {
        id: parseInt(id)
      },
      data: {
        estado
      }
    });

    return res.status(200).json({
      ok: true,
      mensaje: `Estado actualizado a ${estado}`,
      usuario: usuarioActualizado
    });
  } catch (error) {
    console.error('Error al actualizar estado de usuario:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error al actualizar estado de usuario',
      error: error.message
    });
  }
};

/**
 * Elimina un usuario
 */
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el usuario existe
    const usuarioExistente = await prisma.usuario.findUnique({
      where: {
        id: parseInt(id)
      }
    });

    if (!usuarioExistente) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Usuario no encontrado'
      });
    }

    // Eliminar el usuario
    await prisma.usuario.delete({
      where: {
        id: parseInt(id)
      }
    });

    return res.status(200).json({
      ok: true,
      mensaje: 'Usuario eliminado correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error al eliminar usuario',
      error: error.message
    });
  }
};

/**
 * login
 */
export const login = async (req, res) => {
  try {
    const { telefono, password } = req.body;

    const usuario = await prisma.usuario.findUnique({
      where: {
        telefono,
      },
    });

    if (!usuario || usuario.password !== password) {
      return res.status(401).json({
        ok: false,
        mensaje: 'Credenciales incorrectas',
      });
    }

    // Actualizar el estado del usuario a "online"
    const usuarioActualizado = await prisma.usuario.update({
      where: {
        id: usuario.id
      },
      data: {
        estado: 'online'
      }
    });

    // Inicializar contador de conexiones en el estado compartido
    sharedState.userConnections[usuario.id.toString()] = 1;

    // Notificar a todos los clientes conectados sobre el cambio de estado
    // Acceder al io global a través del sharedState
    if (sharedState.io) {
      sharedState.io.of('/private').emit('userStatusChanged', { 
        userId: usuario.id.toString(), 
        status: 'online' 
      });
    }

    return res.status(200).json({
      ok: true,
      usuario: usuarioActualizado,
    });
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error al iniciar sesión',
      error: error.message,
    });
  }
};

/**
 * Cierra la sesión de un usuario y cambia su estado a offline
 */
export const logout = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Se requiere el ID del usuario'
      });
    }

    // Verificar si el usuario existe
    const usuarioExistente = await prisma.usuario.findUnique({
      where: {
        id: parseInt(id)
      }
    });

    if (!usuarioExistente) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Usuario no encontrado'
      });
    }

    // Actualizar estado a offline
    const usuarioActualizado = await prisma.usuario.update({
      where: {
        id: parseInt(id)
      },
      data: {
        estado: 'offline'
      }
    });

    // Limpiar las conexiones y sockets del usuario
    const userId = id.toString();
    
    // Cerrar todas las conexiones socket del usuario
    if (sharedState.userSockets[userId] && sharedState.io) {
      const socketId = sharedState.userSockets[userId];
      const socket = sharedState.io.of('/private').sockets.get(socketId);
      if (socket) {
        socket.disconnect(true);
      }
    }
    
    // Limpiar datos del usuario en el estado compartido
    delete sharedState.userSockets[userId];
    delete sharedState.userConnections[userId];
    if (sharedState.userActiveChatRooms && sharedState.userActiveChatRooms[userId]) {
      delete sharedState.userActiveChatRooms[userId];
    }

    // Notificar a todos los clientes conectados sobre el cambio de estado
    if (sharedState.io) {
      sharedState.io.of('/private').emit('userStatusChanged', { 
        userId, 
        status: 'offline' 
      });
    }

    return res.status(200).json({
      ok: true,
      mensaje: 'Sesión cerrada correctamente',
      usuario: usuarioActualizado
    });
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error al cerrar sesión',
      error: error.message
    });
  }
};