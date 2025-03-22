// routes/task.routes.js
import { Router } from 'express';
import { 
    createTask, 
    getTasks,
    updateTask 
} from '../controllers/taskcontroller.js';

const router = Router();

// Rutas para tareas
router.post('/tasks', createTask);
router.get('/tasks/:groupId', getTasks);
router.put('/tasks/:taskId', updateTask);

export default router;