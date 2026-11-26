import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, mensagemErro } from '../lib/api';
import { criarSocket } from '../lib/socket';
import { formatarPreco } from '../lib/formatar';
import { carrinhoLocal, pedidosLocais, type ItemCarrinho } from '../lib/mesaLocal';
import { ALERGENIOS, BotaoIdioma, useIdioma } from '../lib/idioma';
import type { CategoriaMenu, Pedido, Prato } from '../tipos';
import { Logo } from '../components/Logo';
import { BotaoTema } from '../components/BotaoTema';
import { ImagemPrato } from '../components/ImagemPrato';
import { Modal } from '../components/Modal';
import { useAvisos } from '../components/Aviso';
import { Rodape } from '../components/Rodape';

interface Filtros {
  vegetariano: boolean;
  semGluten: boolean;
  evitar: string[]; // códigos de alergénios a excluir
}
const SEM_FILTROS: Filtros = { vegetariano: false, semGluten: false, evitar: [] };

function lerFiltros(): Filtros {
  try {
    return { ...SEM_FILTROS, ...JSON.parse(localStorage.getItem('filtros') ?? '{}') };
  } catch {
    return SEM_FILTROS;
  }
}

/**
 * Menu do cliente. Com `convidado`, é só para consulta (/menu): sem mesa, sem carrinho e sem pedidos.
 * Assim qualquer pessoa pode ver o menu sem conseguir enviar pedidos falsos para a cozinha.
 */
export default function MenuMesa({ convidado = false }: { convidado?: boolean }) {
  const { token = '' } = useParams();
  const navegar = useNavigate();
  const { t, traduzir } = useIdioma();
  const { mostrar, elemento: avisos } = useAvisos();

  const [mesa, setMesa] = useState<{ id: number; numero: number } | null>(null);
  const [menu, setMenu] = useState<CategoriaMenu[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [aCarregar, setACarregar] = useState(true);

  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>(() => (convidado ? [] : carrinhoLocal.ler(token)));
  const [pratoAberto, setPratoAberto] = useState<Prato | null>(null);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const [alergiasAbertas, setAlergiasAbertas] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);
  const [categoriaAtiva, setCategoriaAtiva] = useState<number | null>(null);
  const [filtros, setFiltros] = useState<Filtros>(lerFiltros);
  const temPedidos = !convidado && pedidosLocais.ler(token).length > 0;

  const carregarMenu = useCallback(() => api<CategoriaMenu[]>('/menu').then(setMenu), []);

  useEffect(() => {
    Promise.all([convidado ? null : api<{ id: number; numero: number }>(`/mesas/${token}`).then(setMesa), carregarMenu()])
      .catch((e) => setErro(mensagemErro(e)))
      .finally(() => setACarregar(false));

    // Quando o admin muda um preço ou marca um prato como esgotado, o menu atualiza sozinho.
    const socket = criarSocket();
    socket.on('menu_atualizado', () => carregarMenu().catch(() => {}));
    return () => {
      socket.disconnect();
    };
  }, [token, convidado, carregarMenu]);

  useEffect(() => {
    if (!convidado) carrinhoLocal.guardar(token, carrinho);
  }, [token, carrinho, convidado]);
  useEffect(() => localStorage.setItem('filtros', JSON.stringify(filtros)), [filtros]);

  // Preços e disponibilidade sempre a partir do menu atual (o servidor recalcula tudo de qualquer forma).
  const pratosPorId = useMemo(() => new Map(menu.flatMap((c) => c.pratos).map((p) => [p.id, p])), [menu]);
  const linhas = carrinho.map((i) => {
    const prato = pratosPorId.get(i.pratoId);
    return {
      ...i,
      nome: prato ? traduzir(prato.nome, prato.nomeEn) : i.nome,
      preco: prato?.preco ?? i.preco,
      indisponivel: !!menu.length && (!prato || !prato.disponivel),
    };
  });
  const totalItens = linhas.reduce((s, i) => s + i.quantidade, 0);
  const total = linhas.reduce((s, i) => s + i.preco * i.quantidade, 0);
  const haIndisponiveis = linhas.some((l) => l.indisponivel);

  const filtrosAtivos = filtros.vegetariano || filtros.semGluten || filtros.evitar.length > 0;
  const passaFiltros = (p: Prato) =>
    (!filtros.vegetariano || p.vegetariano) && (!filtros.semGluten || p.semGluten) && !p.alergenios.some((a) => filtros.evitar.includes(a));
  const menuFiltrado = menu.map((c) => ({ ...c, pratos: c.pratos.filter(passaFiltros) })).filter((c) => c.pratos.length > 0);

  function adicionar(prato: Prato, quantidade: number, observacoes: string) {
    const obs = observacoes.trim();
    const chave = `${prato.id}|${obs.toLowerCase()}`;
    setCarrinho((c) => {
      const existe = c.find((i) => i.chave === chave);
      if (existe) return c.map((i) => (i.chave === chave ? { ...i, quantidade: i.quantidade + quantidade } : i));
      return [...c, { chave, pratoId: prato.id, nome: prato.nome, preco: prato.preco, quantidade, observacoes: obs }];
    });
    setPratoAberto(null);
    mostrar(`${quantidade}× ${traduzir(prato.nome, prato.nomeEn)} ${t('adicionado')}`, 'sucesso', 1800);
  }

  function mudarQuantidade(chave: string, delta: number) {
    setCarrinho((c) => c.map((i) => (i.chave === chave ? { ...i, quantidade: i.quantidade + delta } : i)).filter((i) => i.quantidade > 0));
  }

  async function enviarPedido() {
    setAEnviar(true);
    try {
      const pedido = await api<Pedido>('/pedidos', {
        method: 'POST',
        json: {
          token,
          itens: carrinho.map((i) => ({ pratoId: i.pratoId, quantidade: i.quantidade, observacoes: i.observacoes || undefined })),
        },
      });
      pedidosLocais.adicionar(token, pedido.id);
      setCarrinho([]);
      navegar(`/mesa/${token}/pedido`);
    } catch (e) {
      mostrar(mensagemErro(e), 'erro', 5000);
      carregarMenu().catch(() => {});
    } finally {
      setAEnviar(false);
    }
  }

  async function chamarEmpregado() {
    try {
      await api(`/mesas/${token}/chamar`, { method: 'POST' });
      mostrar(t('empregadoChamado'), 'sucesso');
    } catch (e) {
      mostrar(mensagemErro(e), 'erro');
    }
  }

  function irParaCategoria(id: number) {
    setCategoriaAtiva(id);
    document.getElementById(`categoria-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (aCarregar) {
    return <div className="flex min-h-screen items-center justify-center text-stone-500">{t('carregarMenu')}</div>;
  }

  if (erro || (!mesa && !convidado)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <Logo />
        <p className="text-5xl">🤔</p>
        <p className="max-w-xs text-stone-600 dark:text-stone-300">{erro ?? 'Mesa não encontrada.'}</p>
        <Link to="/menu" className="botao-secundario">
          {t('verComoConvidado')}
        </Link>
      </div>
    );
  }

  const chip = (ativo: boolean) =>
    `whitespace-nowrap rounded-full border px-3 py-1 text-sm font-medium transition ${
      ativo ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-stone-300 bg-white hover:border-emerald-500 dark:border-stone-700 dark:bg-stone-900'
    }`;

  return (
    <div className="min-h-screen pb-28">
      {avisos}

      <header className="sticky top-0 z-30 border-b border-stone-200 bg-stone-50/95 backdrop-blur dark:border-stone-800 dark:bg-stone-950/95">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pb-2 pt-3">
          <Link to="/" aria-label="Início">
            <Logo pequeno />
          </Link>
          <div className="flex items-center gap-1">
            {mesa ? (
              <span className="rounded-full bg-tasca-700 px-3 py-1 text-sm font-bold text-white">
                {t('mesa')} {mesa.numero}
              </span>
            ) : (
              <span className="rounded-full bg-stone-200 px-3 py-1 text-sm font-bold text-stone-700 dark:bg-stone-800 dark:text-stone-200">{t('convidado')}</span>
            )}
            <BotaoIdioma />
            <BotaoTema />
          </div>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
          {menuFiltrado.map((c) => (
            <button
              key={c.id}
              onClick={() => irParaCategoria(c.id)}
              className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                categoriaAtiva === c.id ? 'border-tasca-700 bg-tasca-700 text-white' : 'border-stone-300 bg-white hover:border-tasca-400 dark:border-stone-700 dark:bg-stone-900'
              }`}
            >
              {traduzir(c.nome, c.nomeEn)}
            </button>
          ))}
        </nav>
        <div className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none]">
          <button className={chip(filtros.vegetariano)} onClick={() => setFiltros((f) => ({ ...f, vegetariano: !f.vegetariano }))} aria-pressed={filtros.vegetariano}>
            {t('vegetariano')}
          </button>
          <button className={chip(filtros.semGluten)} onClick={() => setFiltros((f) => ({ ...f, semGluten: !f.semGluten }))} aria-pressed={filtros.semGluten}>
            {t('semGluten')}
          </button>
          <button className={chip(filtros.evitar.length > 0)} onClick={() => setAlergiasAbertas(true)}>
            {t('alergias')}
            {filtros.evitar.length > 0 && ` (${filtros.evitar.length})`}
          </button>
          {filtrosAtivos && (
            <button className="whitespace-nowrap px-2 text-sm text-stone-500 underline underline-offset-2" onClick={() => setFiltros(SEM_FILTROS)}>
              {t('limparFiltros')}
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4">
        {convidado && (
          <div className="my-4 rounded-2xl border border-tasca-200 bg-tasca-50 p-4 text-sm dark:border-tasca-900 dark:bg-tasca-900/30">
            <p className="font-semibold">{t('avisoConvidado')}</p>
            <p className="mt-0.5 text-stone-600 dark:text-stone-300">{t('avisoConvidado2')}</p>
          </div>
        )}
        {!convidado && (
          <div className="my-4 flex gap-2">
            <button onClick={chamarEmpregado} className="botao-secundario flex-1">
              {t('chamarEmpregado')}
            </button>
            {temPedidos && (
              <Link to={`/mesa/${token}/pedido`} className="botao-secundario flex-1">
                {t('osMeusPedidos')}
              </Link>
            )}
          </div>
        )}

        {menu.length === 0 && <p className="py-12 text-center text-stone-500">{t('menuVazio')}</p>}
        {menu.length > 0 && menuFiltrado.length === 0 && (
          <div className="py-12 text-center text-stone-500">
            <p>{t('semResultados')}</p>
            <button className="botao-secundario mt-3" onClick={() => setFiltros(SEM_FILTROS)}>
              {t('limparFiltros')}
            </button>
          </div>
        )}

        {menuFiltrado.map((c) => (
          <section key={c.id} id={`categoria-${c.id}`} className="scroll-mt-40 pt-4">
            <h2 className="mb-3 font-display text-2xl font-bold text-tasca-800 dark:text-tasca-300">{traduzir(c.nome, c.nomeEn)}</h2>
            <ul className="grid gap-3">
              {c.pratos.map((p) => (
                <li key={p.id}>
                  <button
                    disabled={!p.disponivel}
                    onClick={() => setPratoAberto(p)}
                    className="cartao flex w-full items-stretch gap-3 overflow-hidden p-0 text-left transition hover:border-tasca-300 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    <div className="min-w-0 flex-1 p-3.5">
                      <div className="flex items-start gap-2">
                        <h3 className="font-semibold">{traduzir(p.nome, p.nomeEn)}</h3>
                        {!p.disponivel && (
                          <span className="shrink-0 rounded bg-stone-200 px-1.5 py-0.5 text-[11px] font-bold uppercase text-stone-600 dark:bg-stone-700 dark:text-stone-200">
                            {t('esgotado')}
                          </span>
                        )}
                      </div>
                      {p.descricao && <p className="mt-1 line-clamp-2 text-sm text-stone-500 dark:text-stone-400">{traduzir(p.descricao, p.descricaoEn)}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-bold text-tasca-700 dark:text-tasca-300">{formatarPreco(p.preco)}</span>
                        <Etiquetas prato={p} />
                      </div>
                    </div>
                    <div className="relative w-28 shrink-0 sm:w-36">
                      <ImagemPrato url={p.imagemUrl} nome={p.nome} className="h-full min-h-28 w-full" />
                      {p.disponivel && !convidado && (
                        <span className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-xl font-bold text-tasca-700 shadow dark:bg-stone-900">
                          +
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <Rodape className="mt-6" />
      </main>

      {!convidado && totalItens > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button onClick={() => setCarrinhoAberto(true)} className="botao-primario mx-auto flex w-full max-w-3xl justify-between rounded-2xl! py-4! text-base shadow-xl">
            <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white/20 px-2">{totalItens}</span>
            <span>{t('verCarrinho')}</span>
            <span>{formatarPreco(total)}</span>
          </button>
        </div>
      )}

      <EscolherPrato prato={pratoAberto} aoFechar={() => setPratoAberto(null)} aoAdicionar={convidado ? null : adicionar} />

      <Modal aberto={alergiasAbertas} aoFechar={() => setAlergiasAbertas(false)} titulo={t('alergiasTitulo')}>
        <EscolherAlergias
          inicial={filtros.evitar}
          aoAplicar={(evitar) => {
            setFiltros((f) => ({ ...f, evitar }));
            setAlergiasAbertas(false);
          }}
        />
      </Modal>

      <Modal aberto={carrinhoAberto && !!mesa} aoFechar={() => setCarrinhoAberto(false)} titulo={`${t('oSeuPedido')} · ${t('mesa')} ${mesa?.numero ?? ''}`}>
        {linhas.length === 0 ? (
          <p className="py-6 text-center text-stone-500">{t('carrinhoVazio')}</p>
        ) : (
          <>
            <ul className="divide-y divide-stone-200 dark:divide-stone-800">
              {linhas.map((l) => (
                <li key={l.chave} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className={`font-medium ${l.indisponivel ? 'text-stone-400 line-through' : ''}`}>{l.nome}</p>
                    {l.observacoes && <p className="text-sm italic text-stone-500">“{l.observacoes}”</p>}
                    {l.indisponivel && <p className="text-xs font-semibold text-red-600">{t('esgotouEntretanto')}</p>}
                    <p className="text-sm text-stone-500">{formatarPreco(l.preco * l.quantidade)}</p>
                  </div>
                  <Contador valor={l.quantidade} aoMudar={(d) => mudarQuantidade(l.chave, d)} />
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-between border-t border-stone-200 pt-4 text-lg font-bold dark:border-stone-800">
              <span>{t('total')}</span>
              <span>{formatarPreco(total)}</span>
            </div>
            <button onClick={enviarPedido} disabled={aEnviar || haIndisponiveis} className="botao-primario mt-4 w-full py-3.5! text-base">
              {aEnviar ? t('aEnviar') : t('enviarPedido')}
            </button>
            <p className="mt-2 text-center text-xs text-stone-500">{t('pagamentoNoFim')}</p>
          </>
        )}
      </Modal>
    </div>
  );
}

/** Pequenas etiquetas: vegetariano, sem glúten e os emojis dos alergénios. */
function Etiquetas({ prato }: { prato: Prato }) {
  const { idioma } = useIdioma();
  return (
    <>
      {prato.vegetariano && (
        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200" title="Vegetariano / Vegetarian">
          🌱 Veg
        </span>
      )}
      {prato.semGluten && (
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-200" title="Sem glúten / Gluten free">
          {idioma === 'pt' ? 'S/ glúten' : 'GF'}
        </span>
      )}
      {prato.alergenios.length > 0 && (
        <span className="text-xs" title={prato.alergenios.map((a) => ALERGENIOS[a]?.[idioma] ?? a).join(', ')} aria-label={prato.alergenios.map((a) => ALERGENIOS[a]?.[idioma] ?? a).join(', ')}>
          {prato.alergenios.map((a) => ALERGENIOS[a]?.emoji ?? '•').join('')}
        </span>
      )}
    </>
  );
}

function EscolherAlergias({ inicial, aoAplicar }: { inicial: string[]; aoAplicar: (l: string[]) => void }) {
  const { t, idioma } = useIdioma();
  const [marcados, setMarcados] = useState<string[]>(inicial);
  const alternar = (a: string) => setMarcados((l) => (l.includes(a) ? l.filter((x) => x !== a) : [...l, a]));
  return (
    <div>
      <p className="mb-3 text-sm text-stone-500">{t('alergiasAjuda')}</p>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(ALERGENIOS).map(([codigo, a]) => (
          <label
            key={codigo}
            className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
              marcados.includes(codigo) ? 'border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950/40' : 'border-stone-200 dark:border-stone-700'
            }`}
          >
            <input type="checkbox" className="accent-red-600" checked={marcados.includes(codigo)} onChange={() => alternar(codigo)} />
            <span aria-hidden>{a.emoji}</span> {a[idioma]}
          </label>
        ))}
      </div>
      <p className="mt-3 text-xs text-stone-500">{t('confirmeEmpregado')}</p>
      <button className="botao-primario mt-4 w-full" onClick={() => aoAplicar(marcados)}>
        {t('aplicar')}
      </button>
    </div>
  );
}

function Contador({ valor, aoMudar, minimo = 0 }: { valor: number; aoMudar: (delta: number) => void; minimo?: number }) {
  return (
    <div className="flex items-center rounded-full border border-stone-300 dark:border-stone-700">
      <button onClick={() => aoMudar(-1)} disabled={valor <= minimo} className="h-9 w-9 rounded-full text-lg font-bold disabled:opacity-30" aria-label="−1">
        −
      </button>
      <span className="w-6 text-center font-semibold tabular-nums">{valor}</span>
      <button onClick={() => aoMudar(1)} disabled={valor >= 50} className="h-9 w-9 rounded-full text-lg font-bold disabled:opacity-30" aria-label="+1">
        +
      </button>
    </div>
  );
}

function EscolherPrato({
  prato,
  aoFechar,
  aoAdicionar,
}: {
  prato: Prato | null;
  aoFechar: () => void;
  /** null = modo convidado (só consulta) */
  aoAdicionar: ((p: Prato, q: number, obs: string) => void) | null;
}) {
  const { t, traduzir, idioma } = useIdioma();
  const [quantidade, setQuantidade] = useState(1);
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    setQuantidade(1);
    setObservacoes('');
  }, [prato]);

  return (
    <Modal aberto={!!prato} aoFechar={aoFechar}>
      {prato && (
        <div>
          <ImagemPrato url={prato.imagemUrl} nome={prato.nome} className="-mx-5 -mt-5 mb-4 h-52 w-[calc(100%+2.5rem)] max-w-none rounded-t-3xl text-7xl!" />
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-2xl font-bold">{traduzir(prato.nome, prato.nomeEn)}</h2>
            <button onClick={aoFechar} className="text-2xl leading-none text-stone-400" aria-label="Fechar">
              ×
            </button>
          </div>
          {prato.descricao && <p className="mt-1 text-stone-600 dark:text-stone-300">{traduzir(prato.descricao, prato.descricaoEn)}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold text-tasca-700 dark:text-tasca-300">{formatarPreco(prato.preco)}</span>
            <Etiquetas prato={prato} />
          </div>

          <div className="mt-4 rounded-xl bg-stone-100 p-3 text-sm dark:bg-stone-800">
            <p className="font-semibold">{t('alergenios')}</p>
            {prato.alergenios.length === 0 ? (
              <p className="text-stone-500">{t('semAlergenios')}</p>
            ) : (
              <p className="mt-1 flex flex-wrap gap-1.5">
                {prato.alergenios.map((a) => (
                  <span key={a} className="rounded-full bg-white px-2 py-0.5 dark:bg-stone-900">
                    {ALERGENIOS[a]?.emoji} {ALERGENIOS[a]?.[idioma] ?? a}
                  </span>
                ))}
              </p>
            )}
          </div>

          {aoAdicionar === null ? (
            <p className="mt-5 rounded-xl bg-tasca-50 p-3 text-center text-sm text-stone-600 dark:bg-tasca-900/30 dark:text-stone-300">{t('paraPedir')}</p>
          ) : (
            <>
              <label className="mt-5 block text-sm font-medium" htmlFor="obs">
                {t('observacoes')} <span className="font-normal text-stone-500">{t('opcional')}</span>
              </label>
              <textarea
                id="obs"
                className="campo mt-1 resize-none"
                rows={2}
                maxLength={200}
                placeholder={t('exemploObs')}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />

              <div className="mt-5 flex items-center gap-3">
                <Contador valor={quantidade} minimo={1} aoMudar={(d) => setQuantidade((q) => q + d)} />
                <button onClick={() => aoAdicionar(prato, quantidade, observacoes)} className="botao-primario flex-1 py-3! text-base">
                  {t('adicionar')} · {formatarPreco(prato.preco * quantidade)}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
