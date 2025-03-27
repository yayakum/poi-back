
import { Router } from 'express';
import { createCall, 
  updateCallStatus, 
  getCallHistory 
} from '../controllers/videocontroller.js';

const router = Router();

// Rutas para videollamadas
router.post('/calls/create', createCall);
router.post('/calls/update-status', updateCallStatus);
router.get('/calls/history/:userId', getCallHistory);

export default router;