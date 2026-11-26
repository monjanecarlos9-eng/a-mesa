-- CreateEnum
CREATE TYPE "MetodoPagamento" AS ENUM ('mbway', 'cartao');

-- AlterTable
ALTER TABLE "categorias" ADD COLUMN     "nome_en" TEXT;

-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "metodo_pagamento" "MetodoPagamento",
ADD COLUMN     "pago_em" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "pratos" ADD COLUMN     "alergenios" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "descricao_en" TEXT,
ADD COLUMN     "nome_en" TEXT,
ADD COLUMN     "sem_gluten" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vegetariano" BOOLEAN NOT NULL DEFAULT false;
