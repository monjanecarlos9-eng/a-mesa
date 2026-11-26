import { PrismaClient, Prisma, EstadoPedido } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const prisma = new PrismaClient();

type Extra = { en: string; descEn: string; veg?: boolean; sg?: boolean; alerg?: string[] };
type ItemMenu = [nome: string, descricao: string, preco: number, extra: Extra];

const CATEGORIAS_EN: Record<string, string> = {
  Entradas: 'Starters',
  'Pratos de carne': 'Meat dishes',
  'Pratos de peixe': 'Fish dishes',
  Vegetariano: 'Vegetarian',
  Sobremesas: 'Desserts',
  Bebidas: 'Drinks',
};

const MENU: Record<string, ItemMenu[]> = {
  Entradas: [
    ['Pão, manteiga e azeitonas', 'Pão caseiro do forno a lenha com azeitonas temperadas.', 2.5, { en: 'Bread, butter and olives', descEn: 'Homemade wood-fired bread with seasoned olives.', veg: true, alerg: ['gluten', 'leite'] }],
    ['Caldo verde', 'Couve galega, batata e rodela de chouriço.', 3.5, { en: 'Caldo verde (kale soup)', descEn: 'Kale, potato and a slice of chouriço sausage.', sg: true }],
    ['Pica-pau', 'Novilho salteado em molho de cerveja com pickles.', 8.9, { en: 'Pica-pau beef', descEn: 'Sautéed beef in a beer sauce with pickles.', alerg: ['gluten', 'sulfitos', 'mostarda'] }],
    ['Queijo da Serra amanteigado', 'Servido com tostas e doce de abóbora.', 9.5, { en: 'Serra da Estrela cheese', descEn: 'Creamy sheep cheese with toasts and pumpkin jam.', veg: true, alerg: ['leite', 'gluten'] }],
  ],
  'Pratos de carne': [
    ['Bitoque', 'Bife de vaca com ovo estrelado, batata frita e salada.', 11.5, { en: 'Bitoque steak', descEn: 'Beef steak with fried egg, chips and salad.', sg: true, alerg: ['ovos'] }],
    ['Francesinha', 'Com o nosso molho picante da casa e batata frita.', 12.9, { en: 'Francesinha', descEn: 'Porto’s famous sandwich with our spicy house sauce and chips.', alerg: ['gluten', 'leite', 'ovos', 'sulfitos'] }],
    ['Secretos de porco preto', 'Grelhados, com migas de espargos.', 14.5, { en: 'Black pork “secretos”', descEn: 'Grilled Iberian pork with asparagus migas.', alerg: ['gluten'] }],
  ],
  'Pratos de peixe': [
    ['Bacalhau à Brás', 'Bacalhau desfiado, batata palha, ovo e azeitonas.', 13.5, { en: 'Bacalhau à Brás', descEn: 'Shredded salt cod with matchstick potatoes, egg and olives.', sg: true, alerg: ['peixe', 'ovos'] }],
    ['Polvo à lagareiro', 'Polvo assado com batata a murro e muito azeite.', 18.0, { en: 'Roasted octopus', descEn: 'Oven-roasted octopus with punched potatoes and olive oil.', sg: true, alerg: ['moluscos'] }],
    ['Sardinhas assadas', 'Seis sardinhas com pimentos e batata cozida.', 11.0, { en: 'Grilled sardines', descEn: 'Six sardines with peppers and boiled potatoes.', sg: true, alerg: ['peixe'] }],
  ],
  Vegetariano: [
    ['Grão com espinafres', 'Estufado de grão, espinafres e ovo escalfado.', 9.5, { en: 'Chickpeas with spinach', descEn: 'Chickpea and spinach stew with a poached egg.', veg: true, sg: true, alerg: ['ovos'] }],
    ['Arroz de legumes da horta', 'Arroz malandrinho com legumes da época.', 9.0, { en: 'Garden vegetable rice', descEn: 'Soupy rice with seasonal vegetables.', veg: true, sg: true, alerg: ['aipo'] }],
  ],
  Sobremesas: [
    ['Pastel de nata', 'Acabado de sair do forno, com canela.', 1.8, { en: 'Custard tart', descEn: 'Fresh from the oven, with cinnamon.', veg: true, alerg: ['gluten', 'leite', 'ovos'] }],
    ['Arroz doce', 'Receita da avó, com canela.', 3.5, { en: 'Rice pudding', descEn: 'Grandma’s recipe, with cinnamon.', veg: true, sg: true, alerg: ['leite', 'ovos'] }],
    ['Baba de camelo', 'Doce de leite condensado com amêndoa.', 3.8, { en: '“Camel drool” mousse', descEn: 'Condensed-milk caramel mousse with almonds.', veg: true, sg: true, alerg: ['leite', 'ovos', 'frutos_casca_rija'] }],
  ],
  Bebidas: [
    ['Água 50 cl', 'Natural ou fresca.', 1.5, { en: 'Water 50 cl', descEn: 'Room temperature or chilled.', veg: true, sg: true }],
    ['Sumo de laranja natural', 'Espremido na hora.', 3.0, { en: 'Fresh orange juice', descEn: 'Freshly squeezed.', veg: true, sg: true }],
    ['Vinho verde (copo)', 'Branco, fresco.', 3.5, { en: 'Vinho verde (glass)', descEn: 'Chilled white wine.', veg: true, sg: true, alerg: ['sulfitos'] }],
    ['Imperial', 'Cerveja de pressão 20 cl.', 2.0, { en: 'Draught beer', descEn: '20 cl draught beer.', veg: true, alerg: ['gluten'] }],
    ['Café', 'Expresso.', 0.9, { en: 'Coffee', descEn: 'Espresso.', veg: true, sg: true }],
  ],
};

const extras = (e: Extra) => ({
  nomeEn: e.en,
  descricaoEn: e.descEn,
  vegetariano: !!e.veg,
  semGluten: !!e.sg,
  alergenios: e.alerg ?? [],
});

async function main() {
  // Contas de demonstração: só em desenvolvimento.
  // Em produção não se criam contas com senhas conhecidas — a primeira conta registada no site fica admin.
  // SEED_DEMO=1 força os dados de demonstração (usado no docker compose, que é só para correr localmente).
  const producao = process.env.NODE_ENV === 'production' && process.env.SEED_DEMO !== '1';
  const utilizadores = producao
    ? []
    : [
        { nome: 'Zé (Admin)', email: 'admin@tascadoze.pt', password: 'admin123', papel: 'admin' as const },
        { nome: 'Cozinha', email: 'cozinha@tascadoze.pt', password: 'cozinha123', papel: 'cozinha' as const },
      ];
  for (const u of utilizadores) {
    const passwordHash = await bcrypt.hash(u.password, 12);
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
          nomeEn: CATEGORIAS_EN[categoria],
          pratos: { create: pratos.map(([nome, descricao, preco, e]) => ({ nome, descricao, preco, ...extras(e) })) },
        },
      });
    }
    // Um esgotado para mostrar na apresentação
    await prisma.prato.updateMany({ where: { nome: 'Secretos de porco preto' }, data: { disponivel: false } });
  } else {
    // Bases de dados criadas por versões anteriores: acrescenta traduções e alergénios sem mexer no resto.
    for (const [categoria, pratos] of Object.entries(MENU)) {
      await prisma.categoria.updateMany({ where: { nome: categoria, nomeEn: null }, data: { nomeEn: CATEGORIAS_EN[categoria] } });
      for (const [nome, , , e] of pratos) {
        await prisma.prato.updateMany({ where: { nome, nomeEn: null }, data: extras(e) });
      }
    }
  }

  // Histórico de pedidos dos últimos 7 dias (para o painel de estatísticas ter dados)
  if (!producao && (await prisma.pedido.count()) === 0) {
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
  if (producao) {
    console.log('   Sem contas de demonstração (produção). Cria a primeira conta no site: fica admin.');
  } else {
    console.log('   Admin:   admin@tascadoze.pt / admin123');
    console.log('   Cozinha: cozinha@tascadoze.pt / cozinha123');
  }
  for (const m of mesas) console.log(`   Mesa ${m.numero}: /mesa/${m.qrToken}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
