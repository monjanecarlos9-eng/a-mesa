import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export type Idioma = 'pt' | 'en';

/** Textos da parte do cliente (menu, pedido, página inicial). A área da equipa fica em português. */
const TEXTOS = {
  carregarMenu: { pt: 'A carregar o menu…', en: 'Loading the menu…' },
  mesa: { pt: 'Mesa', en: 'Table' },
  convidado: { pt: '👀 Convidado', en: '👀 Guest' },
  avisoConvidado: { pt: 'Está a ver o menu como convidado.', en: 'You are browsing the menu as a guest.' },
  avisoConvidado2: { pt: 'Para fazer um pedido, leia o QR code que está na sua mesa.', en: 'To order, scan the QR code on your table.' },
  paraPedir: { pt: '📱 Para pedir, leia o QR code que está na sua mesa.', en: '📱 To order, scan the QR code on your table.' },
  chamarEmpregado: { pt: '🙋 Chamar empregado', en: '🙋 Call a waiter' },
  empregadoChamado: { pt: '🙋 Um empregado vem já à sua mesa.', en: '🙋 A waiter is on the way.' },
  osMeusPedidos: { pt: '🧾 Os meus pedidos', en: '🧾 My orders' },
  menuVazio: { pt: 'O menu ainda está vazio.', en: 'The menu is empty.' },
  semResultados: { pt: 'Nenhum prato corresponde aos filtros.', en: 'No dishes match your filters.' },
  limparFiltros: { pt: 'Limpar filtros', en: 'Clear filters' },
  esgotado: { pt: 'Esgotado', en: 'Sold out' },
  vegetariano: { pt: '🌱 Vegetariano', en: '🌱 Vegetarian' },
  semGluten: { pt: '🌾 Sem glúten', en: '🌾 Gluten free' },
  alergias: { pt: '⚠️ Alergias', en: '⚠️ Allergies' },
  alergiasTitulo: { pt: 'Tenho alergia a…', en: 'I am allergic to…' },
  alergiasAjuda: { pt: 'Escondemos os pratos que contêm o que marcar.', en: 'We will hide dishes that contain what you select.' },
  alergenios: { pt: 'Alergénios', en: 'Allergens' },
  semAlergenios: { pt: 'Sem alergénios declarados.', en: 'No declared allergens.' },
  confirmeEmpregado: { pt: 'Em caso de alergia grave, confirme com o empregado.', en: 'If you have a severe allergy, please check with your waiter.' },
  aplicar: { pt: 'Aplicar', en: 'Apply' },
  adicionado: { pt: 'adicionado', en: 'added' },
  observacoes: { pt: 'Observações', en: 'Notes' },
  opcional: { pt: '(opcional)', en: '(optional)' },
  exemploObs: { pt: 'Ex.: "sem cebola", "bem passado"', en: 'E.g. "no onion", "well done"' },
  adicionar: { pt: 'Adicionar', en: 'Add' },
  verCarrinho: { pt: 'Ver carrinho', en: 'View cart' },
  oSeuPedido: { pt: 'O seu pedido', en: 'Your order' },
  carrinhoVazio: { pt: 'O carrinho está vazio.', en: 'Your cart is empty.' },
  esgotouEntretanto: { pt: 'Esgotou entretanto — remova-o', en: 'Just sold out — please remove it' },
  total: { pt: 'Total', en: 'Total' },
  aEnviar: { pt: 'A enviar…', en: 'Sending…' },
  enviarPedido: { pt: 'Enviar pedido para a cozinha', en: 'Send order to the kitchen' },
  pagamentoNoFim: { pt: 'Pode pagar no telemóvel ou no fim da refeição.', en: 'You can pay on your phone or at the end of the meal.' },
  bemVindo: { pt: 'Bem-vindo!', en: 'Welcome!' },
  leiaQr: { pt: 'Leia o QR code que está na sua mesa para ver o menu e fazer o pedido.', en: 'Scan the QR code on your table to see the menu and order.' },
  verComoConvidado: { pt: '👀 Ver o menu como convidado', en: '👀 Browse the menu as a guest' },
  souEquipa: { pt: 'Sou da equipa', en: 'Staff login' },
  osSeusPedidos: { pt: 'Os seus pedidos', en: 'Your orders' },
  aoVivo: { pt: 'Ao vivo', en: 'Live' },
  aReligar: { pt: 'A religar…', en: 'Reconnecting…' },
  aCarregar: { pt: 'A carregar…', en: 'Loading…' },
  semPedidos: { pt: 'Ainda não fez nenhum pedido nesta mesa.', en: 'You have not ordered at this table yet.' },
  pedido: { pt: 'Pedido', en: 'Order' },
  voltarMenu: { pt: '← Voltar ao menu / pedir mais', en: '← Back to the menu / order more' },
  msg_pendente: { pt: 'A cozinha recebeu o seu pedido.', en: 'The kitchen has received your order.' },
  msg_em_preparacao: { pt: 'Já estamos a preparar!', en: 'We are preparing it!' },
  msg_pronto: { pt: 'Está pronto — vai já para a mesa.', en: 'It is ready — on its way to you.' },
  msg_entregue: { pt: 'Bom apetite!', en: 'Enjoy your meal!' },
  estado_pendente: { pt: 'Pendente', en: 'Received' },
  estado_em_preparacao: { pt: 'Em preparação', en: 'Preparing' },
  estado_pronto: { pt: 'Pronto', en: 'Ready' },
  estado_entregue: { pt: 'Entregue', en: 'Served' },
  pagar: { pt: '💳 Pagar', en: '💳 Pay' },
  pago: { pt: '✅ Pago', en: '✅ Paid' },
  pagarPedido: { pt: 'Pagar pedido', en: 'Pay order' },
  simulado: { pt: 'Pagamento simulado para demonstração — nenhum valor é cobrado e nenhum dado é guardado.', en: 'Simulated payment for demo purposes — nothing is charged and no data is stored.' },
  telemovel: { pt: 'Número de telemóvel', en: 'Mobile number' },
  telemovelInvalido: { pt: 'Indique um número português com 9 dígitos (começa por 9).', en: 'Enter a 9-digit Portuguese mobile number (starts with 9).' },
  aguardarMbway: { pt: 'Confirme o pagamento na app MB WAY…', en: 'Confirm the payment in the MB WAY app…' },
  numeroCartao: { pt: 'Número do cartão', en: 'Card number' },
  validade: { pt: 'Validade (MM/AA)', en: 'Expiry (MM/YY)' },
  cartaoInvalido: { pt: 'Número de cartão inválido.', en: 'Invalid card number.' },
  validadeInvalida: { pt: 'Validade inválida ou expirada.', en: 'Invalid or expired date.' },
  cvvInvalido: { pt: 'CVV inválido.', en: 'Invalid CVV.' },
  aProcessar: { pt: 'A processar…', en: 'Processing…' },
  pagarValor: { pt: 'Pagar', en: 'Pay' },
  pagamentoConcluido: { pt: 'Pagamento concluído. Obrigado!', en: 'Payment complete. Thank you!' },
  cartao: { pt: 'Cartão', en: 'Card' },
} as const;

export type ChaveTexto = keyof typeof TEXTOS;

/** Nomes dos 14 alergénios da UE (os mesmos códigos do servidor). */
export const ALERGENIOS: Record<string, { pt: string; en: string; emoji: string }> = {
  gluten: { pt: 'Glúten', en: 'Gluten', emoji: '🌾' },
  crustaceos: { pt: 'Crustáceos', en: 'Crustaceans', emoji: '🦐' },
  ovos: { pt: 'Ovos', en: 'Eggs', emoji: '🥚' },
  peixe: { pt: 'Peixe', en: 'Fish', emoji: '🐟' },
  amendoins: { pt: 'Amendoins', en: 'Peanuts', emoji: '🥜' },
  soja: { pt: 'Soja', en: 'Soy', emoji: '🫘' },
  leite: { pt: 'Leite', en: 'Milk', emoji: '🥛' },
  frutos_casca_rija: { pt: 'Frutos de casca rija', en: 'Tree nuts', emoji: '🌰' },
  aipo: { pt: 'Aipo', en: 'Celery', emoji: '🥬' },
  mostarda: { pt: 'Mostarda', en: 'Mustard', emoji: '🟡' },
  sesamo: { pt: 'Sésamo', en: 'Sesame', emoji: '⚪' },
  sulfitos: { pt: 'Sulfitos', en: 'Sulphites', emoji: '🍷' },
  tremoco: { pt: 'Tremoço', en: 'Lupin', emoji: '🫛' },
  moluscos: { pt: 'Moluscos', en: 'Molluscs', emoji: '🐙' },
};

interface ContextoIdioma {
  idioma: Idioma;
  alternar: () => void;
  t: (chave: ChaveTexto) => string;
  /** Escolhe o texto em inglês se existir e o idioma for inglês; senão o português. */
  traduzir: (pt: string, en?: string | null) => string;
}

const Contexto = createContext<ContextoIdioma | null>(null);

function idiomaInicial(): Idioma {
  const guardado = localStorage.getItem('idioma');
  if (guardado === 'pt' || guardado === 'en') return guardado;
  return navigator.language?.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

export function IdiomaProvider({ children }: { children: ReactNode }) {
  const [idioma, setIdioma] = useState<Idioma>(idiomaInicial);

  const alternar = useCallback(() => {
    setIdioma((i) => {
      const novo = i === 'pt' ? 'en' : 'pt';
      localStorage.setItem('idioma', novo);
      document.documentElement.lang = novo === 'pt' ? 'pt-PT' : 'en';
      return novo;
    });
  }, []);

  const t = useCallback((chave: ChaveTexto) => TEXTOS[chave][idioma], [idioma]);
  const traduzir = useCallback((pt: string, en?: string | null) => (idioma === 'en' && en ? en : pt), [idioma]);

  return <Contexto.Provider value={{ idioma, alternar, t, traduzir }}>{children}</Contexto.Provider>;
}

export function useIdioma() {
  const c = useContext(Contexto);
  if (!c) throw new Error('useIdioma tem de estar dentro de <IdiomaProvider>');
  return c;
}

export function BotaoIdioma() {
  const { idioma, alternar } = useIdioma();
  return (
    <button
      type="button"
      onClick={alternar}
      className="rounded-full px-2 py-1.5 text-sm font-bold hover:bg-stone-200 dark:hover:bg-stone-800"
      aria-label={idioma === 'pt' ? 'Switch to English' : 'Mudar para português'}
      title={idioma === 'pt' ? 'English' : 'Português'}
    >
      {idioma === 'pt' ? 'EN' : 'PT'}
    </button>
  );
}
