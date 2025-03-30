-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 30-03-2025 a las 01:06:18
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `poi`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `archivos`
--

CREATE TABLE `archivos` (
  `id` int(11) NOT NULL,
  `mensaje_id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `nombre_original` varchar(255) NOT NULL,
  `ruta` varchar(255) NOT NULL,
  `tipo_mime` varchar(100) NOT NULL,
  `tamaño` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `archivos`
--

INSERT INTO `archivos` (`id`, `mensaje_id`, `usuario_id`, `nombre_original`, `ruta`, `tipo_mime`, `tamaño`, `created_at`) VALUES
(87, 652, 4, '1erAvance_POI.pdf', '/uploads/1743278481842-798953047.pdf', 'application/pdf', 314670, '2025-03-30 02:01:21'),
(88, 656, 3, 'ð¸n e j ið¸.jfif', '/uploads/1743292219907-25949572.jfif', 'image/jpeg', 85559, '2025-03-30 05:50:19');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `grupos`
--

CREATE TABLE `grupos` (
  `id` int(11) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `foto_grupo` varchar(255) DEFAULT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `creador_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `grupos`
--

INSERT INTO `grupos` (`id`, `nombre`, `foto_grupo`, `descripcion`, `creador_id`, `created_at`) VALUES
(81, 'POI', NULL, '', 3, '2025-03-30 01:54:22'),
(82, '🫃🏾', NULL, 'El gael se va a aventar el proyecto de Diseño 😎😎', 3, '2025-03-30 01:59:00');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `grupo_usuarios`
--

CREATE TABLE `grupo_usuarios` (
  `id` int(11) NOT NULL,
  `grupo_id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `grupo_usuarios`
--

INSERT INTO `grupo_usuarios` (`id`, `grupo_id`, `usuario_id`) VALUES
(202, 81, 5),
(203, 81, 4),
(204, 81, 3),
(205, 82, 2),
(206, 82, 3),
(207, 82, 4);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `historial_recompensas`
--

CREATE TABLE `historial_recompensas` (
  `id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `recompensa_id` int(11) NOT NULL,
  `fecha_canje` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `mensajes`
--

CREATE TABLE `mensajes` (
  `id` int(11) NOT NULL,
  `remitente_id` int(11) NOT NULL,
  `destinatario_id` int(11) DEFAULT NULL,
  `grupo_id` int(11) DEFAULT NULL,
  `contenido` text DEFAULT NULL,
  `tipo` enum('texto','archivo','imagen','video','ubicacion') NOT NULL DEFAULT 'texto',
  `estado` enum('pendiente','entregado','leido') DEFAULT 'pendiente',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `mensajes`
--

INSERT INTO `mensajes` (`id`, `remitente_id`, `destinatario_id`, `grupo_id`, `contenido`, `tipo`, `estado`, `created_at`) VALUES
(648, 3, 4, NULL, '[UBICACION]25.76778036911582,-100.41510792017435[/UBICACION]', 'texto', 'leido', '2025-03-30 02:00:21'),
(649, 4, 3, NULL, 'OK', 'texto', 'leido', '2025-03-30 02:00:29'),
(650, 4, 5, NULL, 'Hola', 'texto', 'leido', '2025-03-30 02:00:58'),
(651, 3, 4, NULL, 'Holaa', 'texto', 'leido', '2025-03-30 02:01:01'),
(652, 4, 3, NULL, '1erAvance_POI.pdf', 'archivo', 'leido', '2025-03-30 02:01:21'),
(653, 4, 3, NULL, 'jeje', 'texto', 'leido', '2025-03-30 02:01:25'),
(654, 3, 4, NULL, 'excelente, muchas gracias', 'texto', 'leido', '2025-03-30 02:01:33'),
(655, 4, 3, NULL, 'nombre de que ', 'texto', 'leido', '2025-03-30 02:01:51'),
(656, 3, 5, NULL, 'ð¸n e j ið¸.jfif', 'imagen', 'leido', '2025-03-30 05:50:19'),
(657, 5, 3, NULL, 'jeje', 'texto', 'leido', '2025-03-30 05:51:12'),
(658, 3, 5, NULL, 'QUe ondaaaa', 'texto', 'leido', '2025-03-30 05:51:19'),
(659, 5, 4, NULL, 'que ongaa', 'texto', 'pendiente', '2025-03-30 05:57:15'),
(660, 5, 3, NULL, 'hola', 'texto', 'leido', '2025-03-30 05:57:23');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `mensaje_leido_grupos`
--

CREATE TABLE `mensaje_leido_grupos` (
  `id` int(11) NOT NULL,
  `mensaje_id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `fecha_lectura` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `puntos`
--

CREATE TABLE `puntos` (
  `id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `puntos` int(11) NOT NULL DEFAULT 0,
  `descripcion` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `puntos`
--

INSERT INTO `puntos` (`id`, `usuario_id`, `puntos`, `descripcion`) VALUES
(550, 3, 100, 'Puntos por enviar mensaje de texto'),
(551, 4, 100, 'Puntos por enviar mensaje de texto'),
(552, 4, 100, 'Puntos por enviar mensaje de texto'),
(553, 3, 100, 'Puntos por enviar mensaje de texto'),
(554, 4, 100, 'Puntos por enviar mensaje de texto'),
(555, 3, 100, 'Puntos por enviar mensaje de texto'),
(556, 4, 100, 'Puntos por enviar mensaje de texto'),
(557, 5, 100, 'Puntos por enviar mensaje de texto'),
(558, 3, 100, 'Puntos por enviar mensaje de texto'),
(559, 5, 100, 'Puntos por enviar mensaje de texto'),
(560, 5, 100, 'Puntos por enviar mensaje de texto');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `recompensas`
--

CREATE TABLE `recompensas` (
  `id` int(11) NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `descripcion` varchar(255) NOT NULL,
  `recompensa` varchar(255) NOT NULL,
  `costo_puntos` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `recompensas`
--

INSERT INTO `recompensas` (`id`, `nombre`, `descripcion`, `recompensa`, `costo_puntos`) VALUES
(8, 'Avatar Flame Princess', 'Avatar de Flame Princess de Adventure Time', 'assets/FlamePrincess.jpg', 100),
(9, 'Avatar BMO', 'Avatar de BMO de Adventure Time', 'assets/BMO.jpg', 5000),
(10, 'Avatar Gunter', 'Avatar de Gunter de Adventure Time', 'assets/Gunter.jpg', 7000),
(11, 'Avatar Ice King', 'Avatar de Ice King de Adventure Time', 'assets/IceKing.jpg', 8500),
(12, 'Avatar Lady Rainicorn', 'Avatar de Lady Rainicorn de Adventure Time', 'assets/LadyRainicorn.jpg', 10000),
(13, 'Avatar Lemongrab', 'Avatar de Lemongrab de Adventure Time', 'assets/Lemongrab.jpg', 12000),
(14, 'Avatar Lumpy Space Princess', 'Avatar de Lumpy Space Princess de Adventure Time', 'assets/LumpySpacePrincess.jpg', 15000);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `tareas`
--

CREATE TABLE `tareas` (
  `id` int(11) NOT NULL,
  `grupo_id` int(11) NOT NULL,
  `texto` text NOT NULL,
  `estatus` enum('incompleta','completa') DEFAULT 'incompleta',
  `creado_por` int(11) NOT NULL,
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_finalizacion` timestamp NULL DEFAULT NULL,
  `finalizado_por` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `tareas`
--

INSERT INTO `tareas` (`id`, `grupo_id`, `texto`, `estatus`, `creado_por`, `fecha_creacion`, `fecha_finalizacion`, `finalizado_por`) VALUES
(33, 81, 'MODIFICAR ESTADO DE LOS MENSAJES EN GRUPSO', 'incompleta', 3, '2025-03-30 01:55:27', NULL, NULL),
(34, 81, 'MOSTRAR MENSAJES PENDIENTES EN GRUPOS', 'incompleta', 3, '2025-03-30 01:56:16', NULL, NULL);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuarios`
--

CREATE TABLE `usuarios` (
  `id` int(11) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `telefono` varchar(20) NOT NULL,
  `foto_perfil` varchar(255) DEFAULT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `estado` enum('online','offline') DEFAULT 'offline',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `password` varchar(255) NOT NULL,
  `puntos_acumulados` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `usuarios`
--

INSERT INTO `usuarios` (`id`, `nombre`, `telefono`, `foto_perfil`, `descripcion`, `estado`, `created_at`, `password`, `puntos_acumulados`) VALUES
(2, 'Gael Oswaldo', '0123456789', 'assets/Marcelline.jpg', 'Estoy ocupado', 'offline', '2025-03-18 04:49:09', '123', 0),
(3, 'Yaya Kum', '8120773358', 'assets/Jake.jpg', 'Cualquier cosa estamos al pendiente', 'online', '2025-03-18 05:15:27', '123', 400),
(4, 'Luis Hernandez', '8120773359', 'assets/Marcelline.jpg', 'Hey! Estoy usando TextME', 'offline', '2025-03-18 05:32:33', 'Luishdz10', 400),
(5, 'Joshua', '1234567890', 'assets/BonnibelBubblegum.jpg', 'A todo dar mi beni', 'online', '2025-03-18 10:25:11', 'joshxx1', 300);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `videollamadas`
--

CREATE TABLE `videollamadas` (
  `id` int(11) NOT NULL,
  `iniciador_id` int(11) NOT NULL,
  `receptor_id` int(11) NOT NULL,
  `estado` enum('iniciada','conectada','rechazada','finalizada') NOT NULL DEFAULT 'iniciada',
  `inicio_tiempo` timestamp NOT NULL DEFAULT current_timestamp(),
  `fin_tiempo` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `videollamadas`
--

INSERT INTO `videollamadas` (`id`, `iniciador_id`, `receptor_id`, `estado`, `inicio_tiempo`, `fin_tiempo`) VALUES
(267, 4, 2, 'finalizada', '2025-03-30 01:59:33', '2025-03-30 01:59:34'),
(268, 4, 3, 'finalizada', '2025-03-30 01:59:36', '2025-03-30 01:59:37'),
(269, 3, 4, 'finalizada', '2025-03-30 01:59:38', NULL),
(270, 4, 3, 'finalizada', '2025-03-30 02:01:57', '2025-03-30 02:01:58'),
(271, 4, 3, 'finalizada', '2025-03-30 02:02:02', '2025-03-30 02:02:03'),
(272, 3, 4, 'finalizada', '2025-03-30 02:02:04', '2025-03-30 02:02:06'),
(273, 4, 3, 'rechazada', '2025-03-30 02:02:07', '2025-03-30 02:02:10'),
(274, 3, 4, 'rechazada', '2025-03-30 02:02:19', '2025-03-30 02:02:28'),
(275, 5, 3, 'finalizada', '2025-03-30 05:50:56', '2025-03-30 05:50:58'),
(276, 3, 5, 'conectada', '2025-03-30 05:51:01', NULL);

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `archivos`
--
ALTER TABLE `archivos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `mensaje_id` (`mensaje_id`),
  ADD KEY `usuario_id` (`usuario_id`);

--
-- Indices de la tabla `grupos`
--
ALTER TABLE `grupos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `creador_id` (`creador_id`);

--
-- Indices de la tabla `grupo_usuarios`
--
ALTER TABLE `grupo_usuarios`
  ADD PRIMARY KEY (`id`),
  ADD KEY `grupo_id` (`grupo_id`),
  ADD KEY `usuario_id` (`usuario_id`);

--
-- Indices de la tabla `historial_recompensas`
--
ALTER TABLE `historial_recompensas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `usuario_id` (`usuario_id`),
  ADD KEY `recompensa_id` (`recompensa_id`);

--
-- Indices de la tabla `mensajes`
--
ALTER TABLE `mensajes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `remitente_id` (`remitente_id`),
  ADD KEY `destinatario_id` (`destinatario_id`),
  ADD KEY `grupo_id` (`grupo_id`);

--
-- Indices de la tabla `mensaje_leido_grupos`
--
ALTER TABLE `mensaje_leido_grupos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `mensaje_id` (`mensaje_id`),
  ADD KEY `usuario_id` (`usuario_id`);

--
-- Indices de la tabla `puntos`
--
ALTER TABLE `puntos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `usuario_id` (`usuario_id`);

--
-- Indices de la tabla `recompensas`
--
ALTER TABLE `recompensas`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `tareas`
--
ALTER TABLE `tareas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `grupo_id` (`grupo_id`),
  ADD KEY `creado_por` (`creado_por`),
  ADD KEY `finalizado_por` (`finalizado_por`);

--
-- Indices de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `telefono` (`telefono`);

--
-- Indices de la tabla `videollamadas`
--
ALTER TABLE `videollamadas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `iniciador_id` (`iniciador_id`),
  ADD KEY `receptor_id` (`receptor_id`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `archivos`
--
ALTER TABLE `archivos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=89;

--
-- AUTO_INCREMENT de la tabla `grupos`
--
ALTER TABLE `grupos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=83;

--
-- AUTO_INCREMENT de la tabla `grupo_usuarios`
--
ALTER TABLE `grupo_usuarios`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=208;

--
-- AUTO_INCREMENT de la tabla `historial_recompensas`
--
ALTER TABLE `historial_recompensas`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT de la tabla `mensajes`
--
ALTER TABLE `mensajes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=661;

--
-- AUTO_INCREMENT de la tabla `mensaje_leido_grupos`
--
ALTER TABLE `mensaje_leido_grupos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `puntos`
--
ALTER TABLE `puntos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=561;

--
-- AUTO_INCREMENT de la tabla `recompensas`
--
ALTER TABLE `recompensas`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT de la tabla `tareas`
--
ALTER TABLE `tareas`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=35;

--
-- AUTO_INCREMENT de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT de la tabla `videollamadas`
--
ALTER TABLE `videollamadas`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=277;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `archivos`
--
ALTER TABLE `archivos`
  ADD CONSTRAINT `archivos_ibfk_1` FOREIGN KEY (`mensaje_id`) REFERENCES `mensajes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `archivos_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `grupos`
--
ALTER TABLE `grupos`
  ADD CONSTRAINT `grupos_ibfk_1` FOREIGN KEY (`creador_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `grupo_usuarios`
--
ALTER TABLE `grupo_usuarios`
  ADD CONSTRAINT `grupo_usuarios_ibfk_1` FOREIGN KEY (`grupo_id`) REFERENCES `grupos` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `grupo_usuarios_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `historial_recompensas`
--
ALTER TABLE `historial_recompensas`
  ADD CONSTRAINT `historial_recompensas_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `historial_recompensas_ibfk_2` FOREIGN KEY (`recompensa_id`) REFERENCES `recompensas` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `mensajes`
--
ALTER TABLE `mensajes`
  ADD CONSTRAINT `mensajes_ibfk_1` FOREIGN KEY (`remitente_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `mensajes_ibfk_2` FOREIGN KEY (`destinatario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `mensajes_ibfk_3` FOREIGN KEY (`grupo_id`) REFERENCES `grupos` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `mensaje_leido_grupos`
--
ALTER TABLE `mensaje_leido_grupos`
  ADD CONSTRAINT `mensaje_leido_grupos_ibfk_1` FOREIGN KEY (`mensaje_id`) REFERENCES `mensajes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `mensaje_leido_grupos_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `puntos`
--
ALTER TABLE `puntos`
  ADD CONSTRAINT `puntos_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `tareas`
--
ALTER TABLE `tareas`
  ADD CONSTRAINT `tareas_ibfk_1` FOREIGN KEY (`grupo_id`) REFERENCES `grupos` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `tareas_ibfk_2` FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `tareas_ibfk_3` FOREIGN KEY (`finalizado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `videollamadas`
--
ALTER TABLE `videollamadas`
  ADD CONSTRAINT `videollamadas_ibfk_1` FOREIGN KEY (`iniciador_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `videollamadas_ibfk_2` FOREIGN KEY (`receptor_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
