import { useEffect, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, mensagemErro } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Logo } from '../components/Logo';
import { BotaoTema } from '../components/BotaoTema';
import { CampoSenha } from '../components/CampoSenha';
import { Rodape } from '../components/Rodape';

/** Moldura comum às páginas de conta (login, registo, recuperação). */
export function CartaoConta({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="absolute right-3 top-3">
        <BotaoTema />
      </div>
      <div className="cartao w-full max-w-sm p-6">
        <div className="mb-6 flex justify-center">
          <Link to="/" aria-label="Início">
            <Logo />
          </Link>
        </div>
        <h1 className="mb-1 text-center text-lg font-semibold">{titulo}</h1>
        {subtitulo && <p className="mb-6 text-center text-sm text-stone-500">{subtitulo}</p>}
        {children}
      </div>
      <Rodape className="absolute inset-x-0 bottom-0" />
    </div>
  );
}

export function Campo({ id, rotulo, type, ...props }: { id: string; rotulo: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium" htmlFor={id}>
        {rotulo}
      </label>
      {type === 'password' ? <CampoSenha id={id} className="mt-1" {...props} /> : <input id={id} type={type} className="campo mt-1" {...props} />}
    </div>
  );
}

export function MensagemErro({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return (
    <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
      {texto}
    </p>
  );
}

const DICA_SENHA = 'Pelo menos 8 caracteres, com letras e números.';

function validarSenha(s: string, confirmacao: string): string | null {
  if (s.length < 8 || !/[A-Za-z]/.test(s) || !/\d/.test(s)) return `A palavra-passe não é válida. ${DICA_SENHA}`;
  if (s !== confirmacao) return 'As palavras-passe não coincidem.';
  return null;
}

// ---------- Criar conta ----------

export function Registar() {
  const { registar } = useAuth();
  const navegar = useNavigate();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [pendente, setPendente] = useState(false);
  const [codigo, setCodigo] = useState('');
  // Primeira conta do sistema? (fica admin; em produção exige o código de configuração)
  const [config, setConfig] = useState<{ primeiraConta: boolean; exigeCodigo: boolean } | null>(null);

  useEffect(() => {
    api<{ primeiraConta: boolean; exigeCodigo: boolean }>('/auth/configuracao')
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  async function submeter(e: FormEvent) {
    e.preventDefault();
    const invalida = validarSenha(senha, confirmacao);
    if (invalida) return setErro(invalida);
    setErro(null);
    setOcupado(true);
    try {
      const u = await registar(nome, email, senha, codigo);
      if (u) navegar(u.papel === 'admin' ? '/admin/pratos' : '/cozinha', { replace: true });
      else setPendente(true);
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setOcupado(false);
    }
  }

  if (pendente) {
    return (
      <CartaoConta titulo="Conta criada ✅">
        <p className="text-center text-sm text-stone-600 dark:text-stone-300">
          O administrador tem de aprovar a tua conta antes de poderes entrar. Avisa-o de que já te registaste.
        </p>
        <Link to="/login" className="botao-primario mt-6 w-full">
          Ir para a entrada
        </Link>
      </CartaoConta>
    );
  }

  return (
    <CartaoConta
      titulo={config?.primeiraConta ? 'Configurar o restaurante' : 'Criar conta da equipa'}
      subtitulo={config?.primeiraConta ? 'Esta é a primeira conta: vai ficar como administrador.' : 'A conta fica ativa depois de o administrador a aprovar.'}
    >
      <form onSubmit={submeter}>
        <Campo id="nome" rotulo="Nome" required minLength={2} maxLength={80} autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Campo id="email" rotulo="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Campo
          id="senha"
          rotulo="Palavra-passe"
          type="password"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        <Campo
          id="confirmacao"
          rotulo="Repetir palavra-passe"
          type="password"
          required
          autoComplete="new-password"
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
        />
        <p className="-mt-2 mb-4 text-xs text-stone-500">{DICA_SENHA}</p>
        {config?.exigeCodigo && (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
            <Campo
              id="codigo"
              rotulo="🔐 Código de configuração"
              type="password"
              required
              autoComplete="off"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
            />
            <p className="-mt-2 text-xs text-stone-600 dark:text-stone-300">
              Está na variável <code>CODIGO_CONFIGURACAO</code> do servidor (Render → Environment). Impede que um desconhecido fique dono do site.
            </p>
          </div>
        )}
        <MensagemErro texto={erro} />
        <button type="submit" disabled={ocupado} className="botao-primario w-full py-3!">
          {ocupado ? 'A criar…' : 'Criar conta'}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-stone-500">
        Já tens conta?{' '}
        <Link to="/login" className="font-medium text-tasca-700 underline-offset-4 hover:underline dark:text-tasca-300">
          Entrar
        </Link>
      </p>
    </CartaoConta>
  );
}

// ---------- Recuperar senha (pedir o link) ----------

export function RecuperarSenha() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function submeter(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    try {
      const r = await api<{ mensagem: string }>('/auth/recuperar', { method: 'POST', json: { email } });
      setEnviado(r.mensagem);
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <CartaoConta titulo="Recuperar palavra-passe" subtitulo="Enviamos-te um link para escolheres uma nova.">
      {enviado ? (
        <>
          <p className="rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">📧 {enviado}</p>
          <p className="mt-3 text-xs text-stone-500">O link é válido durante 30 minutos. Vê também a pasta de spam. Se não receberes nada, pede ao administrador um link de recuperação.</p>
        </>
      ) : (
        <form onSubmit={submeter}>
          <Campo id="email" rotulo="Email da tua conta" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <MensagemErro texto={erro} />
          <button type="submit" disabled={ocupado} className="botao-primario w-full py-3!">
            {ocupado ? 'A enviar…' : 'Enviar link'}
          </button>
        </form>
      )}
      <p className="mt-5 text-center text-sm">
        <Link to="/login" className="text-stone-500 underline-offset-4 hover:underline">
          ← Voltar à entrada
        </Link>
      </p>
    </CartaoConta>
  );
}

// ---------- Redefinir senha (a partir do link) ----------

export function RedefinirSenha() {
  const { token = '' } = useParams();
  const { sair } = useAuth();
  const [email, setEmail] = useState<string | null>(null);
  const [linkInvalido, setLinkInvalido] = useState<string | null>(null);
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [feito, setFeito] = useState(false);

  useEffect(() => {
    api<{ email: string }>(`/auth/redefinir/${encodeURIComponent(token)}`)
      .then((r) => setEmail(r.email))
      .catch((e) => setLinkInvalido(mensagemErro(e)));
  }, [token]);

  async function submeter(e: FormEvent) {
    e.preventDefault();
    const invalida = validarSenha(senha, confirmacao);
    if (invalida) return setErro(invalida);
    setErro(null);
    setOcupado(true);
    try {
      await api('/auth/redefinir', { method: 'POST', json: { token, password: senha } });
      sair(); // a mudança de senha termina todas as sessões, incluindo uma eventualmente aberta aqui
      setFeito(true);
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setOcupado(false);
    }
  }

  if (feito) {
    return (
      <CartaoConta titulo="Palavra-passe alterada ✅">
        <p className="text-center text-sm text-stone-600 dark:text-stone-300">Já podes entrar com a nova palavra-passe. Todas as outras sessões foram terminadas.</p>
        <Link to="/login" className="botao-primario mt-6 w-full">
          Entrar
        </Link>
      </CartaoConta>
    );
  }

  if (linkInvalido) {
    return (
      <CartaoConta titulo="Link inválido">
        <p className="text-center text-sm text-stone-600 dark:text-stone-300">{linkInvalido}</p>
        <Link to="/recuperar-senha" className="botao-primario mt-6 w-full">
          Pedir um novo link
        </Link>
      </CartaoConta>
    );
  }

  return (
    <CartaoConta titulo="Nova palavra-passe" subtitulo={email ? `Para a conta ${email}` : 'A verificar o link…'}>
      <form onSubmit={submeter}>
        <Campo id="senha" rotulo="Nova palavra-passe" type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        <Campo id="confirmacao" rotulo="Repetir" type="password" required autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
        <p className="-mt-2 mb-4 text-xs text-stone-500">{DICA_SENHA}</p>
        <MensagemErro texto={erro} />
        <button type="submit" disabled={ocupado || !email} className="botao-primario w-full py-3!">
          {ocupado ? 'A guardar…' : 'Guardar palavra-passe'}
        </button>
      </form>
    </CartaoConta>
  );
}
