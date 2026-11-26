import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../erros';
import { assinarToken, equipa } from '../middleware/auth';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const u = await prisma.utilizador.findUnique({ where: { email } });
  // Compara sempre (mesmo sem utilizador) para não revelar quais emails existem.
  const ok = await bcrypt.compare(password, u?.passwordHash ?? '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
  if (!u || !ok) throw new HttpError(401, 'Email ou palavra-passe errados.');

  const utilizador = { id: u.id, nome: u.nome, papel: u.papel };
  res.json({ token: assinarToken(utilizador), utilizador: { ...utilizador, email: u.email } });
});

authRouter.get('/eu', equipa, (req, res) => {
  res.json({ utilizador: req.utilizador });
});
