import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { useAuth } from '../lib/auth';
import { BotaoTema } from './BotaoTema';
import { Logo } from './Logo';

const LIGACOES = [
  { para: '/admin/pratos', rotulo: 'Menu' },
  { para: '/admin/mesas', rotulo: 'Mesas e QR' },
  { para: '/admin/estatisticas', rotulo: 'Vendas' },
  { para: '/cozinha', rotulo: 'Cozinha ↗' },
];

export function AdminLayout({ titulo, acoes, children }: { titulo: string; acoes?: ReactNode; children: ReactNode }) {
  const { utilizador, sair } = useAuth();
  const navegar = useNavigate();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur print:hidden dark:border-stone-800 dark:bg-stone-950/90">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Logo pequeno />
          <nav className="order-last flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
            {LIGACOES.map((l) => (
              <NavLink
                key={l.para}
                to={l.para}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                    isActive ? 'bg-tasca-100 text-tasca-800 dark:bg-tasca-900/60 dark:text-tasca-100' : 'text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800'
                  }`
                }
              >
                {l.rotulo}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm text-stone-500 md:inline">{utilizador?.nome}</span>
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
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <h1 className="font-display text-2xl font-bold">{titulo}</h1>
          {acoes}
        </div>
        {children}
      </main>
    </div>
  );
}
