import { Link } from 'react-router';
import { Logo } from '../components/Logo';
import { BotaoTema } from '../components/BotaoTema';

export default function Inicio() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="absolute right-3 top-3">
        <BotaoTema />
      </div>
      <Logo />
      <p className="text-6xl">📱🍽️</p>
      <div>
        <h1 className="font-display text-3xl font-bold">Bem-vindo!</h1>
        <p className="mt-2 max-w-sm text-stone-600 dark:text-stone-300">Leia o QR code que está na sua mesa para ver o menu e fazer o pedido.</p>
      </div>
      <Link to="/login" className="text-sm text-stone-500 underline underline-offset-4 hover:text-tasca-700">
        Sou da equipa
      </Link>
    </div>
  );
}

export function NaoEncontrado() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <Logo />
      <p className="text-5xl">🍳</p>
      <p className="text-stone-600 dark:text-stone-300">Esta página não existe.</p>
      <Link to="/" className="botao-secundario">
        Voltar ao início
      </Link>
    </div>
  );
}
