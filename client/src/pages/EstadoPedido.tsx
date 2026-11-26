import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { api, mensagemErro } from '../lib/api';
import { criarSocket } from '../lib/socket';
import { formatarHora, formatarPreco } from '../lib/formatar';
import { pedidosLocais } from '../lib/mesaLocal';
import { BotaoIdioma, useIdioma, type ChaveTexto } from '../lib/idioma';
import { ESTADOS, indiceEstado, type Pedido } from '../tipos';
import { Logo } from '../components/Logo';
import { BotaoTema } from '../components/BotaoTema';
import { Modal } from '../components/Modal';
import { Rodape } from '../components/Rodape';
import { cvvValido, luhnValido, telemovelValido, validadeValida } from '../lib/pagamento';

const EMOJIS: Record<Pedido['estado'], string> = { pendente: '📨', em_preparacao: '👨‍🍳', pronto: '🛎️', entregue: '😋' };

export default function EstadoPedido() {
  const { token = '' } = useParams();
  const { t, traduzir } = useIdioma();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [aCarregar, setACarregar] = useState(true);
  const [ligado, setLigado] = useState(true);
  const [aPagar, setAPagar] = useState<Pedido | null>(null);

  useEffect(() => {
    const ids = pedidosLocais.ler(token);

    const carregar = () =>
      Promise.all(ids.map((id) => api<Pedido>(`/pedidos/${id}?token=${encodeURIComponent(token)}`).catch(() => null)))
        .then((r) => setPedidos(r.filter((p): p is Pedido => !!p).sort((a, b) => b.id - a.id)))
        .catch((e) => setErro(mensagemErro(e)))
        .finally(() => setACarregar(false));

    const socket = criarSocket();
    socket.on('connect', () => {
      setLigado(true);
      ids.forEach((pedidoId) => socket.emit('seguir_pedido', { pedidoId, token }));
      carregar(); // ao (re)ligar, sincroniza o que possa ter mudado entretanto
    });
    socket.on('disconnect', () => setLigado(false));
    socket.on('estado_atualizado', (p: Pedido) => {
      setPedidos((lista) => lista.map((x) => (x.id === p.id ? p : x)));
      if (p.estado === 'pronto' && 'vibrate' in navigator) navigator.vibrate?.([200, 100, 200]);
    });
    return () => {
      socket.disconnect();
    };
  }, [token]);

  return (
    <div className="min-h-screen pb-10">
      <header className="border-b border-stone-200 dark:border-stone-800">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Logo pequeno />
          <div className="flex items-center gap-1">
            <BotaoIdioma />
            <BotaoTema />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4">
        <div className="my-5 flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-bold">{t('osSeusPedidos')}</h1>
          <span className={`flex items-center gap-1.5 text-xs ${ligado ? 'text-emerald-600' : 'text-amber-600'}`}>
            <span className={`h-2 w-2 rounded-full ${ligado ? 'animate-pulse bg-emerald-500' : 'bg-amber-500'}`} />
            {ligado ? t('aoVivo') : t('aReligar')}
          </span>
        </div>

        {aCarregar && <p className="text-stone-500">{t('aCarregar')}</p>}
        {erro && <p className="text-red-600">{erro}</p>}
        {!aCarregar && pedidos.length === 0 && <p className="py-10 text-center text-stone-500">{t('semPedidos')}</p>}

        <div className="space-y-4">
          {pedidos.map((p) => {
            const atual = indiceEstado(p.estado);
            return (
              <article key={p.id} className="cartao p-5">
                <p className="text-sm text-stone-500">
                  {t('pedido')} #{p.id} · {t('mesa')} {p.mesa.numero} · {formatarHora(p.criadoEm)}
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {EMOJIS[p.estado]} {t(`msg_${p.estado}` as ChaveTexto)}
                </p>

                <ol className="mt-5 grid grid-cols-4 gap-1.5" aria-label="Progresso">
                  {ESTADOS.map((e, i) => (
                    <li key={e.valor} className="text-center">
                      <div className={`h-2 rounded-full transition-colors duration-500 ${i <= atual ? e.cor : 'bg-stone-200 dark:bg-stone-800'}`} />
                      <span className={`mt-1.5 block text-[11px] sm:text-xs ${i === atual ? 'font-bold' : 'text-stone-500'}`}>{t(`estado_${e.valor}` as ChaveTexto)}</span>
                    </li>
                  ))}
                </ol>

                <ul className="mt-5 space-y-1 border-t border-stone-200 pt-4 text-sm dark:border-stone-800">
                  {p.itens.map((i) => (
                    <li key={i.id} className="flex justify-between gap-3">
                      <span>
                        {i.quantidade}× {traduzir(i.nome, i.nomeEn)}
                        {i.observacoes && <span className="italic text-stone-500"> — “{i.observacoes}”</span>}
                      </span>
                      <span className="tabular-nums text-stone-500">{formatarPreco(i.precoUnitario * i.quantidade)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="font-bold">
                    {t('total')}: {formatarPreco(p.total)}
                  </span>
                  {p.pagoEm ? (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                      {t('pago')} · {p.metodoPagamento === 'mbway' ? 'MB WAY' : t('cartao')}
                    </span>
                  ) : (
                    <button className="botao-primario py-2!" onClick={() => setAPagar(p)}>
                      {t('pagar')}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <Link to={`/mesa/${token}`} className="botao-secundario mt-6 w-full py-3.5! text-base">
          {t('voltarMenu')}
        </Link>
        <Rodape />
      </main>

      <Modal aberto={!!aPagar} aoFechar={() => setAPagar(null)} titulo={`${t('pagarPedido')} #${aPagar?.id ?? ''}`}>
        {aPagar && (
          <Pagamento
            pedido={aPagar}
            token={token}
            aoPagar={(p) => {
              setPedidos((l) => l.map((x) => (x.id === p.id ? p : x)));
              setAPagar(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

// ---------- Pagamento simulado ----------

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * O pagamento é SIMULADO: os dados do cartão / telemóvel só são validados aqui no browser
 * e nunca são enviados para o servidor — só vai o método escolhido.
 */
function Pagamento({ pedido, token, aoPagar }: { pedido: Pedido; token: string; aoPagar: (p: Pedido) => void }) {
  const { t } = useIdioma();
  const [metodo, setMetodo] = useState<'mbway' | 'cartao'>('mbway');
  const [telefone, setTelefone] = useState('');
  const [cartao, setCartao] = useState('');
  const [validade, setValidade] = useState('');
  const [cvv, setCvv] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [fase, setFase] = useState<'form' | 'aguardar' | 'feito'>('form');

  async function submeter(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (metodo === 'mbway' && !telemovelValido(telefone)) return setErro(t('telemovelInvalido'));
    if (metodo === 'cartao') {
      if (!luhnValido(cartao)) return setErro(t('cartaoInvalido'));
      if (!validadeValida(validade)) return setErro(t('validadeInvalida'));
      if (!cvvValido(cvv)) return setErro(t('cvvInvalido'));
    }
    setFase('aguardar');
    try {
      await esperar(metodo === 'mbway' ? 2500 : 1500); // simula a confirmação na app / no banco
      const p = await api<Pedido>(`/pedidos/${pedido.id}/pagar`, { method: 'POST', json: { token, metodo } });
      setFase('feito');
      await esperar(1200);
      aoPagar(p);
    } catch (err) {
      setErro(mensagemErro(err));
      setFase('form');
    }
  }

  if (fase === 'feito') {
    return (
      <div className="py-6 text-center">
        <p className="text-5xl">✅</p>
        <p className="mt-3 font-semibold">{t('pagamentoConcluido')}</p>
      </div>
    );
  }

  const separador = (ativo: boolean) =>
    `flex-1 rounded-xl border-2 px-3 py-3 text-sm font-bold transition ${ativo ? 'border-tasca-600 bg-tasca-50 dark:bg-tasca-900/30' : 'border-stone-200 dark:border-stone-700'}`;

  return (
    <form onSubmit={submeter}>
      <p className="mb-4 text-center text-3xl font-black tabular-nums">{formatarPreco(pedido.total)}</p>

      <div className="mb-4 flex gap-2" role="tablist">
        <button type="button" role="tab" aria-selected={metodo === 'mbway'} className={separador(metodo === 'mbway')} onClick={() => setMetodo('mbway')}>
          <span className="text-red-600">MB</span> WAY
        </button>
        <button type="button" role="tab" aria-selected={metodo === 'cartao'} className={separador(metodo === 'cartao')} onClick={() => setMetodo('cartao')}>
          💳 {t('cartao')}
        </button>
      </div>

      {fase === 'aguardar' ? (
        <div className="py-6 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-stone-200 border-t-tasca-600" />
          <p className="mt-3 text-sm text-stone-600 dark:text-stone-300">{metodo === 'mbway' ? t('aguardarMbway') : t('aProcessar')}</p>
        </div>
      ) : (
        <>
          {metodo === 'mbway' ? (
            <div>
              <label htmlFor="tel" className="text-sm font-medium">
                {t('telemovel')}
              </label>
              <div className="mt-1 flex">
                <span className="flex items-center rounded-l-xl border border-r-0 border-stone-300 bg-stone-100 px-3 text-sm dark:border-stone-700 dark:bg-stone-800">+351</span>
                <input id="tel" inputMode="numeric" autoComplete="off" maxLength={11} placeholder="912 345 678" className="campo rounded-l-none!" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label htmlFor="cc" className="text-sm font-medium">
                  {t('numeroCartao')}
                </label>
                <input
                  id="cc"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={23}
                  placeholder="4242 4242 4242 4242"
                  className="campo mt-1 font-mono"
                  value={cartao}
                  onChange={(e) =>
                    setCartao(
                      e.target.value
                        .replace(/\D/g, '')
                        .slice(0, 19)
                        .replace(/(\d{4})(?=\d)/g, '$1 '),
                    )
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="val" className="text-sm font-medium">
                    {t('validade')}
                  </label>
                  <input
                    id="val"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={5}
                    placeholder="12/29"
                    className="campo mt-1 font-mono"
                    value={validade}
                    onChange={(e) => {
                      const d = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setValidade(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="cvv" className="text-sm font-medium">
                    CVV
                  </label>
                  <input id="cvv" inputMode="numeric" autoComplete="off" maxLength={4} placeholder="123" className="campo mt-1 font-mono" value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))} />
                </div>
              </div>
            </div>
          )}

          {erro && (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
              {erro}
            </p>
          )}
          <button type="submit" className="botao-primario mt-5 w-full py-3.5! text-base">
            {t('pagarValor')} {formatarPreco(pedido.total)}
          </button>
        </>
      )}
      <p className="mt-3 rounded-lg bg-amber-50 p-2 text-center text-xs text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">🧪 {t('simulado')}</p>
    </form>
  );
}
