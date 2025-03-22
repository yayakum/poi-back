import { Router } from 'express';
import {
  getAllRewards,
  getUserRewards,
  getUserPoints,
  redeemReward,
  addPoints,

} from '../controllers/rewardscontroller.js';

const router = Router();

// Obtener todas las recompensas disponibles
router.get('/rewards', getAllRewards);

// Obtener recompensas canjeadas por un usuario
router.get('/rewards/user/:userId', getUserRewards);

// Obtener puntos acumulados de un usuario
router.get('/points/user/:userId', getUserPoints);

// Canjear una recompensa
router.post('/rewards/redeem', redeemReward);

// Añadir puntos a un usuario
router.post('/points/add', addPoints);
export default router;