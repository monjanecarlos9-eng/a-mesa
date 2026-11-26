import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../lib/auth';
import { mensagemErro } from '../lib/api';
import { Logo } from '../components/Logo';
import { BotaoTema } from '../components/BotaoTema';

export default function Login() {
  const { utilizador, entrar } = useAuth();
  const navegar = useNavigate();
  const local = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aEntrar, setAEntrar] = useState(false);

  const destino = (papel: string) => (local.state as { de?: string } | null)?.de ?? (papel === 'admin' ? '/admin/pratos' : '/cozinha');

  if (utilizador) return <Navigate to={destino(utilizador.papel)} replace />;

  async function submeter(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setAEntrar(true);
    try {
      const u = await entrar(email, password);
      navegar(destino(u.papel), { replace: true });
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setAEntrar(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="absolute right-3 top-3">
        <BotaoTema />
      </div>
      <form onSubmit={submeter} className="cartao w-full max-w-sm p-6">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <h1 className="mb-1 text-center text-lg font-semibold">Entrada da equipa</h1>
        <p className="mb-6 text-center text-sm text-stone-500">Cozinha e administração</p>

        <label className="block text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input id="email" type="email" autoComplete="username" required className="campo mb-4 mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />

        <label className="block text-sm font-medium" htmlFor="password">
          Palavra-passe
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          className="campo mb-4 mt-1"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {erro && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{erro}</p>}

        <button type="submit" disabled={aEntrar} className="botao-primario w-full py-3!">
          {aEntrar ? 'A entrar…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
