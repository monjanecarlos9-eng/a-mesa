// Segurança: permissões, contas, sessões, uploads, ataques comuns.
import { API_DEV, cliente, esperar, io, ok, pausa, terminar } from './util.mjs';

const api = cliente(API_DEV);
const login = (email, password, headers) => api('/auth/login', { method: 'POST', body: { email, password }, headers });
const admin = (await login('admin@tascadoze.pt', 'admin123')).d.token;
const coz = (await login('cozinha@tascadoze.pt', 'cozinha123')).d.token;

// Cabeçalhos
const r0 = await fetch(API_DEV + '/api/menu');
ok(r0.headers.get('x-content-type-options') === 'nosniff', 'Helmet: X-Content-Type-Options');
ok(!r0.headers.get('x-powered-by'), 'não revela que é Express (sem X-Powered-By)');
ok(!!r0.headers.get('content-security-policy'), 'Content-Security-Policy na API');

// Permissões
ok((await api('/pedidos')).s === 401, 'sem login não se veem os pedidos');
ok((await api('/pratos', { token: coz })).s === 403, 'a cozinha não mexe no menu');
ok((await api('/utilizadores', { token: coz })).s === 403, 'a cozinha não gere a equipa');
ok((await api('/estatisticas', { token: coz })).s === 403, 'a cozinha não vê as vendas');

// JWT forjado
const [h, p, s] = admin.split('.');
const falso = Buffer.from(JSON.stringify({ sub: '1', v: 0, exp: 9999999999 })).toString('base64url');
ok((await api('/utilizadores', { token: `${h}.${falso}.${s}` })).s === 401, 'token alterado à mão → 401');
const semAssinatura = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
ok((await api('/utilizadores', { token: `${semAssinatura}.${p}.` })).s === 401, 'token sem assinatura (alg=none) → 401');

// Logout (terminar sessão no servidor)
const sessaoA = (await login('cozinha@tascadoze.pt', 'cozinha123')).d.token;
const sessaoB = (await login('cozinha@tascadoze.pt', 'cozinha123')).d.token;
ok((await api('/auth/sair', { method: 'POST', token: sessaoA })).s === 204, 'logout → 204');
ok((await api('/auth/eu', { token: sessaoA })).s === 401, 'depois do logout, o token deixa de ser aceite (mesmo que tenha sido copiado)');
ok((await api('/auth/eu', { token: sessaoB })).s === 200, 'o logout num aparelho não termina as outras sessões da conta');
ok((await api('/auth/sair', { method: 'POST' })).s === 401, 'logout sem sessão → 401');

// Criar conta
const email = `ana${Date.now()}@teste.pt`;
ok((await api('/auth/registar', { method: 'POST', body: { nome: 'Ana', email, password: 'curta' } })).s === 400, 'senha curta recusada');
ok((await api('/auth/registar', { method: 'POST', body: { nome: 'Ana', email, password: 'semnumeros' } })).s === 400, 'senha sem números recusada');
let r = await api('/auth/registar', { method: 'POST', body: { nome: 'Ana', email, password: 'Segura123', papel: 'admin', aprovado: true } });
ok(r.s === 201 && r.d.pendente === true && !r.d.token, 'conta nova fica pendente (não dá para se pôr admin)');
ok((await api('/auth/registar', { method: 'POST', body: { nome: 'Ana', email, password: 'Segura123' } })).s === 409, 'email repetido → 409');
ok((await login(email, 'Segura123')).s === 403, 'conta pendente não entra');

const ana = (await api('/utilizadores', { token: admin })).d.find((u) => u.email === email);
ok(ana && !('passwordHash' in ana), 'a lista da equipa nunca mostra o hash da senha');
await api(`/utilizadores/${ana.id}`, { method: 'PATCH', token: admin, body: { aprovado: true, papel: 'cozinha' } });
let anaTok = (await login(email, 'Segura123')).d.token;
ok((await api('/pedidos', { token: anaTok })).s === 200, 'depois de aprovada, entra como cozinha');

// Sessões cortadas na hora (também no Socket.IO)
const socket = io(API_DEV, { auth: { token: anaTok } });
await esperar(socket, 'connect');
await pausa(300);
let recebeuDepois = false;
const cortado = esperar(socket, 'disconnect');
await api(`/utilizadores/${ana.id}`, { method: 'PATCH', token: admin, body: { aprovado: false } });
ok((await cortado) === 'io server disconnect', 'suspender a conta corta logo a ligação em tempo real');
socket.on('novo_pedido', () => (recebeuDepois = true));
ok((await api('/pedidos', { token: anaTok })).s === 401, 'suspender a conta termina a sessão');
socket.connect(); // tenta voltar com o token antigo
await pausa(500);
const mesa = (await api('/mesas', { token: admin })).d[0];
const prato = (await api('/menu')).d[0].pratos.find((x) => x.disponivel);
await api('/pedidos', { method: 'POST', body: { token: mesa.qrToken, itens: [{ pratoId: prato.id, quantidade: 1 }] } });
await pausa(500);
ok(!recebeuDepois, 'religar com o token antigo já não recebe pedidos');
socket.disconnect();

await api(`/utilizadores/${ana.id}`, { method: 'PATCH', token: admin, body: { aprovado: true } });
anaTok = (await login(email, 'Segura123')).d.token;
await api(`/utilizadores/${ana.id}`, { method: 'PATCH', token: admin, body: { papel: 'admin' } });
ok((await api('/pedidos', { token: anaTok })).s === 401, 'mudar o papel termina a sessão antiga');

// Recuperar senha
r = await api('/auth/recuperar', { method: 'POST', body: { email } });
const r2 = await api('/auth/recuperar', { method: 'POST', body: { email: 'ninguem@teste.pt' } });
ok(r.s === 200 && r.d.mensagem === r2.d.mensagem, 'recuperar senha não revela se o email existe');
anaTok = (await login(email, 'Segura123')).d.token;
const { link } = (await api(`/utilizadores/${ana.id}/link-recuperacao`, { method: 'POST', token: admin })).d;
const tokenRec = link.split('/redefinir-senha/')[1];
ok(tokenRec.length >= 40, 'link de recuperação com token longo');
ok((await api('/auth/redefinir/um-token-inventado-mas-comprido')).s === 400, 'link inventado → 400');
ok((await api('/auth/redefinir', { method: 'POST', body: { token: tokenRec, password: 'fraca' } })).s === 400, 'nova senha fraca recusada');
ok((await api('/auth/redefinir', { method: 'POST', body: { token: tokenRec, password: 'NovaSenha456' } })).s === 200, 'redefinir a senha');
ok((await api('/pedidos', { token: anaTok })).s === 401, 'redefinir termina as sessões abertas');
ok((await api('/auth/redefinir', { method: 'POST', body: { token: tokenRec, password: 'Outra78901' } })).s === 400, 'o link só funciona uma vez');
ok((await login(email, 'Segura123')).s === 401, 'a senha antiga deixa de funcionar');
anaTok = (await login(email, 'NovaSenha456')).d.token;
ok(!!anaTok, 'a nova senha funciona');

r = await api('/auth/alterar-senha', { method: 'POST', token: anaTok, body: { atual: 'NovaSenha456', nova: 'Outra12345' } });
ok(r.s === 200 && (await api('/pedidos', { token: r.d.token })).s === 200, 'mudar a própria senha dá um token novo');
ok((await api('/pedidos', { token: anaTok })).s === 401, 'e o token anterior deixa de valer');

// Proteções da equipa
const eu = (await api('/utilizadores', { token: admin })).d.find((u) => u.email === 'admin@tascadoze.pt');
ok((await api(`/utilizadores/${eu.id}`, { method: 'DELETE', token: admin })).s === 409, 'o admin não se pode apagar a si próprio');
await api(`/utilizadores/${ana.id}`, { method: 'DELETE', token: admin });
ok((await api(`/utilizadores/${eu.id}`, { method: 'PATCH', token: admin, body: { papel: 'cozinha' } })).s === 409, 'nunca se fica sem nenhum admin');

// Uploads e conteúdo perigoso
const fd = new FormData();
fd.append('imagem', new Blob(['<html><script>alert(1)</script></html>'], { type: 'image/png' }), 'x.png');
r = await fetch(API_DEV + '/api/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + admin }, body: fd });
ok(r.status === 400, 'upload: página HTML disfarçada de PNG é recusada');
const svg = new FormData();
svg.append('imagem', new Blob(['<svg onload="alert(1)"/>'], { type: 'image/svg+xml' }), 'x.svg');
r = await fetch(API_DEV + '/api/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + admin }, body: svg });
ok(r.status === 400, 'upload: SVG (pode ter código) é recusado');
const cat = (await api('/categorias', { token: admin })).d[0];
r = await api('/pratos', { method: 'POST', token: admin, body: { categoriaId: cat.id, nome: 'X', preco: 1, imagemUrl: 'javascript:alert(1)' } });
ok(r.s === 400, 'URL de imagem "javascript:" recusado');
r = await api('/pratos', { method: 'POST', token: admin, body: { categoriaId: cat.id, nome: 'X', preco: 1, alergenios: ['veneno'] } });
ok(r.s === 400, 'alergénio inventado recusado');
r = await fetch(API_DEV + '/api/menu', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(200_000) });
ok(r.status === 413, 'pedidos gigantes são recusados (413, sem erro interno)');
ok((await api("/pedidos/1' OR '1'='1?token=x")).s === 400, 'tentativa de SQL injection no ID → 400');

// Limites de tentativas
let ip = false;
for (let i = 0; i < 12 && !ip; i++) ip = (await login('admin@tascadoze.pt', 'errada' + i)).s === 429;
ok(ip, 'muitas senhas erradas → bloqueado (429)');
const falsificado = await login('admin@tascadoze.pt', 'errada', { 'X-Forwarded-For': '203.0.113.' + Math.floor(Math.random() * 250) });
ok(falsificado.s === 429, 'inventar o cabeçalho X-Forwarded-For não fura o bloqueio');
ok((await login('admin@tascadoze.pt', 'admin123')).s === 429, 'durante o bloqueio, nem a senha certa entra deste IP');

terminar();
