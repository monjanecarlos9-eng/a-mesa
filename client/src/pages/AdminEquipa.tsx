import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, mensagemErro } from '../lib/api';
import { useAuth } from '../lib/auth';
import { criarSocket } from '../lib/socket';
import type { Papel } from '../tipos';
import { AdminLayout } from '../components/AdminLayout';
import { Modal } from '../components/Modal';
import { useAvisos } from '../components/Aviso';
import { CampoSenha } from '../components/CampoSenha';

interface Membro {
  id: number;
  nome: string;
  email: string;
  papel: Papel;
  aprovado: boolean;
  criadoEm: string;
}

export default function AdminEquipa() {
  const { utilizador, token } = useAuth();
  const { mostrar, elemento: avisos } = useAvisos();
  const [membros, setMembros] = useState<Membro[]>([]);
  const [link, setLink] = useState<{ nome: string; url: string } | null>(null);

  const carregar = useCallback(
    () =>
      api<Membro[]>('/utilizadores')
        .then(setMembros)
        .catch((e) => mostrar(mensagemErro(e), 'erro')),
    [mostrar],
  );

  useEffect(() => {
    carregar();
    const socket = criarSocket(token);
    socket.on('conta_pendente', (c: { nome: string }) => {
      mostrar(`Nova conta à espera de aprovação: ${c.nome}`, 'info', 6000);
      carregar();
    });
    return () => {
      socket.disconnect();
    };
  }, [carregar, mostrar, token]);

  async function atualizar(m: Membro, dados: Partial<Pick<Membro, 'papel' | 'aprovado'>>, mensagem: string) {
    try {
      await api(`/utilizadores/${m.id}`, { method: 'PATCH', json: dados });
      mostrar(mensagem, 'sucesso');
      carregar();
    } catch (e) {
      mostrar(mensagemErro(e), 'erro', 6000);
    }
  }

  async function apagar(m: Membro) {
    if (!confirm(`Remover a conta de ${m.nome} (${m.email})?`)) return;
    try {
      await api(`/utilizadores/${m.id}`, { method: 'DELETE' });
      mostrar('Conta removida', 'sucesso');
      carregar();
    } catch (e) {
      mostrar(mensagemErro(e), 'erro', 6000);
    }
  }

  async function gerarLink(m: Membro) {
    try {
      const r = await api<{ link: string }>(`/utilizadores/${m.id}/link-recuperacao`, { method: 'POST' });
      setLink({ nome: m.nome, url: r.link });
    } catch (e) {
      mostrar(mensagemErro(e), 'erro');
    }
  }

  const pendentes = membros.filter((m) => !m.aprovado);
  const ativos = membros.filter((m) => m.aprovado);

  return (
    <AdminLayout titulo="Equipa">
      {avisos}

      {pendentes.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-semibold">⏳ À espera de aprovação ({pendentes.length})</h2>
          <div className="cartao divide-y divide-stone-200 dark:divide-stone-800">
            {pendentes.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{m.nome}</p>
                  <p className="text-sm text-stone-500">
                    {m.email} · registou-se a {new Date(m.criadoEm).toLocaleDateString('pt-PT')}
                  </p>
                </div>
                <button className="botao-primario py-1.5!" onClick={() => atualizar(m, { aprovado: true, papel: 'cozinha' }, `${m.nome} aprovado como cozinha`)}>
                  Aprovar (cozinha)
                </button>
                <button className="botao-secundario py-1.5!" onClick={() => atualizar(m, { aprovado: true, papel: 'admin' }, `${m.nome} aprovado como admin`)}>
                  Aprovar (admin)
                </button>
                <button className="botao-secundario py-1.5! text-red-600!" onClick={() => apagar(m)}>
                  Recusar
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-3 font-semibold">Contas ativas</h2>
        <div className="cartao divide-y divide-stone-200 dark:divide-stone-800">
          {ativos.map((m) => {
            const eu = m.id === utilizador?.id;
            return (
              <div key={m.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {m.nome} {eu && <span className="text-sm font-normal text-stone-500">(tu)</span>}
                  </p>
                  <p className="text-sm text-stone-500">{m.email}</p>
                </div>
                <select
                  className="campo w-auto! py-1.5!"
                  value={m.papel}
                  disabled={eu}
                  title={eu ? 'Não podes mudar o teu próprio papel' : 'Papel'}
                  onChange={(e) => atualizar(m, { papel: e.target.value as Papel }, `Papel de ${m.nome} atualizado`)}
                >
                  <option value="cozinha">Cozinha</option>
                  <option value="admin">Admin</option>
                </select>
                {!eu && (
                  <>
                    <button className="rounded-lg px-2 py-1.5 text-sm hover:bg-stone-100 dark:hover:bg-stone-800" onClick={() => gerarLink(m)} title="Gerar link para redefinir a senha">
                      🔑 Link de senha
                    </button>
                    <button className="rounded-lg px-2 py-1.5 text-sm hover:bg-stone-100 dark:hover:bg-stone-800" onClick={() => atualizar(m, { aprovado: false }, `${m.nome} suspenso`)} title="Suspender (deixa de poder entrar)">
                      ⏸️
                    </button>
                    <button className="rounded-lg px-2 py-1.5 text-sm hover:bg-red-50 dark:hover:bg-red-950" onClick={() => apagar(m)} title="Remover conta">
                      🗑️
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-stone-500">Novas pessoas criam conta em “Entrar → Criar conta” e aparecem aqui para aprovares.</p>
      </section>

      <MudarSenha aoErro={(m) => mostrar(m, 'erro')} aoSucesso={() => mostrar('Palavra-passe alterada. As outras sessões foram terminadas.', 'sucesso', 5000)} />

      <Modal aberto={!!link} aoFechar={() => setLink(null)} titulo="Link de recuperação">
        {link && (
          <div>
            <p className="text-sm text-stone-600 dark:text-stone-300">
              Envia este link a <strong>{link.nome}</strong> por um canal privado. Só funciona uma vez e expira em 30 minutos.
            </p>
            <input readOnly className="campo mt-3 font-mono text-xs" value={link.url} onFocus={(e) => e.target.select()} />
            <button
              className="botao-primario mt-3 w-full"
              onClick={() => navigator.clipboard.writeText(link.url).then(() => mostrar('Link copiado', 'sucesso'))}
            >
              📋 Copiar link
            </button>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}

/** Formulário "mudar a minha senha" — também usado pela cozinha. */
export function MudarSenha({ aoErro, aoSucesso }: { aoErro: (m: string) => void; aoSucesso: () => void }) {
  const { trocarToken } = useAuth();
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function submeter(e: FormEvent) {
    e.preventDefault();
    if (nova.length < 8 || !/[A-Za-z]/.test(nova) || !/\d/.test(nova)) return aoErro('A nova palavra-passe precisa de 8+ caracteres, com letras e números.');
    if (nova !== confirmacao) return aoErro('As palavras-passe não coincidem.');
    setOcupado(true);
    try {
      const r = await api<{ token: string }>('/auth/alterar-senha', { method: 'POST', json: { atual, nova } });
      trocarToken(r.token);
      setAtual('');
      setNova('');
      setConfirmacao('');
      aoSucesso();
    } catch (err) {
      aoErro(mensagemErro(err));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="cartao max-w-md p-5">
      <h2 className="mb-4 font-semibold">Mudar a minha palavra-passe</h2>
      <form onSubmit={submeter} className="space-y-3">
        <CampoSenha aria-label="Palavra-passe atual" placeholder="Palavra-passe atual" autoComplete="current-password" required value={atual} onChange={(e) => setAtual(e.target.value)} />
        <CampoSenha aria-label="Nova palavra-passe" placeholder="Nova palavra-passe" autoComplete="new-password" required minLength={8} maxLength={72} value={nova} onChange={(e) => setNova(e.target.value)} />
        <CampoSenha aria-label="Repetir nova palavra-passe" placeholder="Repetir nova palavra-passe" autoComplete="new-password" required value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
        <button className="botao-primario w-full" disabled={ocupado}>
          {ocupado ? 'A guardar…' : 'Guardar'}
        </button>
      </form>
    </section>
  );
}
