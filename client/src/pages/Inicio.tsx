import { Link } from 'react-router';
import { Logo } from '../components/Logo';
import { BotaoTema } from '../components/BotaoTema';
import { BotaoIdioma, useIdioma } from '../lib/idioma';
import { Rodape } from '../components/Rodape';

export default function Inicio() {
  const { t } = useIdioma();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="absolute right-3 top-3 flex items-center gap-1">
        <BotaoIdioma />
        <BotaoTema />
      </div>
      <Logo />
      <p className="text-6xl">📱🍽️</p>
      <div>
        <h1 className="font-display text-3xl font-bold">{t('bemVindo')}</h1>
        <p className="mt-2 max-w-sm text-stone-600 dark:text-stone-300">{t('leiaQr')}</p>
      </div>
      <Link to="/menu" className="botao-primario px-6! py-3! text-base">
        {t('verComoConvidado')}
      </Link>
      <Link to="/login" className="text-sm text-stone-500 underline underline-offset-4 hover:text-tasca-700">
        {t('souEquipa')}
      </Link>
      <Rodape className="absolute inset-x-0 bottom-0" />
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
