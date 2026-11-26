import 'dotenv/config';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('Define a variável JWT_SECRET em produção.');
}

export const env = {
  PORT: Number(process.env.PORT ?? 3000),
  JWT_SECRET: JWT_SECRET ?? 'segredo-so-para-desenvolvimento',
  /** Origens autorizadas (CORS), separadas por vírgulas. Vazio = aceita qualquer origem (dev). */
  FRONTEND_URL: process.env.FRONTEND_URL ?? '',
  /** Se definido (cloudinary://key:secret@cloud), as imagens vão para o Cloudinary. */
  CLOUDINARY_URL: process.env.CLOUDINARY_URL ?? '',
};
