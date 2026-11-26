import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../env';
import { HttpError } from '../erros';
import { soAdmin } from '../middleware/auth';

export const PASTA_UPLOADS = path.resolve(__dirname, '..', '..', 'uploads');
fs.mkdirSync(PASTA_UPLOADS, { recursive: true });

const EXTENSOES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, ficheiro, cb) => {
    if (EXTENSOES[ficheiro.mimetype]) cb(null, true);
    else cb(new HttpError(400, 'Só são aceites imagens JPG, PNG, WEBP ou GIF.'));
  },
});

export const uploadRouter = Router();

/**
 * Recebe o campo "imagem" e devolve { url }.
 * Com CLOUDINARY_URL definido vai para o Cloudinary (recomendado no Render, cujo disco é apagado a cada deploy);
 * sem ele, guarda em server/uploads e devolve um caminho relativo (/uploads/…).
 */
uploadRouter.post('/', soAdmin, upload.single('imagem'), async (req, res) => {
  const ficheiro = req.file;
  if (!ficheiro) throw new HttpError(400, 'Nenhuma imagem enviada (campo "imagem").');

  if (env.CLOUDINARY_URL) {
    const resultado = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: 'a-mesa', resource_type: 'image' }, (erro, r) => {
          if (erro || !r) reject(erro ?? new Error('Upload falhou'));
          else resolve(r);
        })
        .end(ficheiro.buffer);
    });
    res.status(201).json({ url: resultado.secure_url });
    return;
  }

  const nome = crypto.randomBytes(12).toString('hex') + EXTENSOES[ficheiro.mimetype];
  await fs.promises.writeFile(path.join(PASTA_UPLOADS, nome), ficheiro.buffer);
  res.status(201).json({ url: `/uploads/${nome}` });
});
