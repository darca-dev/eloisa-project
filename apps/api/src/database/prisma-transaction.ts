import { type Prisma } from '../generated/prisma/client';

/**
 * Cliente transaccional de Prisma.
 *
 * Se declara un alias propio para que los servicios de dominio dependan de un
 * único tipo y no repitan la firma de `$transaction` en cada módulo.
 */
export type PrismaTransaction = Prisma.TransactionClient;
