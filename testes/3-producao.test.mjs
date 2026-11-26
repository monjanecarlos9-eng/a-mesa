// Modo produção (base de dados vazia): configuração inicial, CORS e ataques distribuídos.
import { API_PROD, cliente, ok, terminar } from './util.mjs';

const api = cliente(API_PROD);
const CODIGO = process.env.CODIGO_CONFIGURACAO;
// Em produção o servidor está atrás de 1 proxy e lê o IP do X-Forwarded-For: simulamos IPs diferentes.
const deIp = (n) => ({ 'X-Forwarded-For': `198.51.100.${n}` });

let r = await api('/auth/configuracao');
ok(r.d.primeiraConta === true && r.d.exigeCodigo === true, 'base de dados vazia: a 1.ª conta exige código de configuração');

const dona = { nome: 'Dona Rosa', email: 'rosa@tasca.pt', password: 'Primeira123' };
r = await api('/auth/registar', { method: 'POST', body: dona });
ok(r.s === 403, 'sem código, um desconhecido NÃO consegue ficar admin');
r = await api('/auth/registar', { method: 'POST', body: { ...dona, codigo: 'adivinha' } });
ok(r.s === 403, 'com código errado também não');
r = await api('/auth/registar', { method: 'POST', body: { ...dona, codigo: CODIGO } });
ok(r.s === 201 && r.d.utilizador?.papel === 'admin', 'com o código certo, a dona fica admin');
const tokenDona = r.d.token;

r = await api('/auth/configuracao');
ok(r.d.primeiraConta === false && r.d.exigeCodigo === false, 'depois disso já não há "primeira conta"');
r = await api('/auth/registar', { method: 'POST', body: { nome: 'Rui', email: 'rui@tasca.pt', password: 'Segunda123', codigo: CODIGO } });
ok(r.s === 201 && r.d.pendente === true, 'as contas seguintes ficam pendentes, mesmo com o código');

// CORS
let h = await fetch(API_PROD + '/api/menu', { headers: { Origin: 'https://tasca.exemplo.pt' } });
ok(h.headers.get('access-control-allow-origin') === 'https://tasca.exemplo.pt', 'CORS: o site oficial pode usar a API');
h = await fetch(API_PROD + '/api/menu', { headers: { Origin: 'https://site-malicioso.com' } });
ok(!h.headers.get('access-control-allow-origin'), 'CORS: outros sites não');
ok(!!h.headers.get('strict-transport-security'), 'HSTS (obriga a HTTPS)');

// Ataque distribuído: muitos IPs diferentes contra a mesma conta
let bloqueada = false;
let tentativas = 0;
for (let i = 0; i < 25 && !bloqueada; i++) {
  tentativas++;
  bloqueada = (await api('/auth/login', { method: 'POST', body: { email: dona.email, password: 'errada' + i }, headers: deIp(i + 1) })).s === 429;
}
ok(bloqueada && tentativas > 10, `ataque de muitos IPs à mesma conta é travado (${tentativas} tentativas)`);
r = await api('/auth/login', { method: 'POST', body: { email: 'rui@tasca.pt', password: 'Segunda123' }, headers: deIp(200) });
ok(r.s === 403, 'as outras contas não ficam bloqueadas (o Rui só está pendente)');
ok((await api('/utilizadores', { token: tokenDona })).s === 200, 'a sessão já aberta da dona continua a funcionar');

// Erros não revelam detalhes internos
r = await api('/pedidos/abc?token=x');
ok(r.s === 400 && !JSON.stringify(r.d).includes('prisma') && !JSON.stringify(r.d).includes('at '), 'mensagens de erro sem detalhes internos');

terminar();
