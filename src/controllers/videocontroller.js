// src/controllers/video.controller.js
import prisma from '../lib/prisma.js';

export const createCall = async (req, res) => {
  try {
    const { iniciador_id, receptor_id } = req.body;
    
    // Validar parámetros
    if (!iniciador_id || !receptor_id) {
      return res.status(400).json({
        ok: false,
        message: 'Iniciador y receptor son requeridos'
      });
    }
    
    // Crear nueva llamada en la base de datos
    const call = await prisma.videollamadas.create({
      data: {
        iniciador_id: parseInt(iniciador_id),
        receptor_id: parseInt(receptor_id),
        estado: 'iniciada'
      }
    });
    
    return res.json({
      ok: true,
      data: call,
      message: 'Llamada creada con éxito'
    });
  } catch (error) {
    console.error('Error al crear llamada:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al crear la llamada',
      error: error.message
    });
  }
};

export const updateCallStatus = async (req, res) => {
  try {
    const { callId, iniciador_id, receptor_id, estado } = req.body;
    
    // Validar parámetros
    if (!estado || (!callId && (!iniciador_id || !receptor_id))) {
      return res.status(400).json({
        ok: false,
        message: 'Parámetros incompletos para actualizar llamada'
      });
    }
    
    // Validar que el estado sea válido
    const validStates = ['iniciada', 'conectada', 'rechazada', 'finalizada'];
    if (!validStates.includes(estado)) {
      return res.status(400).json({
        ok: false,
        message: 'Estado de llamada no válido'
      });
    }
    
    let callUpdate;
    
    if (callId) {
      // Actualizar por ID específico
      callUpdate = await prisma.videollamadas.update({
        where: { id: parseInt(callId) },
        data: {
          estado,
          // Si el estado es rechazada o finalizada, actualizar tiempo de fin
          ...(estado === 'rechazada' || estado === 'finalizada' ? { fin_tiempo: new Date() } : {})
        }
      });
    } else {
      // Buscar la llamada más reciente entre estos usuarios y actualizarla
      const latestCall = await prisma.videollamadas.findFirst({
        where: {
          iniciador_id: parseInt(iniciador_id),
          receptor_id: parseInt(receptor_id),
          estado: {
            in: ['iniciada', 'conectada']
          }
        },
        orderBy: {
          inicio_tiempo: 'desc'
        }
      });
      
      if (!latestCall) {
        return res.status(404).json({
          ok: false,
          message: 'No se encontró una llamada activa entre estos usuarios'
        });
      }
      
      callUpdate = await prisma.videollamadas.update({
        where: { id: latestCall.id },
        data: {
          estado,
          // Si el estado es rechazada o finalizada, actualizar tiempo de fin
          ...(estado === 'rechazada' || estado === 'finalizada' ? { fin_tiempo: new Date() } : {})
        }
      });
    }
    
    return res.json({
      ok: true,
      data: callUpdate,
      message: 'Estado de llamada actualizado con éxito'
    });
  } catch (error) {
    console.error('Error al actualizar estado de llamada:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al actualizar estado de llamada',
      error: error.message
    });
  }
};

export const getCallHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Validar parámetro
    if (!userId) {
      return res.status(400).json({
        ok: false,
        message: 'ID de usuario requerido'
      });
    }
    
    // Obtener historial de llamadas (como iniciador o receptor)
    const calls = await prisma.videollamadas.findMany({
      where: {
        OR: [
          { iniciador_id: parseInt(userId) },
          { receptor_id: parseInt(userId) }
        ]
      },
      orderBy: {
        inicio_tiempo: 'desc'
      },
      include: {
        usuarios_videollamadas_iniciador_idTousuarios: {
          select: {
            id: true,
            nombre: true,
            foto_perfil: true
          }
        },
        usuarios_videollamadas_receptor_idTousuarios: {
          select: {
            id: true,
            nombre: true,
            foto_perfil: true
          }
        }
      }
    });
    
    return res.json({
      ok: true,
      data: calls,
      message: 'Historial de llamadas obtenido con éxito'
    });
  } catch (error) {
    console.error('Error al obtener historial de llamadas:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al obtener historial de llamadas',
      error: error.message
    });
  }
};