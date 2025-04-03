// src/lib/prisma.js
import { PrismaClient } from '@prisma/client';

// Create a single instance of PrismaClient to be shared across the application
const prisma = new PrismaClient();

export default prisma;