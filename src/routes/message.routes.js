// Actualizar message.routes.js para incluir la ruta de archivos para grupos

import { Router } from 'express';
import { 
    getUserMessages, 
    getGroupMessages,
    sendMessage,
    sendGroupMessage,
    deleteMessage,
    markMessagesAsRead,
    markGroupMessagesAsRead,
    getUnreadMessagesStatus,
} from '../controllers/messagecontroller.js';
import { uploadFile, uploadGroupFile } from '../controllers/filecontroller.js';
import upload from '../middlewares/upload.js';

const router = Router();

// Obtener mensajes entre dos usuarios
router.get('/mensajes/:userId/:targetId', getUserMessages);

// Enviar un mensaje (esta ruta es un respaldo para cuando Socket.IO no está disponible)
router.post('/mensajes', sendMessage);

// Eliminar un mensaje
router.delete('/mensajes/:id', deleteMessage);

// Marcar mensajes como leídos
router.post('/mensajes/marcar-leidos', markMessagesAsRead);

// Rutas para mensajes de grupo
router.get('/messages/grupo/:groupId', getGroupMessages);
router.post('/messages/grupo', sendGroupMessage);
router.post('/messages/grupo/read', markGroupMessagesAsRead);

// Agregar esta ruta a message.routes.js
router.get('/unread/:userId', getUnreadMessagesStatus);


// Rutas para subir archivos
router.post('/mensajes/archivo', upload.single('file'), uploadFile);
// Nueva ruta para subir archivos a grupos
router.post('/archivos/grupo', upload.single('file'), uploadGroupFile);

export default router;