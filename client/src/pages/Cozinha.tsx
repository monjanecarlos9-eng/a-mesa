import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api, mensagemErro } from '../lib/api';
import { useAuth } from '../lib/auth';
import { criarSocket } from '../lib/socket';
import { formatarHora, formatarPreco, haQuantoTempo } from '../lib/formatar';
import { ativarSom, tocarAviso } from '../lib/som';
import { ESTADOS, indiceEstado, type Estado, type Pedido } from '../tipos';
import { Logo } from '../components/Logo';
import { BotaoTema } from '../components/BotaoTema';
import { useAvisos } from '../components/Aviso';
import { Modal } from '../components/Modal';
import { MudarSenha } from './AdminEquipa';

const MAX_ENTREGUES = 12;

const CORES_COLUNA: Record<Estado, string> = {
  pendente: 'border-t-amber-500',
  em_preparacao: 'border-t-sky-500',
  pronto: 'border-t-emerald-500',
  entregue: 'border-t-stone-400',
};

interface Chamada {
  mesa: { id: number; numero: number };
  em: string;
}

export default function Cozinha() {
  const { token, utilizador, sair } = useAuth();
  const navegar = useNavigate();
  const { mostrar, elemento: avisos } = useAvisos();

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [ligado, setLigado] = useState(false);
  const [somAtivo, setSomAtivo] = useState(false);
  const [novos, setNovos] = useState<Set<number>>(new Set());
  const [chamadas, setChamadas] = useState<Chamada[]>([]);
  const [agora, setAgora] = useState(Date.now());
  const [contaAberta, setContaAberta] = useState(false);
  const somRef = useRef(false);
  somRef.current = somAtivo;

  const carregar = useCallback(() => {
    api<Pedido[]>('/pedidos')
      .then(setPedidos)
      .catch((e) => mostrar(mensagemErro(e), 'erro'));
  }, [mostrar]);

  useEffect(() => {
    const socket = criarSocket(token);
    socket.on('connect', () => {
      setLigado(true);
      carregar(); // ressincroniza depois de uma quebra de ligação
    });
    socket.on('disconnect', (motivo) => {
      setLigado(false);
      // O servidor cortou a ligação de propósito (conta suspensa, papel ou senha alterados).
      // Confirma a sessão: se já não for válida, a api() termina a sessão e volta ao login.
      if (motivo === 'io server disconnect') {
        api('/auth/eu')
          .then(() => socket.connect())
          .catch(() => {});
      }
    });
    socket.on('novo_pedido', (p: Pedido) => {
      setPedidos((lista) => (lista.some((x) => x.id === p.id) ? lista : [...lista, p]));
      setNovos((s) => new Set(s).add(p.id));
      setTimeout(() => setNovos((s) => {
        const n = new Set(s);
        n.delete(p.id);
        return n;
      }), 8000);
      if (somRef.current) tocarAviso();
    });
    socket.on('estado_atualizado', (p: Pedido) => setPedidos((lista) => lista.map((x) => (x.id === p.id ? p : x))));
    socket.on('chamar_empregado', (c: Chamada) => {
      setChamadas((lista) => [...lista.filter((x) => x.mesa.id !== c.mesa.id), c]);
      if (somRef.current) tocarAviso([660, 660, 660]);
    });
    return () => {
      socket.disconnect();
    };
  }, [token, carregar]);

  // Atualiza o "há X min" a cada 30 s
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  async function mudarEstado(p: Pedido, estado: Estado) {
    const anterior = p.estado;
    setPedidos((l) => l.map((x) => (x.id === p.id ? { ...x, estado } : x))); // otimista
    try {
      await api(`/pedidos/${p.id}/estado`, { method: 'PATCH', json: { estado } });
    } catch (e) {
      setPedidos((l) => l.map((x) => (x.id === p.id ? { ...x, estado: anterior } : x)));
      mostrar(mensagemErro(e), 'erro');
    }
  }

  async function alternarSom() {
    if (somAtivo) return setSomAtivo(false);
    const ok = await ativarSom();
    setSomAtivo(ok);
    if (ok) tocarAviso();
  }

  return (
    <div className="flex min-h-screen flex-col">
      {avisos}
      <header className="border-b border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <Logo pequeno />
          <h1 className="font-display text-xl font-bold text-stone-500">· Cozinha</h1>
          <span className={`flex items-center gap-1.5 text-xs font-medium ${ligado ? 'text-emerald-600' : 'text-red-600'}`}>
            <span className={`h-2 w-2 rounded-full ${ligado ? 'animate-pulse bg-emerald-500' : 'bg-red-500'}`} />
            {ligado ? 'Ao vivo' : 'Sem ligação'}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={alternarSom} className={somAtivo ? 'botao-secundario py-1.5!' : 'botao-primario animate-pulse py-1.5!'}>
              {somAtivo ? '🔔 Som ligado' : '🔕 Ativar som'}
            </button>
            {utilizador?.papel === 'admin' && (
              <Link to="/admin/pratos" className="botao-secundario py-1.5!">
                Admin
              </Link>
            )}
            <button className="botao-secundario py-1.5!" onClick={() => setContaAberta(true)} title="Mudar a palavra-passe">
              👤 {utilizador?.nome}
            </button>
            <BotaoTema />
            <button
              className="botao-secundario py-1.5!"
              onClick={() => {
                sair();
                navegar('/login');
              }}
            >
              Sair
            </button>
          </div>
        </div>

        {chamadas.length > 0 && (
          <div className="flex flex-wrap gap-2 bg-amber-100 px-4 py-2 dark:bg-amber-950">
            {chamadas.map((c) => (
              <button
                key={c.mesa.id}
                onClick={() => setChamadas((l) => l.filter((x) => x.mesa.id !== c.mesa.id))}
                className="animar-entrada flex items-center gap-2 rounded-full bg-amber-500 px-3 py-1 text-sm font-bold text-white hover:bg-amber-600"
                title="Clicar quando a mesa for atendida"
              >
                🙋 Mesa {c.mesa.numero} chamou às {formatarHora(c.em)} <span aria-hidden>✓</span>
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="grid flex-1 gap-3 overflow-x-auto p-3 md:grid-cols-2 xl:grid-cols-4">
        {ESTADOS.map((coluna) => {
          let lista = pedidos.filter((p) => p.estado === coluna.valor);
          if (coluna.valor === 'entregue') lista = lista.slice(-MAX_ENTREGUES).reverse();
          return (
            <section key={coluna.valor} className={`flex min-h-48 flex-col rounded-2xl border-t-4 bg-stone-100 dark:bg-stone-900/60 ${CORES_COLUNA[coluna.valor]}`}>
              <h2 className="flex items-center justify-between px-3 py-2.5 font-bold">
                {coluna.rotulo}
                <span className="rounded-full bg-white px-2 py-0.5 text-sm tabular-nums dark:bg-stone-800">{lista.length}</span>
              </h2>
              <div className="flex flex-1 flex-col gap-2.5 px-2.5 pb-2.5">
                {lista.map((p) => (
                  <CartaoPedido key={p.id} pedido={p} novo={novos.has(p.id)} agora={agora} aoMudar={mudarEstado} />
                ))}
                {lista.length === 0 && <p className="py-6 text-center text-sm text-stone-400">Nada por aqui</p>}
              </div>
            </section>
          );
        })}
      </main>

      <Modal aberto={contaAberta} aoFechar={() => setContaAberta(false)} titulo="A minha conta">
        <MudarSenha
          aoErro={(m) => mostrar(m, 'erro')}
          aoSucesso={() => {
            setContaAberta(false);
            mostrar('Palavra-passe alterada. As outras sessões foram terminadas.', 'sucesso', 5000);
          }}
        />
      </Modal>
    </div>
  );
}

function CartaoPedido({ pedido: p, novo, agora, aoMudar }: { pedido: Pedido; novo: boolean; agora: number; aoMudar: (p: Pedido, e: Estado) => void }) {
  const i = indiceEstado(p.estado);
  const seguinte = ESTADOS[i + 1];
  const anterior = ESTADOS[i - 1];
  const minutos = (agora - new Date(p.criadoEm).getTime()) / 60000;
  const atrasado = p.estado !== 'entregue' && p.estado !== 'pronto' && minutos > 20;

  return (
    <article
      className={`cartao p-3 ${novo ? 'animar-entrada ring-4 ring-amber-400' : ''} ${atrasado ? 'border-red-400 dark:border-red-700' : ''} ${
        p.estado === 'entregue' ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl font-black">Mesa {p.mesa.numero}</span>
        <span className="text-xs text-stone-500">#{p.id}</span>
      </div>
      <p className={`text-xs ${atrasado ? 'font-bold text-red-600' : 'text-stone-500'}`}>
        {formatarHora(p.criadoEm)} · {haQuantoTempo(p.criadoEm, agora)}
        {novo && <span className="ml-2 rounded bg-amber-400 px-1.5 font-bold text-amber-950">NOVO</span>}
        {p.pagoEm && <span className="ml-2 rounded bg-emerald-100 px-1.5 font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">💳 PAGO</span>}
      </p>

      <ul className="my-2.5 space-y-1">
        {p.itens.map((item) => (
          <li key={item.id} className="leading-snug">
            <span className="font-bold tabular-nums">{item.quantidade}×</span> {item.nome}
            {item.observacoes && (
              <span className="mt-0.5 block rounded bg-amber-100 px-1.5 py-0.5 text-sm font-semibold text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
                ⚠ {item.observacoes}
              </span>
            )}
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2">
        {anterior && (
          <button onClick={() => aoMudar(p, anterior.valor)} className="botao-secundario px-3!" title={`Voltar a "${anterior.rotulo}"`} aria-label={`Voltar a ${anterior.rotulo}`}>
            ←
          </button>
        )}
        {seguinte ? (
          <button onClick={() => aoMudar(p, seguinte.valor)} className="botao-primario flex-1">
            {seguinte.acao} →
          </button>
        ) : (
          <span className="flex-1 text-right text-sm text-stone-500">{formatarPreco(p.total)}</span>
        )}
      </div>
    </article>
  );
}
