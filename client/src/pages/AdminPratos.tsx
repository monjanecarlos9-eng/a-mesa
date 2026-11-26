import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, mensagemErro } from '../lib/api';
import { formatarPreco } from '../lib/formatar';
import type { Categoria, Prato } from '../tipos';
import { AdminLayout } from '../components/AdminLayout';
import { ImagemPrato } from '../components/ImagemPrato';
import { Modal } from '../components/Modal';
import { useAvisos } from '../components/Aviso';
import { ALERGENIOS } from '../lib/idioma';

export default function AdminPratos() {
  const { mostrar, elemento: avisos } = useAvisos();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [pratos, setPratos] = useState<Prato[]>([]);
  const [aEditar, setAEditar] = useState<Prato | 'novo' | null>(null);
  const [gerirCategorias, setGerirCategorias] = useState(false);
  const [pesquisa, setPesquisa] = useState('');

  const carregar = useCallback(
    () =>
      Promise.all([api<Categoria[]>('/categorias'), api<Prato[]>('/pratos')])
        .then(([c, p]) => {
          setCategorias(c);
          setPratos(p);
        })
        .catch((e) => mostrar(mensagemErro(e), 'erro')),
    [mostrar],
  );

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function alternarDisponivel(p: Prato) {
    setPratos((l) => l.map((x) => (x.id === p.id ? { ...x, disponivel: !p.disponivel } : x)));
    try {
      await api(`/pratos/${p.id}/disponivel`, { method: 'PATCH', json: { disponivel: !p.disponivel } });
    } catch (e) {
      mostrar(mensagemErro(e), 'erro');
      carregar();
    }
  }

  async function apagar(p: Prato) {
    if (!confirm(`Apagar "${p.nome}"?`)) return;
    try {
      await api(`/pratos/${p.id}`, { method: 'DELETE' });
      mostrar('Prato apagado', 'sucesso');
      carregar();
    } catch (e) {
      mostrar(mensagemErro(e), 'erro', 6000);
    }
  }

  const filtro = pesquisa.trim().toLowerCase();
  const visiveis = filtro ? pratos.filter((p) => p.nome.toLowerCase().includes(filtro)) : pratos;

  return (
    <AdminLayout
      titulo="Menu"
      acoes={
        <div className="flex gap-2">
          <button className="botao-secundario" onClick={() => setGerirCategorias(true)}>
            Categorias
          </button>
          <button className="botao-primario" onClick={() => setAEditar('novo')} disabled={categorias.length === 0}>
            + Novo prato
          </button>
        </div>
      }
    >
      {avisos}
      <input className="campo mb-6 max-w-sm" placeholder="Procurar prato…" value={pesquisa} onChange={(e) => setPesquisa(e.target.value)} />

      {categorias.length === 0 && (
        <div className="cartao p-8 text-center">
          <p className="mb-4 text-stone-500">Começa por criar uma categoria (ex.: Entradas).</p>
          <button className="botao-primario" onClick={() => setGerirCategorias(true)}>
            Criar categoria
          </button>
        </div>
      )}

      <div className="space-y-8">
        {categorias.map((c) => {
          const lista = visiveis.filter((p) => p.categoriaId === c.id);
          if (filtro && lista.length === 0) return null;
          return (
            <section key={c.id}>
              <h2 className="mb-3 font-display text-xl font-bold">
                {c.nome} <span className="text-sm font-normal text-stone-500">({lista.length})</span>
              </h2>
              {lista.length === 0 ? (
                <p className="text-sm text-stone-500">Sem pratos nesta categoria.</p>
              ) : (
                <div className="cartao divide-y divide-stone-200 overflow-hidden dark:divide-stone-800">
                  {lista.map((p) => (
                    <div key={p.id} className={`flex items-center gap-3 p-3 ${p.disponivel ? '' : 'bg-stone-50 dark:bg-stone-900/40'}`}>
                      <ImagemPrato url={p.imagemUrl} nome={p.nome} className="h-14 w-14 shrink-0 rounded-lg text-2xl!" />
                      <div className="min-w-0 flex-1">
                        <p className={`font-semibold ${p.disponivel ? '' : 'text-stone-400'}`}>{p.nome}</p>
                        <p className="truncate text-sm text-stone-500">{p.descricao || '—'}</p>
                        <p className="text-xs text-stone-500">
                          {p.vegetariano && '🌱 '}
                          {p.semGluten && '🌾 s/ glúten '}
                          {p.alergenios.map((a) => ALERGENIOS[a]?.emoji).join('')}
                          {!p.nomeEn && <span className="ml-1 text-amber-600">· sem tradução EN</span>}
                        </p>
                      </div>
                      <span className="w-20 text-right font-semibold tabular-nums">{formatarPreco(p.preco)}</span>
                      <label className="flex cursor-pointer items-center gap-2 text-sm" title="Disponível / esgotado">
                        <input type="checkbox" className="peer sr-only" checked={p.disponivel} onChange={() => alternarDisponivel(p)} />
                        <span className="relative h-6 w-11 rounded-full bg-stone-300 transition peer-checked:bg-emerald-500 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5 dark:bg-stone-700" />
                        <span className="hidden w-16 sm:inline">{p.disponivel ? 'Disponível' : 'Esgotado'}</span>
                      </label>
                      <button className="rounded-lg p-2 hover:bg-stone-100 dark:hover:bg-stone-800" onClick={() => setAEditar(p)} aria-label={`Editar ${p.nome}`}>
                        ✏️
                      </button>
                      <button className="rounded-lg p-2 hover:bg-red-50 dark:hover:bg-red-950" onClick={() => apagar(p)} aria-label={`Apagar ${p.nome}`}>
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <Modal aberto={aEditar !== null} aoFechar={() => setAEditar(null)} titulo={aEditar === 'novo' ? 'Novo prato' : 'Editar prato'}>
        {aEditar !== null && (
          <FormPrato
            prato={aEditar === 'novo' ? null : aEditar}
            categorias={categorias}
            aoGuardar={() => {
              setAEditar(null);
              mostrar('Guardado — o menu dos clientes já foi atualizado', 'sucesso');
              carregar();
            }}
            aoErro={(m) => mostrar(m, 'erro')}
          />
        )}
      </Modal>

      <Modal aberto={gerirCategorias} aoFechar={() => setGerirCategorias(false)} titulo="Categorias">
        <GerirCategorias categorias={categorias} aoMudar={carregar} aoErro={(m) => mostrar(m, 'erro', 6000)} />
      </Modal>
    </AdminLayout>
  );
}

function FormPrato({ prato, categorias, aoGuardar, aoErro }: { prato: Prato | null; categorias: Categoria[]; aoGuardar: () => void; aoErro: (m: string) => void }) {
  const [nome, setNome] = useState(prato?.nome ?? '');
  const [descricao, setDescricao] = useState(prato?.descricao ?? '');
  const [preco, setPreco] = useState(prato ? String(prato.preco) : '');
  const [categoriaId, setCategoriaId] = useState(prato?.categoriaId ?? categorias[0]?.id ?? 0);
  const [imagemUrl, setImagemUrl] = useState(prato?.imagemUrl ?? '');
  const [disponivel, setDisponivel] = useState(prato?.disponivel ?? true);
  const [nomeEn, setNomeEn] = useState(prato?.nomeEn ?? '');
  const [descricaoEn, setDescricaoEn] = useState(prato?.descricaoEn ?? '');
  const [vegetariano, setVegetariano] = useState(prato?.vegetariano ?? false);
  const [semGluten, setSemGluten] = useState(prato?.semGluten ?? false);
  const [alergenios, setAlergenios] = useState<string[]>(prato?.alergenios ?? []);
  const [aEnviarImagem, setAEnviarImagem] = useState(false);
  const [aGuardar, setAGuardar] = useState(false);

  async function enviarImagem(ficheiro: File) {
    const dados = new FormData();
    dados.append('imagem', ficheiro);
    setAEnviarImagem(true);
    try {
      const { url } = await api<{ url: string }>('/upload', { method: 'POST', body: dados });
      setImagemUrl(url);
    } catch (e) {
      aoErro(mensagemErro(e));
    } finally {
      setAEnviarImagem(false);
    }
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const valor = Number(preco.replace(',', '.'));
    if (!Number.isFinite(valor) || valor < 0) return aoErro('Preço inválido');
    setAGuardar(true);
    try {
      const json = {
        nome,
        descricao,
        preco: valor,
        categoriaId,
        imagemUrl: imagemUrl || null,
        disponivel,
        nomeEn: nomeEn || null,
        descricaoEn: descricaoEn || null,
        vegetariano,
        semGluten,
        alergenios,
      };
      if (prato) await api(`/pratos/${prato.id}`, { method: 'PUT', json });
      else await api('/pratos', { method: 'POST', json });
      aoGuardar();
    } catch (err) {
      aoErro(mensagemErro(err));
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-4">
      <div>
        <label className="text-sm font-medium" htmlFor="p-nome">
          Nome
        </label>
        <input id="p-nome" required maxLength={100} className="campo mt-1" value={nome} onChange={(e) => setNome(e.target.value)} />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="p-desc">
          Descrição
        </label>
        <textarea id="p-desc" rows={2} maxLength={500} className="campo mt-1 resize-none" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium" htmlFor="p-preco">
            Preço (€)
          </label>
          <input id="p-preco" required inputMode="decimal" placeholder="9,50" className="campo mt-1" value={preco} onChange={(e) => setPreco(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="p-cat">
            Categoria
          </label>
          <select id="p-cat" className="campo mt-1" value={categoriaId} onChange={(e) => setCategoriaId(Number(e.target.value))}>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <span className="text-sm font-medium">Foto</span>
        <div className="mt-1 flex items-center gap-3">
          <ImagemPrato url={imagemUrl || null} nome={nome} className="h-20 w-20 shrink-0 rounded-xl text-3xl!" />
          <div className="flex-1 space-y-2">
            <label className="botao-secundario w-full cursor-pointer">
              {aEnviarImagem ? 'A enviar…' : '📷 Carregar imagem'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                disabled={aEnviarImagem}
                onChange={(e) => e.target.files?.[0] && enviarImagem(e.target.files[0])}
              />
            </label>
            <input className="campo" placeholder="…ou cola um URL de imagem" value={imagemUrl} onChange={(e) => setImagemUrl(e.target.value)} />
          </div>
        </div>
      </div>

      <details className="rounded-xl border border-stone-200 p-3 dark:border-stone-700" open={!!(nomeEn || descricaoEn)}>
        <summary className="cursor-pointer text-sm font-medium">🇬🇧 Tradução inglesa {nomeEn ? '✓' : '(opcional)'}</summary>
        <div className="mt-3 space-y-3">
          <input className="campo" placeholder="Name in English" maxLength={100} value={nomeEn} onChange={(e) => setNomeEn(e.target.value)} />
          <textarea className="campo resize-none" rows={2} placeholder="Description in English" maxLength={500} value={descricaoEn} onChange={(e) => setDescricaoEn(e.target.value)} />
          <p className="text-xs text-stone-500">Se ficar vazio, o menu em inglês mostra o texto em português.</p>
        </div>
      </details>

      <div>
        <span className="text-sm font-medium">Dieta</span>
        <div className="mt-1 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={vegetariano} onChange={(e) => setVegetariano(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
            🌱 Vegetariano
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={semGluten} onChange={(e) => setSemGluten(e.target.checked)} className="h-4 w-4 accent-amber-600" />
            🌾 Sem glúten
          </label>
        </div>
      </div>

      <div>
        <span className="text-sm font-medium">Alergénios</span>
        <div className="mt-1 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {Object.entries(ALERGENIOS).map(([codigo, a]) => (
            <label key={codigo} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-red-600"
                checked={alergenios.includes(codigo)}
                onChange={() => setAlergenios((l) => (l.includes(codigo) ? l.filter((x) => x !== codigo) : [...l, codigo]))}
              />
              {a.emoji} {a.pt}
            </label>
          ))}
        </div>
        {semGluten && alergenios.includes('gluten') && <p className="mt-1 text-xs font-semibold text-red-600">⚠ Marcado como "sem glúten" mas com o alergénio glúten.</p>}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={disponivel} onChange={(e) => setDisponivel(e.target.checked)} className="h-4 w-4 accent-tasca-700" />
        Disponível (desmarca para "esgotado")
      </label>

      <button type="submit" disabled={aGuardar || aEnviarImagem} className="botao-primario w-full py-3!">
        {aGuardar ? 'A guardar…' : 'Guardar'}
      </button>
    </form>
  );
}

function GerirCategorias({ categorias, aoMudar, aoErro }: { categorias: Categoria[]; aoMudar: () => Promise<unknown>; aoErro: (m: string) => void }) {
  const [nova, setNova] = useState('');
  const [aEditar, setAEditar] = useState<{ id: number; nome: string; nomeEn: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function executar(fn: () => Promise<unknown>) {
    setOcupado(true);
    try {
      await fn();
      await aoMudar();
    } catch (e) {
      aoErro(mensagemErro(e));
    } finally {
      setOcupado(false);
    }
  }

  const mover = (i: number, d: -1 | 1) =>
    executar(async () => {
      const a = categorias[i];
      const b = categorias[i + d];
      // Troca as posições (usa o índice para que funcione mesmo se houver ordens repetidas)
      await Promise.all([
        api(`/categorias/${a.id}`, { method: 'PUT', json: { ordem: i + d } }),
        api(`/categorias/${b.id}`, { method: 'PUT', json: { ordem: i } }),
      ]);
    });

  return (
    <div>
      <ul className="mb-4 divide-y divide-stone-200 dark:divide-stone-800">
        {categorias.map((c, i) => (
          <li key={c.id} className="flex items-center gap-2 py-2">
            {aEditar?.id === c.id ? (
              <form
                className="flex flex-1 gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  executar(() => api(`/categorias/${c.id}`, { method: 'PUT', json: { nome: aEditar.nome, nomeEn: aEditar.nomeEn || null } })).then(() => setAEditar(null));
                }}
              >
                <input autoFocus className="campo py-1.5!" aria-label="Nome" value={aEditar.nome} onChange={(e) => setAEditar({ ...aEditar, nome: e.target.value })} />
                <input className="campo py-1.5!" placeholder="🇬🇧 English" aria-label="Nome em inglês" value={aEditar.nomeEn} onChange={(e) => setAEditar({ ...aEditar, nomeEn: e.target.value })} />
                <button className="botao-primario py-1.5!" disabled={ocupado}>
                  OK
                </button>
              </form>
            ) : (
              <>
                <span className="flex-1 font-medium">
                  {c.nome} <span className="text-sm font-normal text-stone-500">· {c.totalPratos ?? 0} pratos</span>
                </span>
                <button disabled={ocupado || i === 0} onClick={() => mover(i, -1)} className="rounded p-1.5 hover:bg-stone-100 disabled:opacity-30 dark:hover:bg-stone-800" aria-label="Subir">
                  ↑
                </button>
                <button
                  disabled={ocupado || i === categorias.length - 1}
                  onClick={() => mover(i, 1)}
                  className="rounded p-1.5 hover:bg-stone-100 disabled:opacity-30 dark:hover:bg-stone-800"
                  aria-label="Descer"
                >
                  ↓
                </button>
                <button onClick={() => setAEditar({ id: c.id, nome: c.nome, nomeEn: c.nomeEn ?? '' })} className="rounded p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800" aria-label="Renomear">
                  ✏️
                </button>
                <button
                  disabled={ocupado}
                  onClick={() => confirm(`Apagar a categoria "${c.nome}"?`) && executar(() => api(`/categorias/${c.id}`, { method: 'DELETE' }))}
                  className="rounded p-1.5 hover:bg-red-50 dark:hover:bg-red-950"
                  aria-label="Apagar"
                >
                  🗑️
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (nova.trim()) executar(() => api('/categorias', { method: 'POST', json: { nome: nova } })).then(() => setNova(''));
        }}
      >
        <input className="campo" placeholder="Nova categoria" maxLength={60} value={nova} onChange={(e) => setNova(e.target.value)} />
        <button className="botao-primario" disabled={ocupado || !nova.trim()}>
          Adicionar
        </button>
      </form>
    </div>
  );
}
