import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
const prisma = new PrismaClient();

// Configuración de almacenamiento para multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Crear directorio para uploads si no existe
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generar nombre único para el archivo
    const uniqueFilename = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueFilename);
  }
});

// Configurar límites y tipos de archivos permitidos
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB límite de tamaño
  },
  fileFilter: (req, file, cb) => {
    // Puedes añadir validaciones de tipo MIME aquí si lo necesitas
    cb(null, true);
  }
});

// Ruta para subir archivos
router.post('/', upload.array('files'), async (req, res) => {
  try {
    const { remitente_id, destinatario_id, grupo_id } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'No se subieron archivos' });
    }

    if (!remitente_id || (!destinatario_id && !grupo_id)) {
      return res.status(400).json({ message: 'Datos incompletos' });
    }

    // Crear un mensaje primero
    const mensaje = await prisma.mensaje.create({
      data: {
        remitente_id: parseInt(remitente_id),
        destinatario_id: destinatario_id ? parseInt(destinatario_id) : null,
        grupo_id: grupo_id ? parseInt(grupo_id) : null,
        contenido: 'Archivo adjunto',
        tipo: 'archivo'
      }
    });

    // Registrar los archivos en la base de datos
    const archivosCreados = [];
    for (const file of files) {
      const archivoCreado = await prisma.archivos.create({
        data: {
          mensaje_id: mensaje.id,
          usuario_id: parseInt(remitente_id),
          nombre_original: file.originalname,
          ruta: `/uploads/${file.filename}`,
          tipo_mime: file.mimetype,
          tama_o: file.size
        }
      });
      archivosCreados.push(archivoCreado);
    }

    // Responder con los datos del mensaje y archivos creados
    res.status(201).json({
      message: 'Archivos subidos correctamente',
      mensaje_id: mensaje.id,
      archivos: archivosCreados
    });
  } catch (error) {
    console.error('Error al subir archivos:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Ruta para obtener un archivo por su ID
router.get('/:id', async (req, res) => {
  try {
    const fileId = parseInt(req.params.id);
    
    const archivo = await prisma.archivos.findUnique({
      where: { id: fileId }
    });
    
    if (!archivo) {
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }
    
    // Construir la ruta completa del archivo en el servidor
    const filePath = path.join(process.cwd(), archivo.ruta.replace(/^\//, ''));
    
    // Verificar si el archivo existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Archivo no encontrado en el servidor' });
    }
    
    // Enviar el archivo como respuesta
    res.setHeader('Content-Type', archivo.tipo_mime);
    res.setHeader('Content-Disposition', `attachment; filename="${archivo.nombre_original}"`);
    
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error('Error al obtener archivo:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Ruta para eliminar un archivo
router.delete('/:id', async (req, res) => {
  try {
    const fileId = parseInt(req.params.id);
    const userId = parseInt(req.query.userId); // El usuario que intenta eliminar
    
    // Verificar que el archivo exista y pertenezca al usuario
    const archivo = await prisma.archivos.findUnique({
      where: { id: fileId },
      include: { mensajes: true }
    });
    
    if (!archivo) {
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }
    
    if (archivo.usuario_id !== userId && archivo.mensajes.remitente_id !== userId) {
      return res.status(403).json({ message: 'No tienes permiso para eliminar este archivo' });
    }
    
    // Eliminar el archivo físico
    const filePath = path.join(process.cwd(), archivo.ruta.replace(/^\//, ''));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Eliminar el registro del archivo
    await prisma.archivos.delete({
      where: { id: fileId }
    });
    
    res.json({ message: 'Archivo eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar archivo:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

export default router;