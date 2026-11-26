// Funcionalidades principais: menu, pedidos em tempo real, cozinha, administração, idiomas, pagamento.
import { API_DEV, cliente, esperar, esperarQue, io, ok, pausa, terminar } from './util.mjs';

const api = cliente(API_DEV);
const login = async (email, password) => (await api('/auth/login', { method: 'POST', body: { email, password } })).d?.token;

const admin = await login('admin@tascadoze.pt', 'admin123');
const coz = await login('cozinha@tascadoze.pt', 'cozinha123');
const A = admin;
const C = coz;
ok(admin && coz, 'login do admin e da cozinha');

// Mesa e menu
const mesas = (await api('/mesas', { token: A })).d;
const token = mesas[0].qrToken;
ok((await api('/mesas/' + token)).d.numero === 1, 'o QR da mesa 1 abre a mesa 1');
ok((await api('/mesas/nao-existe')).s === 404, 'QR inválido → 404');
const menu = (await api('/menu')).d;
const pratos = menu.flatMap((c) => c.pratos);
ok(menu.length === 6 && pratos.length === 20, `menu: ${menu.length} categorias, ${pratos.length} pratos`);
ok(menu.every((c) => c.nomeEn) && pratos.every((p) => p.nomeEn), 'menu tem tradução inglesa');
ok(pratos.some((p) => p.vegetariano) && pratos.some((p) => p.semGluten) && pratos.some((p) => p.alergenios.length), 'menu tem vegetariano, sem glúten e alergénios');
ok(!pratos.some((p) => p.semGluten && p.alergenios.includes('gluten')), 'dados coerentes: nenhum "sem glúten" tem glúten');

const esgotado = pratos.find((p) => !p.disponivel);
const [p1, p2] = pratos.filter((p) => p.disponivel);

// Ligações em tempo real
const cozinha = io(API_DEV, { auth: { token: C } });
const telemovel = io(API_DEV);
const curioso = io(API_DEV);
await Promise.all([esperar(cozinha, 'connect'), esperar(telemovel, 'connect'), esperar(curioso, 'connect')]);
let curiosoViu = false;
curioso.on('novo_pedido', () => (curiosoViu = true));
curioso.on('estado_atualizado', () => (curiosoViu = true));

// Pedidos
let r = await api('/pedidos', { method: 'POST', body: { token, itens: [{ pratoId: esgotado.id, quantidade: 1 }] } });
ok(r.s === 409, 'pedir prato esgotado → 409');
ok((await api('/pedidos', { method: 'POST', body: { token, itens: [] } })).s === 400, 'carrinho vazio → 400');
r = await api('/pedidos', { method: 'POST', body: { token, itens: [{ pratoId: p1.id, quantidade: 1, precoUnitario: 0.01 }] } });
ok(r.s === 201 && r.d.total === p1.preco, 'o preço vem da base de dados (o cliente não o consegue mudar)');

const pedidosRecebidos = [];
cozinha.on('novo_pedido', (x) => pedidosRecebidos.push(x));
r = await api('/pedidos', {
  method: 'POST',
  body: { token, itens: [{ pratoId: p1.id, quantidade: 2, observacoes: 'sem cebola' }, { pratoId: p2.id, quantidade: 1 }] },
});
const esperado = Math.round((p1.preco * 2 + p2.preco) * 100) / 100;
ok(r.s === 201 && r.d.total === esperado, `pedido criado com total ${r.d.total} €`);
const pedido = r.d;
const recebido = pedidosRecebidos.find((x) => x.id === pedido.id) ?? (await esperarQue(cozinha, 'novo_pedido', (x) => x.id === pedido.id));
ok(recebido.id === pedido.id && recebido.itens[0].observacoes === 'sem cebola', 'a cozinha recebe o pedido ao vivo, com as observações');

telemovel.emit('seguir_pedido', { pedidoId: pedido.id, token });
await pausa(300);
ok((await api(`/pedidos/${pedido.id}?token=errado`)).s === 404, 'ver pedido com o QR de outra mesa → 404');
ok((await api(`/pedidos/${pedido.id}?token=${token}`)).d.estado === 'pendente', 'o cliente vê o pedido "pendente"');

const mudou = esperarQue(telemovel, 'estado_atualizado', (x) => x.id === pedido.id && x.estado === 'em_preparacao');
r = await api(`/pedidos/${pedido.id}/estado`, { method: 'PATCH', token: C, body: { estado: 'em_preparacao' } });
ok(r.s === 200 && (await mudou).estado === 'em_preparacao', 'a cozinha muda o estado e o telemóvel vê-o ao vivo');
ok((await api(`/pedidos/${pedido.id}/estado`, { method: 'PATCH', token: C, body: { estado: 'xpto' } })).s === 400, 'estado inválido → 400');
ok((await api('/pedidos?estado=em_preparacao', { token: C })).d.some((p) => p.id === pedido.id), 'filtro ?estado= da cozinha');

// Preço guardado no item
const menuMudou = esperar(telemovel, 'menu_atualizado');
await api(`/pratos/${p1.id}`, { method: 'PUT', token: A, body: { preco: p1.preco + 5 } });
await menuMudou;
ok(true, 'mudar um preço atualiza os menus abertos (menu_atualizado)');
const depois = (await api(`/pedidos/${pedido.id}?token=${token}`)).d;
ok(depois.total === esperado && depois.itens[0].precoUnitario === p1.preco, 'pedidos antigos mantêm o preço da altura');
await api(`/pratos/${p1.id}`, { method: 'PUT', token: A, body: { preco: p1.preco } });

// Chamar empregado
const chamada = esperar(cozinha, 'chamar_empregado');
await api(`/mesas/${token}/chamar`, { method: 'POST' });
ok((await chamada).mesa.numero === 1, '"Chamar empregado" chega à cozinha');

// Pagamento simulado
ok((await api(`/pedidos/${pedido.id}/pagar`, { method: 'POST', body: { token: 'errado', metodo: 'mbway' } })).s === 404, 'pagar com QR errado → 404');
ok((await api(`/pedidos/${pedido.id}/pagar`, { method: 'POST', body: { token, metodo: 'bitcoin' } })).s === 400, 'método de pagamento inválido → 400');
ok(
  (await api(`/pedidos/${pedido.id}/pagar`, { method: 'POST', body: { token, metodo: 'cartao', numero: '4242424242424242' } })).s === 400,
  'o servidor recusa receber dados de cartão',
);
const pago = esperarQue(cozinha, 'estado_atualizado', (x) => x.id === pedido.id && !!x.pagoEm);
r = await api(`/pedidos/${pedido.id}/pagar`, { method: 'POST', body: { token, metodo: 'mbway' } });
ok(r.s === 200 && r.d.metodoPagamento === 'mbway' && (await pago).pagoEm, 'pagamento MB WAY simulado e a cozinha vê "pago"');
ok((await api(`/pedidos/${pedido.id}/pagar`, { method: 'POST', body: { token, metodo: 'cartao' } })).s === 409, 'não se paga duas vezes → 409');

// Administração
const cat = (await api('/categorias', { method: 'POST', token: A, body: { nome: 'Teste', nomeEn: 'Test' } })).d;
ok(cat.nomeEn === 'Test', 'criar categoria com nome em inglês');
r = await api('/pratos', {
  method: 'POST',
  token: A,
  body: { categoriaId: cat.id, nome: 'Bolo teste', nomeEn: 'Test cake', preco: 2, vegetariano: true, alergenios: ['ovos', 'leite', 'ovos'] },
});
ok(r.s === 201 && r.d.alergenios.length === 2, 'criar prato com alergénios (sem repetidos)');
const bolo = r.d;
r = await api(`/pratos/${bolo.id}`, { method: 'PUT', token: A, body: { preco: 2.5 } });
ok(r.d.preco === 2.5 && r.d.vegetariano && r.d.alergenios.length === 2 && r.d.nomeEn === 'Test cake', 'editar só o preço não apaga o resto');
ok((await api(`/categorias/${cat.id}`, { method: 'DELETE', token: A })).s === 409, 'não se apaga uma categoria com pratos');
ok((await api(`/pratos/${bolo.id}`, { method: 'DELETE', token: A })).s === 204, 'apagar prato');
ok((await api(`/categorias/${cat.id}`, { method: 'DELETE', token: A })).s === 204, 'apagar categoria');
ok((await api(`/pratos/${p1.id}`, { method: 'DELETE', token: A })).s === 409, 'não se apaga um prato que já foi pedido');

const m = (await api('/mesas', { method: 'POST', token: A, body: { numero: 99 } })).d;
const m2 = (await api(`/mesas/${m.id}/regenerar`, { method: 'POST', token: A })).d;
ok(m2.qrToken !== m.qrToken, 'gerar novo QR para uma mesa');
ok((await api(`/mesas/${m.qrToken}`)).s === 404, 'o QR antigo deixa de funcionar');
ok((await api('/mesas', { method: 'POST', token: A, body: { numero: 99 } })).s === 409, 'mesa repetida → 409');
ok((await api(`/mesas/${m.id}`, { method: 'DELETE', token: A })).s === 204, 'apagar mesa');

const est = (await api('/estatisticas', { token: A })).d;
ok(est.hoje.pedidos >= 2 && est.topPratos.length > 0 && est.ultimos7Dias.length === 7 && est.hoje.pagoOnline > 0, 'estatísticas de vendas');

ok(!curiosoViu, 'um estranho ligado ao Socket.IO não vê pedidos da cozinha nem de outras mesas');
[cozinha, telemovel, curioso].forEach((s) => s.disconnect());
terminar();
