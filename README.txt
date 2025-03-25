# Instrucciones de Instalación - poi-app

## Requisitos previos
- XAMPP (para servidor MySQL)
- Node.js y npm instalados
- Git instalado

## Estructura del proyecto
El proyecto consta de dos repositorios:
- `poi-back`: Backend de la aplicación
- `poi-front`: Frontend de la aplicación

## Pasos de instalación

### 1. Preparación
1. Crear una carpeta principal llamada `poi-app`
2. Abrir la terminal dentro de esta carpeta

### 2. Clonar el Backend
```bash
git clone [URL_DEL_REPOSITORIO_BACKEND]
```
> Sustituir [URL_DEL_REPOSITORIO_BACKEND] por la URL real del proyecto

### 3. Clonar el Frontend
```bash
# Asegúrate de estar en la carpeta poi-app si no es así puedes volve con cd ..
git clone [URL_DEL_REPOSITORIO_FRONTEND]
```
> Sustituir [URL_DEL_REPOSITORIO_FRONTEND] por la URL real del proyecto

### 4. Instalar dependencias
```bash
# Instalar dependencias del backend
cd poi-back
npm install

# Volver a la carpeta principal
cd ..

# Instalar dependencias del frontend
cd poi-front
npm install

# Volver a la carpeta principal
cd ..
```

### 5. Configurar la Base de Datos
1. Iniciar XAMPP y activar el servicio de MySQL
2. Crear una base de datos llamada `poi`
3. Importar las tablas desde el archivo `tablas.sql` usando MySQL

### 6. Configurar Prisma (en el backend)
1. Navegar a la carpeta del backend:
   ```
   cd poi-back
   ```
2. Ejecutar los siguientes comandos para configurar Prisma:
   ```
   npx prisma db pull
   npx prisma generate
   ```
3. Crear un archivo `.env` en la raíz del proyecto `poi-back` con el siguiente contenido:
   ```
   # Environment variables declared in this file are automatically made available to Prisma.
   # See the documentation for more detail: https://pris.ly/d/prisma-schema#accessing-environment-variables-from-the-schema

   # Prisma supports the native connection string format for PostgreSQL, MySQL, SQLite, SQL Server, MongoDB and CockroachDB.
   # See the documentation for all the connection string options: https://pris.ly/d/connection-strings

   DATABASE_URL="mysql://root:@localhost:3306/poi?schema=public"
   ```
   > Nota: Si MySQL está en un puerto diferente al 3306, modificar el puerto en la URL de conexión.

## Ejecución del proyecto

### Iniciar el Backend
```bash
cd poi-back
npm run dev
```

### Iniciar el Frontend
```bash
cd poi-front
npm run dev
```

## Notas adicionales
- Ambos proyectos (backend y frontend) se ejecutan con el comando `npm run dev`
- Es necesario tener XAMPP en ejecución con el servicio de MySQL activo para que el proyecto funcione correctamente