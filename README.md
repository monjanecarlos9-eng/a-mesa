# À Mesa — pedidos por QR code 🍽️

Sistema de pedidos para restaurantes, demonstrado com o restaurante fictício **Tasca do Zé**.
O cliente lê o QR code da mesa, escolhe os pratos e envia o pedido. A cozinha vê-o chegar ao vivo
e, quando muda o estado, o cliente vê a mudança no telemóvel.

## Funcionalidades

**Cliente (sem login)**
- QR code da mesa → menu dessa mesa (`/mesa/:token`)
- Pratos por categoria, com foto, preço, descrição e indicação de "esgotado"
- Carrinho com quantidades e observações ("sem cebola"), guardado no telemóvel
- Envio do pedido e acompanhamento do estado em tempo real (`/mesa/:token/pedido`)
- Botão **"Chamar empregado"**
- O menu atualiza-se sozinho quando o admin muda um preço ou esgota um prato

**Cozinha (com login)**
- Painel ao vivo em colunas: Pendente → Em preparação → Pronto → Entregue
- Muda o estado com um clique (com botão para recuar, caso haja engano)
- Aviso sonoro para pedidos novos e para chamadas de empregado
- Destaque das observações e dos pedidos com mais de 20 min

**Administração (com login)**
- Criar, editar, apagar e ordenar categorias; criar, editar e apagar pratos; marcar como esgotado
- Upload de fotos (Cloudinary ou disco local) ou URL de imagem
- Gerir mesas, gerar QR codes, descarregar em PNG e **imprimir todos**
- Painel de vendas: faturação do dia, últimos 7 dias, pratos mais pedidos

**Extras incluídos:** chamar empregado, painel de vendas, modo escuro.
**Ainda por fazer:** alergénios e filtros, menu em inglês, pagamento simulado.

## Tecnologias

| Parte | Ferramenta |
|---|---|
| Front-end | React 19 + TypeScript (Vite), React Router 7, Tailwind CSS 4 |
| Back-end | Node.js + Express 5 + TypeScript, validação com Zod |
| Base de dados | PostgreSQL com Prisma 6 |
| Tempo real | Socket.IO |
| Login | JWT + bcrypt (`bcryptjs`, a mesma cifra em JavaScript puro, sem compilação no Windows) |
| QR codes | `qrcode` |
| Imagens | Cloudinary, ou Multer para o disco local |
| Deploy | Vercel (front-end) + Render (back-end e base de dados) |

## Estrutura

```
server/
  prisma/schema.prisma      modelo de dados (utilizadores, categorias, pratos, mesas, pedidos, itens_pedido)
  prisma/migrations/        migração SQL inicial
  prisma/seed.ts            dados de exemplo da Tasca do Zé
  src/index.ts              arranque do Express + Socket.IO
  src/socket.ts             salas e eventos em tempo real
  src/routes/               auth, menu, mesas, pedidos, pratos, categorias, estatisticas, upload
client/
  src/pages/                MenuMesa, EstadoPedido, Login, Cozinha, AdminPratos, AdminMesas, AdminEstatisticas
  src/components/           Modal, AdminLayout, ImagemPrato, …
  src/lib/                  api, socket, auth, som, carrinho local
render.yaml                 blueprint de deploy no Render
```

## Correr localmente

Precisas do **Node.js 20+** e de um **PostgreSQL** (local, ou grátis no [Neon](https://neon.tech) ou no Render).

```bash
# 1. Back-end
cd server
npm install
cp .env.example .env          # edita DATABASE_URL e JWT_SECRET
npx prisma migrate deploy     # cria as tabelas
npm run db:seed               # menu, mesas e utilizadores de exemplo
npm run dev                   # http://localhost:3000

# 2. Front-end (noutro terminal)
cd client
npm install
npm run dev                   # http://localhost:5173
```

> Com npm 11, se aparecer um aviso `allow-scripts` durante o `npm install`, as aprovações
> necessárias (Prisma e esbuild) já estão em `server/package.json`. Se for preciso, corre `npm rebuild`.

> Se a porta 3000 já estiver ocupada: `PORT=3001 npm run dev` no servidor e
> `API_PROXY=http://localhost:3001 npm run dev` no cliente.

**Contas de exemplo**

| Papel | Email | Palavra-passe |
|---|---|---|
| Admin | admin@tascadoze.pt | admin123 |
| Cozinha | cozinha@tascadoze.pt | cozinha123 |

O seed imprime no terminal os links das primeiras mesas. Também os encontras em **Admin → Mesas e QR**.

### Testar com o telemóvel

1. Liga o PC e o telemóvel à mesma rede Wi-Fi.
2. O `npm run dev` do cliente mostra um endereço "Network", por exemplo `http://192.168.1.20:5173`.
3. Em **Admin → Mesas e QR**, põe esse endereço no campo "Endereço usado nos QR codes".
4. Lê o QR code com o telemóvel. O Vite reencaminha a API e o Socket.IO para o back-end, por isso tudo funciona.

## API

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/api/auth/login` | público | devolve `{ token, utilizador }` |
| GET | `/api/menu` | público | categorias com pratos |
| GET | `/api/mesas/:token` | público | confirma a mesa |
| POST | `/api/mesas/:token/chamar` | público | chama o empregado → `chamar_empregado` |
| POST | `/api/pedidos` | público | cria o pedido → `novo_pedido` |
| GET | `/api/pedidos/:id?token=` | público, com token da mesa | estado de um pedido |
| GET | `/api/pedidos?estado=` | cozinha/admin | pedidos das últimas 24 h |
| PATCH | `/api/pedidos/:id/estado` | cozinha/admin | muda o estado → `estado_atualizado` |
| CRUD | `/api/pratos`, `/api/categorias`, `/api/mesas` | admin | gestão; alterações ao menu → `menu_atualizado` |
| PATCH | `/api/pratos/:id/disponivel` | admin | esgotado / disponível |
| POST | `/api/mesas/:id/regenerar` | admin | novo QR (o antigo deixa de funcionar) |
| POST | `/api/upload` | admin | campo `imagem` → `{ url }` |
| GET | `/api/estatisticas` | admin | vendas |

**Decisões importantes**
- Os preços vêm **sempre da base de dados**. O cliente só envia IDs e quantidades, por isso não consegue alterar preços.
- Cada item guarda o `preco_unitario`. Se o preço de um prato mudar, os pedidos antigos não mudam.
- Um prato que já foi pedido não pode ser apagado, para não estragar o histórico. Marca-o como esgotado.
- O cliente só recebe atualizações do seu pedido: só entra na sala do Socket.IO se o token da mesa corresponder.

## Deploy

**Back-end e base de dados (Render)**
1. Põe o projeto no GitHub.
2. No Render: **New → Blueprint** e escolhe o repositório. O `render.yaml` cria a base de dados e a API.
3. Define `FRONTEND_URL` (o URL do Vercel) e, de preferência, `CLOUDINARY_URL`. O disco do Render apaga-se a cada deploy, por isso as imagens locais perdem-se.
4. Depois do primeiro deploy, abre a **Shell** do serviço e corre `npm run db:seed`.

**Front-end (Vercel)**
1. **Add New → Project**, escolhe o repositório e define o **Root Directory** como `client`.
2. Variável de ambiente: `VITE_API_URL=https://a-mesa-api.onrender.com` (o URL do Render).
3. O `vercel.json` trata das rotas da SPA (ex.: abrir `/mesa/abc` diretamente).

> O plano grátis do Render adormece ao fim de 15 min sem uso. Abre o site uns minutos antes da apresentação.

## Guião da apresentação

1. Projeta o QR code de uma mesa (**Admin → Mesas e QR → Abrir**, ou imprime-o) e pede a alguém do júri para fazer um pedido.
2. Tem a **cozinha** aberta noutro ecrã, com o **som ativado**. O pedido aparece com aviso sonoro.
3. Avança o pedido na cozinha. O telemóvel do júri mostra "Em preparação…" e depois "Pronto".
4. Carrega em **"Chamar empregado"** no telemóvel. A cozinha recebe o alerta.
5. Fecha com o **admin**: muda um preço ou esgota um prato, e o menu no telemóvel atualiza-se logo, sem recarregar.
6. Mostra o painel de **Vendas**.
