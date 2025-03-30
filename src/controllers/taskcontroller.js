// controllers/task.controller.js
import { PrismaClient } from '@prisma/client';
import { sharedState } from '../socket.js';

const prisma = new PrismaClient();

// Crear una nueva tarea
export const createTask = async (req, res) => {
  try {
    const { grupo_id, texto, creado_por } = req.body;

    if (!grupo_id || !texto || !creado_por) {
      return res.status(400).json({ message: 'Todos los campos son obligatorios' });
    }

    const task = await prisma.tareas.create({
      data: {
        grupo_id: parseInt(grupo_id),
        texto,
        creado_por: parseInt(creado_por),
        estatus: 'incompleta',
      },
      include: {
        grupos: true,
        usuarios_tareas_creado_porTousuarios: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
    });

    // Emitir evento de socket para notificación en tiempo real
    if (sharedState.io) {
      const roomId = `group-${grupo_id}`;
      sharedState.io.of('/group').to(roomId).emit('taskUpdated', { 
        groupId: parseInt(grupo_id),
        task
      });
    }

    res.status(201).json({
      message: 'Tarea creada con éxito',
      task,
    });
  } catch (error) {
    console.error('Error al crear tarea:', error);
    res.status(500).json({ message: 'Error al crear la tarea', error: error.message });
  }
};

// Obtener todas las tareas de un grupo
export const getTasks = async (req, res) => {
  try {
    const { groupId } = req.params;

    const tasks = await prisma.tareas.findMany({
      where: {
        grupo_id: parseInt(groupId),
      },
      include: {
        usuarios_tareas_creado_porTousuarios: {
          select: {
            id: true,
            nombre: true,
          },
        },
        usuarios_tareas_finalizado_porTousuarios: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
      orderBy: {
        fecha_creacion: 'desc',
      },
    });

    res.json(tasks);
  } catch (error) {
    console.error('Error al obtener tareas:', error);
    res.status(500).json({ message: 'Error al obtener las tareas', error: error.message });
  }
};

// Actualizar estado de una tarea (marcar como completada)
export const updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { finalizado_por } = req.body;

    if (!finalizado_por) {
      return res.status(400).json({ message: 'El ID del usuario que finaliza es obligatorio' });
    }

    const task = await prisma.tareas.update({
      where: {
        id: parseInt(taskId),
      },
      data: {
        estatus: 'completa',
        finalizado_por: parseInt(finalizado_por),
        fecha_finalizacion: new Date(),
      },
      include: {
        grupos: true,
        usuarios_tareas_creado_porTousuarios: {
          select: {
            id: true,
            nombre: true,
          },
        },
        usuarios_tareas_finalizado_porTousuarios: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
    });

    // Emitir evento de socket para notificación en tiempo real
    if (sharedState.io) {
      const roomId = `group-${task.grupo_id}`;
      sharedState.io.of('/group').to(roomId).emit('taskUpdated', { 
        groupId: task.grupo_id,
        task
      });
    }

    res.json({
      message: 'Tarea actualizada con éxito',
      task,
    });
  } catch (error) {
    console.error('Error al actualizar tarea:', error);
    res.status(500).json({ message: 'Error al actualizar la tarea', error: error.message });
  }
};