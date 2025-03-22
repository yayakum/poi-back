import { Router } from 'express';
import { 
  getUsers, 
  getUserById, 
  createUser, 
  updateUser, 
  deleteUser,
  updateUserStatus,
  login,
  logout
} from '../controllers/usercontroller.js';

const router = Router();

// Obtener todos los usuarios
router.get('/users', getUsers);

// Obtener un usuario por ID
router.get('/users/:id', getUserById);

// Crear un nuevo usuario
router.post('/users', createUser);

// Actualizar datos de un usuario
router.put('/users/:id', updateUser);

// Actualizar el estado de un usuario (online/offline)
router.patch('/users/:id/status', updateUserStatus);

// Eliminar un usuario
router.delete('/users/:id', deleteUser);

// Login de usuario
router.post('/login', login);

// Logout de usuario
router.post('/logout', logout);

export default router;