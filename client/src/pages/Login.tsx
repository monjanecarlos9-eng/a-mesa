import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../lib/auth';
import { mensagemErro } from '../lib/api';
import { CartaoConta, Campo, MensagemErro } from './Conta';

export default function Login() {
  const { utilizador, entrar } = useAuth();
  const navegar = useNavigate();
  const local = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aEntrar, setAEntrar] = useState(false);

  const destino = (papel: string) => {
    const de = (local.state as { de?: string } | null)?.de;
    // Só aceita caminhos internos (evita redirecionar para outro site)
    const seguro = de && de.startsWith('/') && !de.startsWith('//') ? de : null;
    return seguro ?? (papel === 'admin' ? '/admin/pratos' : '/cozinha');
  };

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
    <CartaoConta titulo="Entrada da equipa" subtitulo="Cozinha e administração">
      <form onSubmit={submeter}>
        <Campo id="email" rotulo="Email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Campo id="password" rotulo="Palavra-passe" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="-mt-2 mb-4 text-right">
          <Link to="/recuperar-senha" className="text-sm text-tasca-700 underline-offset-4 hover:underline dark:text-tasca-300">
            Esqueci-me da palavra-passe
          </Link>
        </div>
        <MensagemErro texto={erro} />
        <button type="submit" disabled={aEntrar} className="botao-primario w-full py-3!">
          {aEntrar ? 'A entrar…' : 'Entrar'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-stone-500">
        Ainda não tens conta?{' '}
        <Link to="/registar" className="font-medium text-tasca-700 underline-offset-4 hover:underline dark:text-tasca-300">
          Criar conta
        </Link>
      </p>

      <div className="mt-5 border-t border-stone-200 pt-5 dark:border-stone-800">
        <Link to="/menu" className="botao-secundario w-full">
          👀 Ver como convidado
        </Link>
        <p className="mt-2 text-center text-xs text-stone-500">Consultar o menu sem entrar</p>
      </div>
    </CartaoConta>
  );
}
