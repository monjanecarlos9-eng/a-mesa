import { PrismaClient, Prisma, EstadoPedido } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const prisma = new PrismaClient();

const MENU: Record<string, [nome: string, descricao: string, preco: number][]> = {
  Entradas: [
    ['Pão, manteiga e azeitonas', 'Pão caseiro do forno a lenha com azeitonas temperadas.', 2.5],
    ['Caldo verde', 'Couve galega, batata e rodela de chouriço.', 3.5],
    ['Pica-pau', 'Novilho salteado em molho de cerveja com pickles.', 8.9],
    ['Queijo da Serra amanteigado', 'Servido com tostas e doce de abóbora.', 9.5],
  ],
  'Pratos de carne': [
    ['Bitoque', 'Bife de vaca com ovo estrelado, batata frita e salada.', 11.5],
    ['Francesinha', 'Com o nosso molho picante da casa e batata frita.', 12.9],
    ['Secretos de porco preto', 'Grelhados, com migas de espargos.', 14.5],
  ],
  'Pratos de peixe': [
    ['Bacalhau à Brás', 'Bacalhau desfiado, batata palha, ovo e azeitonas.', 13.5],
    ['Polvo à lagareiro', 'Polvo assado com batata a murro e muito azeite.', 18.0],
    ['Sardinhas assadas', 'Seis sardinhas com pimentos e batata cozida.', 11.0],
  ],
  Vegetariano: [
    ['Grão com espinafres', 'Estufado de grão, espinafres e ovo escalfado.', 9.5],
    ['Arroz de legumes da horta', 'Arroz malandrinho com legumes da época.', 9.0],
  ],
  Sobremesas: [
    ['Pastel de nata', 'Acabado de sair do forno, com canela.', 1.8],
    ['Arroz doce', 'Receita da avó, com canela.', 3.5],
    ['Baba de camelo', 'Doce de leite condensado com amêndoa.', 3.8],
  ],
  Bebidas: [
    ['Água 50 cl', 'Natural ou fresca.', 1.5],
    ['Sumo de laranja natural', 'Espremido na hora.', 3.0],
    ['Vinho verde (copo)', 'Branco, fresco.', 3.5],
    ['Imperial', 'Cerveja de pressão 20 cl.', 2.0],
    ['Café', 'Expresso.', 0.9],
  ],
};

async function main() {
  // Utilizadores (password igual sempre que se corre o seed)
  const utilizadores = [
    { nome: 'Zé (Admin)', email: 'admin@tascadoze.pt', password: 'admin123', papel: 'admin' as const },
    { nome: 'Cozinha', email: 'cozinha@tascadoze.pt', password: 'cozinha123', papel: 'cozinha' as const },
  ];
  for (const u of utilizadores) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.utilizador.upsert({
      where: { email: u.email },
      update: { nome: u.nome, passwordHash, papel: u.papel },
      create: { nome: u.nome, email: u.email, passwordHash, papel: u.papel },
    });
  }

  // Mesas 1–10 (o token só é gerado na criação, para os QR impressos continuarem válidos)
  for (let numero = 1; numero <= 10; numero++) {
    await prisma.mesa.upsert({
      where: { numero },
      update: {},
      create: { numero, qrToken: crypto.randomBytes(9).toString('base64url') },
    });
  }

  // Menu (só se ainda não houver categorias)
  if ((await prisma.categoria.count()) === 0) {
    let ordem = 0;
    for (const [categoria, pratos] of Object.entries(MENU)) {
      await prisma.categoria.create({
        data: {
          nome: categoria,
          ordem: ordem++,
          pratos: { create: pratos.map(([nome, descricao, preco]) => ({ nome, descricao, preco })) },
        },
      });
    }
    // Um esgotado para mostrar na apresentação
    await prisma.prato.updateMany({ where: { nome: 'Secretos de porco preto' }, data: { disponivel: false } });
  }

  // Histórico de pedidos dos últimos 7 dias (para o painel de estatísticas ter dados)
  if ((await prisma.pedido.count()) === 0) {
    const pratos = await prisma.prato.findMany({ where: { disponivel: true } });
    const mesas = await prisma.mesa.findMany();
    const aleatorio = <T,>(lista: T[]) => lista[Math.floor(Math.random() * lista.length)];

    for (let diasAtras = 6; diasAtras >= 1; diasAtras--) {
      const nPedidos = 6 + Math.floor(Math.random() * 10);
      for (let n = 0; n < nPedidos; n++) {
        const criadoEm = new Date();
        criadoEm.setDate(criadoEm.getDate() - diasAtras);
        criadoEm.setHours(12 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0);

        const itens = Array.from({ length: 1 + Math.floor(Math.random() * 4) }, () => {
          const prato = aleatorio(pratos);
          return { pratoId: prato.id, quantidade: 1 + Math.floor(Math.random() * 2), precoUnitario: prato.preco };
        });
        const total = itens.reduce((s, i) => s.plus(i.precoUnitario.times(i.quantidade)), new Prisma.Decimal(0));

        await prisma.pedido.create({
          data: {
            mesaId: aleatorio(mesas).id,
            estado: EstadoPedido.entregue,
            criadoEm,
            total,
            itens: { create: itens },
          },
        });
      }
    }
  }

  const mesas = await prisma.mesa.findMany({ orderBy: { numero: 'asc' }, take: 3 });
  console.log('✅ Dados de exemplo prontos.');
  console.log('   Admin:   admin@tascadoze.pt / admin123');
  console.log('   Cozinha: cozinha@tascadoze.pt / cozinha123');
  for (const m of mesas) console.log(`   Mesa ${m.numero}: /mesa/${m.qrToken}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
