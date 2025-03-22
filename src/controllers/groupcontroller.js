import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Obtiene todos los grupos
 */
export const getGroups = async (req, res) => {
  try {
    const grupos = await prisma.grupos.findMany({
      include: {
        usuarios: true,
        grupo_usuarios: {
          include: {
            usuarios: true
          }
        }
      }
    });

    return res.status(200).json({
      ok: true,
      grupos
    });
  } catch (error) {
    console.error('Error al obtener grupos:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error al obtener grupos',
      error: error.message
    });
  }
};

/**
 * Obtiene un grupo por su ID
 */
export const getGroupById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const grupo = await prisma.grupos.findUnique({
      where: {
        id: parseInt(id)
      },
      include: {
        usuarios: true,
        grupo_usuarios: {
          include: {
            usuarios: true
          }
        },
        mensajes: {
          include: {
            usuarios_mensajes_remitente_idTousuarios: true,
            archivos: true
          },
          orderBy: {
            created_at: 'asc'
          }
        }
      }
    });

    if (!grupo) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Grupo no encontrado'
      });
    }

    return res.status(200).json({
      ok: true,
      grupo
    });
  } catch (error) {
    console.error('Error al obtener grupo:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error al obtener grupo',
      error: error.message
    });
  }
};

/**
 * Crea un nuevo grupo
 */
export const createGroup = async (req, res) => {
  try {
    const { nombre, descripcion, creador_id, participantes } = req.body;

    // Validaciones
    if (!nombre || !creador_id || !participantes || !Array.isArray(participantes)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El nombre, creador y participantes son obligatorios'
      });
    }

    // Validar que el nombre tenga al menos 3 caracteres
    if (nombre.trim().length < 3) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El nombre debe tener al menos 3 caracteres'
      });
    }

    // Verificar que el creador exista
    const creadorExiste = await prisma.usuario.findUnique({
      where: {
        id: parseInt(creador_id)
      }
    });

    if (!creadorExiste) {
      return res.status(404).json({
        ok: false,
        mensaje: 'El usuario creador no existe'
      });
    }

    // Verificar que haya al menos un participante además del creador
    if (participantes.length === 0) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Debe haber al menos un participante en el grupo'
      });
    }

    // Crear el grupo
    const nuevoGrupo = await prisma.grupos.create({
      data: {
        nombre,
        descripcion,
        creador_id: parseInt(creador_id),
        // Asegurarnos de que el formato de la foto es el correcto si existe
        foto_grupo: null, // Por defecto null, podría ser actualizado después
      }
    });

    // Añadir al creador como participante si no está en la lista
    const todosLosParticipantes = participantes.includes(creador_id) 
      ? participantes 
      : [...participantes, creador_id];

    // Añadir los participantes al grupo
    await Promise.all(
      todosLosParticipantes.map(async (usuario_id) => {
        return prisma.grupo_usuarios.create({
          data: {
            grupo_id: nuevoGrupo.id,
            usuario_id: parseInt(usuario_id)
          }
        });
      })
    );

    // Obtener el grupo recién creado con todos sus participantes
    const grupoCompleto = await prisma.grupos.findUnique({
      where: {
        id: nuevoGrupo.id
      },
      include: {
        usuarios: true,
        grupo_usuarios: {
          include: {
            usuarios: true
          }
        }
      }
    });

    return res.status(201).json({
      ok: true,
      mensaje: 'Grupo creado correctamente',
      grupo: grupoCompleto
    });
  } catch (error) {
    console.error('Error al crear grupo:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error al crear grupo',
      error: error.message
    });
  }
};

/**
 * Actualiza un grupo
 */
export const updateGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, foto_grupo } = req.body;

    // Verificar si el grupo existe
    const grupoExistente = await prisma.grupos.findUnique({
      where: {
        id: parseInt(id)
      }
    });

    if (!grupoExistente) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Grupo no encontrado'
      });
    }

    // Validar nombre si se proporciona
    if (nombre && nombre.trim().length < 3) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El nombre debe tener al menos 3 caracteres'
      });
    }

    // Actualizar el grupo
    const grupoActualizado = await prisma.grupos.update({
      where: {
        id: parseInt(id)
      },
      data: {
        ...(nombre && { nombre }),
        ...(descripcion !== undefined && { descripcion }),
        ...(foto_grupo !== undefined && { foto_grupo })
      }
    });

    return res.status(200).json({
      ok: true,
      mensaje: 'Grupo actualizado correctamente',
      grupo: grupoActualizado
    });
  } catch (error) {
    console.error('Error al actualizar grupo:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error al actualizar grupo',
      error: error.message
    });
  }
};

/**
 * Elimina un grupo
 */
export const deleteGroup = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el grupo existe
    const grupoExistente = await prisma.grupos.findUnique({
      where: {
        id: parseInt(id)
      }
    });

    if (!grupoExistente) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Grupo no encontrado'
      });
    }

    // Eliminar el grupo
    await prisma.grupos.delete({
      where: {
        id: parseInt(id)
      }
    });

    return res.status(200).json({
      ok: true,
      mensaje: 'Grupo eliminado correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar grupo:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error al eliminar grupo',
      error: error.message
    });
  }
};

/**
 * Añadir un usuario a un grupo
 */
export const addUserToGroup = async (req, res) => {
  try {
    const { grupo_id, usuario_id } = req.body;

    // Verificar si el grupo existe
    const grupoExistente = await prisma.grupos.findUnique({
      where: {
        id: parseInt(grupo_id)
      }
    });

    if (!grupoExistente) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Grupo no encontrado'
      });
    }

    // Verificar si el usuario existe
    const usuarioExistente = await prisma.usuario.findUnique({
      where: {
        id: parseInt(usuario_id)
      }
    });

    if (!usuarioExistente) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Usuario no encontrado'
      });
    }

    // Verificar si el usuario ya está en el grupo
    const usuarioEnGrupo = await prisma.grupo_usuarios.findFirst({
      where: {
        grupo_id: parseInt(grupo_id),
        usuario_id: parseInt(usuario_id)
      }
    });

    if (usuarioEnGrupo) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El usuario ya es miembro del grupo'
      });
    }

    // Añadir el usuario al grupo
    const nuevoMiembro = await prisma.grupo_usuarios.create({
      data: {
        grupo_id: parseInt(grupo_id),
        usuario_id: parseInt(usuario_id)
      }
    });

    return res.status(201).json({
      ok: true,
      mensaje: 'Usuario añadido al grupo correctamente',
      miembro: nuevoMiembro
    });
  } catch (error) {
    console.error('Error al añadir usuario al grupo:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error al añadir usuario al grupo',
      error: error.message
    });
  }
};

/**
 * Eliminar un usuario de un grupo
 */
export const removeUserFromGroup = async (req, res) => {
  try {
    const { grupo_id, usuario_id } = req.params;

    // Verificar si el miembro existe
    const miembroExistente = await prisma.grupo_usuarios.findFirst({
      where: {
        grupo_id: parseInt(grupo_id),
        usuario_id: parseInt(usuario_id)
      }
    });

    if (!miembroExistente) {
      return res.status(404).json({
        ok: false,
        mensaje: 'El usuario no es miembro del grupo'
      });
    }

    // Eliminar el miembro del grupo
    await prisma.grupo_usuarios.deleteMany({
      where: {
        grupo_id: parseInt(grupo_id),
        usuario_id: parseInt(usuario_id)
      }
    });

    return res.status(200).json({
      ok: true,
      mensaje: 'Usuario eliminado del grupo correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar usuario del grupo:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error al eliminar usuario del grupo',
      error: error.message
    });
  }
};

/**
 * Obtiene los grupos de un usuario
 */
export const getUserGroups = async (req, res) => {
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

    // Obtener los grupos del usuario
    const grupos = await prisma.grupos.findMany({
      where: {
        grupo_usuarios: {
          some: {
            usuario_id: parseInt(id)
          }
        }
      },
      include: {
        usuarios: true,
        grupo_usuarios: {
          include: {
            usuarios: true
          }
        }
      }
    });

    return res.status(200).json({
      ok: true,
      grupos
    });
  } catch (error) {
    console.error('Error al obtener grupos del usuario:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error al obtener grupos del usuario',
      error: error.message
    });
  }
};

/**
 * Obtiene todos los miembros de un grupo específico
 */
export const getGroupMembers = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar si el grupo existe
    const grupoExistente = await prisma.grupos.findUnique({
      where: {
        id: parseInt(id)
      }
    });

    if (!grupoExistente) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Grupo no encontrado'
      });
    }

    // Obtener los miembros del grupo
    const miembros = await prisma.grupo_usuarios.findMany({
      where: {
        grupo_id: parseInt(id)
      },
      include: {
        usuarios: true
      }
    });

    // Extraer solo la información de usuarios
    const usuarios = miembros.map(miembro => miembro.usuarios);

    return res.status(200).json({
      ok: true,
      total: usuarios.length,
      usuarios
    });
  } catch (error) {
    console.error('Error al obtener miembros del grupo:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error al obtener miembros del grupo',
      error: error.message
    });
  }
};