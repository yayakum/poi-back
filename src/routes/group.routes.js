import { Router } from 'express';
import {
  getGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  addUserToGroup,
  removeUserFromGroup,
  getUserGroups,
  getGroupMembers
} from '../controllers/groupcontroller.js';

const router = Router();

// Rutas para grupos
router.get('/grupos', getGroups);
router.get('/grupos/:id', getGroupById);
router.post('/grupos', createGroup);
router.put('/grupos/:id', updateGroup);
router.delete('/grupos/:id', deleteGroup);

// Rutas para gestión de miembros
router.post('/grupos/miembro', addUserToGroup);
router.delete('/grupos/miembro/:grupo_id/:usuario_id', removeUserFromGroup);

// Ruta para obtener grupos de un usuario
router.get('/grupos/usuario/:id', getUserGroups);
// Ruta para obtener miembros de un grupo
router.get('/grupos/miembro/:id', getGroupMembers);

export default router;