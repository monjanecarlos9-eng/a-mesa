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

function assinaturaValida(b: Buffer, tipo: string): boolean {
  const comeca = (...bytes: number[]) => bytes.every((v, i) => b[i] === v);
  switch (tipo) {
    case 'image/jpeg':
      return comeca(0xff, 0xd8, 0xff);
    case 'image/png':
      return comeca(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case 'image/gif':
      return b.subarray(0, 6).toString('ascii').startsWith('GIF8');
    case 'image/webp':
      return b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP';
    default:
      return false;
  }
}

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
  // O tipo indicado pelo browser pode ser falsificado: confirma pelos primeiros bytes do ficheiro.
  if (!assinaturaValida(ficheiro.buffer, ficheiro.mimetype)) {
    throw new HttpError(400, 'O ficheiro não é uma imagem válida.');
  }

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
