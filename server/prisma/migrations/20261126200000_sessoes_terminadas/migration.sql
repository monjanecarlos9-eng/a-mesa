-- Logout no servidor: lista de tokens terminados antes de expirarem
CREATE TABLE "sessoes_terminadas" (
    "jti" TEXT NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessoes_terminadas_pkey" PRIMARY KEY ("jti")
);

-- CreateIndex
CREATE INDEX "sessoes_terminadas_expira_em_idx" ON "sessoes_terminadas"("expira_em");
