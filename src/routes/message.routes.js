import { Router } from 'express';
import { 
    getUserMessages, 
    getGroupMessages,
    sendMessage,
    deleteMessage,
    markMessagesAsRead,
    getUnreadMessageCounts

} from '../controllers/messagecontroller.js';

const router = Router();

// Obtener mensajes entre dos usuarios
router.get('/mensajes/:userId/:targetId', getUserMessages);

// Obtener mensajes de un grupo
router.get('/mensajes/grupo/:groupId', getGroupMessages);

// Enviar un mensaje (esta ruta es un respaldo para cuando Socket.IO no está disponible)
router.post('/mensajes', sendMessage);

// Eliminar un mensaje
router.delete('/mensajes/:id', deleteMessage);

// Marcar mensajes como leídos
router.post('/mensajes/marcar-leidos', markMessagesAsRead);

// Obtener la cantidad de mensajes no leídos para un usuario
router.get('/mensajes/noleidos/:userId', getUnreadMessageCounts);

export default router;