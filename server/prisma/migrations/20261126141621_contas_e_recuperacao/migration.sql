-- AlterTable
ALTER TABLE "utilizadores" ADD COLUMN     "aprovado" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "sessao_versao" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "recuperacoes_senha" (
    "id" SERIAL NOT NULL,
    "utilizador_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "usado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recuperacoes_senha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recuperacoes_senha_token_hash_key" ON "recuperacoes_senha"("token_hash");

-- CreateIndex
CREATE INDEX "recuperacoes_senha_utilizador_id_idx" ON "recuperacoes_senha"("utilizador_id");

-- AddForeignKey
ALTER TABLE "recuperacoes_senha" ADD CONSTRAINT "recuperacoes_senha_utilizador_id_fkey" FOREIGN KEY ("utilizador_id") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
