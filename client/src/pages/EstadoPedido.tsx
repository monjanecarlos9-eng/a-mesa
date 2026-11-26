import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api, mensagemErro } from '../lib/api';
import { criarSocket } from '../lib/socket';
import { formatarHora, formatarPreco } from '../lib/formatar';
import { pedidosLocais } from '../lib/mesaLocal';
import { ESTADOS, indiceEstado, type Pedido } from '../tipos';
import { Logo } from '../components/Logo';
import { BotaoTema } from '../components/BotaoTema';

const MENSAGENS: Record<Pedido['estado'], { emoji: string; texto: string }> = {
  pendente: { emoji: '📨', texto: 'A cozinha recebeu o seu pedido.' },
  em_preparacao: { emoji: '👨‍🍳', texto: 'Já estamos a preparar!' },
  pronto: { emoji: '🛎️', texto: 'Está pronto — vai já para a mesa.' },
  entregue: { emoji: '😋', texto: 'Bom apetite!' },
};

export default function EstadoPedido() {
  const { token = '' } = useParams();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [aCarregar, setACarregar] = useState(true);
  const [ligado, setLigado] = useState(true);

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
          <BotaoTema />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4">
        <div className="my-5 flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-bold">Os seus pedidos</h1>
          <span className={`flex items-center gap-1.5 text-xs ${ligado ? 'text-emerald-600' : 'text-amber-600'}`}>
            <span className={`h-2 w-2 rounded-full ${ligado ? 'animate-pulse bg-emerald-500' : 'bg-amber-500'}`} />
            {ligado ? 'Ao vivo' : 'A religar…'}
          </span>
        </div>

        {aCarregar && <p className="text-stone-500">A carregar…</p>}
        {erro && <p className="text-red-600">{erro}</p>}
        {!aCarregar && pedidos.length === 0 && <p className="py-10 text-center text-stone-500">Ainda não fez nenhum pedido nesta mesa.</p>}

        <div className="space-y-4">
          {pedidos.map((p) => {
            const atual = indiceEstado(p.estado);
            return (
              <article key={p.id} className="cartao p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-stone-500">
                      Pedido #{p.id} · Mesa {p.mesa.numero} · {formatarHora(p.criadoEm)}
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {MENSAGENS[p.estado].emoji} {MENSAGENS[p.estado].texto}
                    </p>
                  </div>
                </div>

                <ol className="mt-5 grid grid-cols-4 gap-1.5" aria-label="Progresso do pedido">
                  {ESTADOS.map((e, i) => (
                    <li key={e.valor} className="text-center">
                      <div className={`h-2 rounded-full transition-colors duration-500 ${i <= atual ? e.cor : 'bg-stone-200 dark:bg-stone-800'}`} />
                      <span className={`mt-1.5 block text-[11px] sm:text-xs ${i === atual ? 'font-bold' : 'text-stone-500'}`}>{e.rotulo}</span>
                    </li>
                  ))}
                </ol>

                <ul className="mt-5 space-y-1 border-t border-stone-200 pt-4 text-sm dark:border-stone-800">
                  {p.itens.map((i) => (
                    <li key={i.id} className="flex justify-between gap-3">
                      <span>
                        {i.quantidade}× {i.nome}
                        {i.observacoes && <span className="italic text-stone-500"> — “{i.observacoes}”</span>}
                      </span>
                      <span className="tabular-nums text-stone-500">{formatarPreco(i.precoUnitario * i.quantidade)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 flex justify-between font-bold">
                  <span>Total</span>
                  <span>{formatarPreco(p.total)}</span>
                </p>
              </article>
            );
          })}
        </div>

        <Link to={`/mesa/${token}`} className="botao-primario mt-6 w-full py-3.5! text-base">
          ← Voltar ao menu / pedir mais
        </Link>
      </main>
    </div>
  );
}
