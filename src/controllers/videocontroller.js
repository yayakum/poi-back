import { PrismaClient } from '@prisma/client';
import { sharedState } from '../socket.js';

const prisma = new PrismaClient();

export const initiateCall = async (req, res) => {
  try {
    const { iniciadorId, receptorId, isVideo } = req.body;

    // Verificar si existe una llamada activa entre estos usuarios
    const existingCall = await prisma.videollamadas.findFirst({
      where: {
        OR: [
          {
            iniciador_id: parseInt(iniciadorId),
            receptor_id: parseInt(receptorId),
            estado: {
              in: ['iniciada', 'conectada']
            }
          },
          {
            iniciador_id: parseInt(receptorId),
            receptor_id: parseInt(iniciadorId),
            estado: {
              in: ['iniciada', 'conectada']
            }
          }
        ]
      }
    });

    if (existingCall) {
      return res.status(400).json({
        ok: false,
        message: 'Ya existe una llamada activa entre estos usuarios'
      });
    }

    // Crear nueva entrada en la base de datos
    const newCall = await prisma.videollamadas.create({
      data: {
        iniciador_id: parseInt(iniciadorId),
        receptor_id: parseInt(receptorId),
        estado: 'iniciada',
        inicio_tiempo: new Date()
      }
    });

    // Obtener información del iniciador para enviar al receptor
    const iniciador = await prisma.usuario.findUnique({
      where: { id: parseInt(iniciadorId) },
      select: {
        id: true,
        nombre: true,
        foto_perfil: true
      }
    });

    // Verificar si el receptor está conectado
    const receptorSocketId = sharedState.userSockets[receptorId];
    
    // Generar token de Zegocloud (en una implementación real esto debe ser seguro)
    const callData = {
      callId: newCall.id,
      caller: iniciador,
      isVideo: isVideo
    };

    // Si el receptor está conectado, enviar notificación
    if (receptorSocketId) {
      // Emitir evento al socket del receptor
      const io = req.app.get('io');
      io.of('/private').to(receptorSocketId).emit('incomingCall', callData);
    }

    res.status(201).json({
      ok: true,
      call: newCall,
      callData
    });
  } catch (error) {
    console.error('Error al iniciar llamada:', error);
    res.status(500).json({
      ok: false,
      message: 'Error interno del servidor'
    });
  }
};

export const updateCallStatus = async (req, res) => {
  try {
    const { callId, status } = req.body;
    
    // Validar que el estado sea válido
    const validStatuses = ['conectada', 'rechazada', 'finalizada'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        ok: false,
        message: 'Estado de llamada no válido'
      });
    }

    // Obtener llamada actual
    const call = await prisma.videollamadas.findUnique({
      where: { id: parseInt(callId) }
    });

    if (!call) {
      return res.status(404).json({
        ok: false,
        message: 'Llamada no encontrada'
      });
    }

    // Actualizar estado
    const updatedCall = await prisma.videollamadas.update({
      where: { id: parseInt(callId) },
      data: {
        estado: status,
        // Si la llamada finaliza, actualizar tiempo de fin
        fin_tiempo: status === 'finalizada' || status === 'rechazada' ? new Date() : undefined
      }
    });

    // Notificar a los usuarios involucrados sobre el cambio de estado
    const io = req.app.get('io');
    const privateIo = io.of('/private');
    
    const iniciadorSocketId = sharedState.userSockets[call.iniciador_id.toString()];
    const receptorSocketId = sharedState.userSockets[call.receptor_id.toString()];

    // Enviar actualización a ambos usuarios si están conectados
    if (iniciadorSocketId) {
      privateIo.to(iniciadorSocketId).emit('callStatusUpdated', {
        callId: updatedCall.id,
        status: updatedCall.estado
      });
    }

    if (receptorSocketId) {
      privateIo.to(receptorSocketId).emit('callStatusUpdated', {
        callId: updatedCall.id,
        status: updatedCall.estado
      });
    }

    res.status(200).json({
      ok: true,
      call: updatedCall
    });
  } catch (error) {
    console.error('Error al actualizar estado de llamada:', error);
    res.status(500).json({
      ok: false,
      message: 'Error interno del servidor'
    });
  }
};

export const getCallById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const call = await prisma.videollamadas.findUnique({
      where: { id: parseInt(id) },
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

    if (!call) {
      return res.status(404).json({
        ok: false,
        message: 'Llamada no encontrada'
      });
    }

    res.status(200).json({
      ok: true,
      call
    });
  } catch (error) {
    console.error('Error al obtener llamada:', error);
    res.status(500).json({
      ok: false,
      message: 'Error interno del servidor'
    });
  }
};