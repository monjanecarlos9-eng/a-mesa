import { env } from './env';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { iniciarSocket } from './socket';
import { tratarErros } from './erros';
import { prisma } from './prisma';
import { limites } from './seguranca';
import { emailConfigurado } from './email';
import { authRouter } from './routes/auth';
import { menuRouter } from './routes/menu';
import { mesasRouter } from './routes/mesas';
import { pedidosRouter } from './routes/pedidos';
import { pratosRouter } from './routes/pratos';
import { categoriasRouter } from './routes/categorias';
import { estatisticasRouter } from './routes/estatisticas';
import { utilizadoresRouter } from './routes/utilizadores';
import { uploadRouter, PASTA_UPLOADS } from './routes/upload';

// Em desenvolvimento aceita qualquer origem (para testar pelo telemóvel na rede local).
const origens: string[] | boolean = env.ORIGENS.length ? env.ORIGENS : true;

const app = express();
// Atrás do proxy do Render o IP real vem em X-Forwarded-For. Sem proxy (local), ignora esse cabeçalho.
app.set('trust proxy', env.TRUST_PROXY);
app.disable('x-powered-by');
app.use(
  helmet({
    // A API só devolve JSON e imagens; as imagens têm de poder ser mostradas pelo site (outra origem).
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], imgSrc: ["'self'"], frameAncestors: ["'none'"] } },
  }),
);
app.use(cors({ origin: origens, maxAge: 600 }));
app.use(express.json({ limit: '100kb' }));
app.use('/uploads', express.static(PASTA_UPLOADS, { maxAge: '7d', index: false, dotfiles: 'deny' }));

app.get('/api/saude', (_req, res) => {
  res.json({ ok: true });
});
app.use('/api', limites.geral);
app.use('/api/auth', authRouter);
app.use('/api/menu', menuRouter);
app.use('/api/mesas', mesasRouter);
app.use('/api/pedidos', pedidosRouter);
app.use('/api/pratos', pratosRouter);
app.use('/api/categorias', categoriasRouter);
app.use('/api/estatisticas', estatisticasRouter);
app.use('/api/utilizadores', utilizadoresRouter);
app.use('/api/upload', uploadRouter);
app.use('/api', (_req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});
app.use(tratarErros);

const servidor = http.createServer(app);
iniciarSocket(servidor, origens);

servidor.listen(env.PORT, () => {
  console.log(`🍽️  API do À Mesa a correr em http://localhost:${env.PORT}`);
  if (!emailConfigurado) {
    console.log(
      env.producao
        ? '   ⚠ SMTP_URL não definido: os emails de recuperação não são enviados (o admin pode gerar links em Equipa).'
        : '   (sem SMTP_URL: os emails de recuperação de senha aparecem aqui na consola)',
    );
  }
});

// Encerramento limpo (o Render envia SIGTERM a cada deploy)
for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sinal, () => {
    servidor.close(() => {
      prisma.$disconnect().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
