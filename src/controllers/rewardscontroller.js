import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Obtener todas las recompensas disponibles
export const getAllRewards = async (req, res) => {
  try {
    const recompensas = await prisma.recompensas.findMany();
    
    return res.status(200).json({
      ok: true,
      rewards: recompensas
    });
  } catch (error) {
    console.error('Error al obtener recompensas:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al obtener las recompensas',
      error: error.message
    });
  }
};

// Obtener recompensas de un usuario específico
export const getUserRewards = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    // Verificar que el usuario existe
    const user = await prisma.usuario.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Obtener historial de recompensas canjeadas por el usuario
    const redeemedRewards = await prisma.historial_recompensas.findMany({
      where: { usuario_id: userId },
      include: {
        recompensas: true
      },
      orderBy: {
        fecha_canje: 'desc'
      }
    });

    // Formatear los datos para el cliente
    const formattedRewards = redeemedRewards.map(record => ({
      id: record.id,
      rewardId: record.recompensa_id,
      name: record.recompensas.nombre,
      description: record.recompensas.descripcion,
      reward: record.recompensas.recompensa,
      cost: record.recompensas.costo_puntos,
      redeemedAt: record.fecha_canje
    }));

    res.json({ redeemedRewards: formattedRewards });
  } catch (error) {
    console.error('Error al obtener recompensas del usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Obtener los puntos acumulados de un usuario
export const getUserPoints = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    // Verificar que el usuario existe
    const user = await prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nombre: true,
        puntos_acumulados: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json({ 
      userId: user.id, 
      name: user.nombre,
      points: user.puntos_acumulados 
    });
  } catch (error) {
    console.error('Error al obtener puntos del usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Canjear una recompensa
export const redeemReward = async (req, res) => {
  const { userId, rewardId } = req.body;

  // Inicia una transacción para garantizar la integridad de los datos
  try {
    const result = await prisma.$transaction(async (prisma) => {
      // Verificar que el usuario existe
      const user = await prisma.usuario.findUnique({
        where: { id: parseInt(userId) }
      });

      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      // Verificar que la recompensa existe
      const reward = await prisma.recompensas.findUnique({
        where: { id: parseInt(rewardId) }
      });

      if (!reward) {
        throw new Error('Recompensa no encontrada');
      }

      // Verificar que el usuario tiene suficientes puntos
      if (user.puntos_acumulados < reward.costo_puntos) {
        throw new Error('Puntos insuficientes para canjear esta recompensa');
      }

      // Actualizar los puntos del usuario
      const updatedUser = await prisma.usuario.update({
        where: { id: parseInt(userId) },
        data: {
          puntos_acumulados: user.puntos_acumulados - reward.costo_puntos
        }
      });

      // Registrar la recompensa canjeada
      const redemption = await prisma.historial_recompensas.create({
        data: {
          usuario_id: parseInt(userId),
          recompensa_id: parseInt(rewardId),
          fecha_canje: new Date()
        },
        include: {
          recompensas: true
        }
      });

      return {
        success: true,
        user: updatedUser,
        redemption: {
          id: redemption.id,
          rewardName: redemption.recompensas.nombre,
          rewardDescription: redemption.recompensas.descripcion,
          reward: redemption.recompensas.recompensa,
          cost: redemption.recompensas.costo_puntos,
          redeemedAt: redemption.fecha_canje
        }
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error al canjear recompensa:', error);
    
    // Manejamos los errores específicos con códigos de estado apropiados
    if (error.message === 'Usuario no encontrado') {
      return res.status(404).json({ message: error.message });
    }
    
    if (error.message === 'Recompensa no encontrada') {
      return res.status(404).json({ message: error.message });
    }
    
    if (error.message === 'Puntos insuficientes para canjear esta recompensa') {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Añadir puntos a un usuario
export const addPoints = async (req, res) => {
  try {
    const { userId, points, reason } = req.body;
    
    if (!userId || !points || points <= 0) {
      return res.status(400).json({ 
        message: 'Se requieren ID de usuario y una cantidad válida de puntos' 
      });
    }

    // Verificar que el usuario existe
    const user = await prisma.usuario.findUnique({
      where: { id: parseInt(userId) }
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Actualizar los puntos del usuario
    const updatedUser = await prisma.usuario.update({
      where: { id: parseInt(userId) },
      data: {
        puntos_acumulados: {
          increment: points
        }
      }
    });

    // Registrar la transacción de puntos
    await prisma.puntos.create({
      data: {
        usuario_id: parseInt(userId),
        puntos: points
      }
    });

    res.json({ 
      success: true, 
      userId: updatedUser.id,
      points: updatedUser.puntos_acumulados,
      added: points,
      reason: reason || 'Puntos añadidos'
    });
  } catch (error) {
    console.error('Error al añadir puntos:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};