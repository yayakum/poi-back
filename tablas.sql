CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20) UNIQUE NOT NULL,
    foto_perfil VARCHAR(255) DEFAULT NULL,
    descripcion VARCHAR(255) DEFAULT NULL,
    estado ENUM('online','offline') DEFAULT 'online',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para almacenar los grupos de chat
CREATE TABLE grupos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    foto_grupo VARCHAR(255) DEFAULT NULL,
    descripcion VARCHAR(255) DEFAULT NULL,  -- Descripción opcional del grupo
    creador_id INT NOT NULL,  -- Usuario que creó el grupo
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creador_id) REFERENCES usuarios(id) ON DELETE CASCADE
);


-- Tabla para registrar los miembros de los grupos
CREATE TABLE grupo_usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    grupo_id INT NOT NULL,
    usuario_id INT NOT NULL,
    FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Tabla para almacenar los mensajes (tanto individuales como en grupo)
CREATE TABLE mensajes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    remitente_id INT NOT NULL,
    destinatario_id INT NULL,  -- Para mensajes 1-1
    grupo_id INT NULL,  -- Para mensajes en grupo
    contenido TEXT DEFAULT NULL, -- Mensaje de texto
    tipo ENUM('texto', 'archivo', 'imagen', 'video') NOT NULL DEFAULT 'texto',
    estado ENUM('pendiente', 'entregado', 'leido') DEFAULT 'pendiente',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (remitente_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (destinatario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE
);

-- Tabla para almacenar archivos enviados en los mensajes
CREATE TABLE archivos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mensaje_id INT NOT NULL,
    usuario_id INT NOT NULL,
    nombre_original VARCHAR(255) NOT NULL,
    ruta VARCHAR(255) NOT NULL, -- Ruta donde se almacena el archivo
    tipo_mime VARCHAR(100) NOT NULL, -- Tipo de archivo (MIME)
    tamaño INT NOT NULL, -- Tamaño del archivo en bytes
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mensaje_id) REFERENCES mensajes(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Tabla para almacenar las tareas de los grupos
CREATE TABLE tareas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    grupo_id INT NOT NULL,
    texto TEXT NOT NULL,
    estatus ENUM('incompleta', 'completa') DEFAULT 'incompleta',
    creado_por INT NOT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_finalizacion TIMESTAMP NULL DEFAULT NULL,
    finalizado_por INT NULL DEFAULT NULL,
    FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE,
    FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (finalizado_por) REFERENCES usuarios(id) ON DELETE SET NULL
);
