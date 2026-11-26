import { env } from './env';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { iniciarSocket } from './socket';
import { tratarErros } from './erros';
import { authRouter } from './routes/auth';
import { menuRouter } from './routes/menu';
import { mesasRouter } from './routes/mesas';
import { pedidosRouter } from './routes/pedidos';
import { pratosRouter } from './routes/pratos';
import { categoriasRouter } from './routes/categorias';
import { estatisticasRouter } from './routes/estatisticas';
import { uploadRouter, PASTA_UPLOADS } from './routes/upload';

const origens = env.FRONTEND_URL ? env.FRONTEND_URL.split(',').map((o) => o.trim().replace(/\/$/, '')) : true;

const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: origens }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(PASTA_UPLOADS, { maxAge: '7d' }));

app.get('/api/saude', (_req, res) => {
  res.json({ ok: true });
});
app.use('/api/auth', authRouter);
app.use('/api/menu', menuRouter);
app.use('/api/mesas', mesasRouter);
app.use('/api/pedidos', pedidosRouter);
app.use('/api/pratos', pratosRouter);
app.use('/api/categorias', categoriasRouter);
app.use('/api/estatisticas', estatisticasRouter);
app.use('/api/upload', uploadRouter);
app.use('/api', (_req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});
app.use(tratarErros);

const servidor = http.createServer(app);
iniciarSocket(servidor, origens);

servidor.listen(env.PORT, () => {
  console.log(`🍽️  API do À Mesa a correr em http://localhost:${env.PORT}`);
});
