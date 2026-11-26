import { useTema } from '../lib/tema';

export function BotaoTema() {
  const { escuro, alternar } = useTema();
  return (
    <button
      type="button"
      onClick={alternar}
      className="rounded-full p-2 text-lg hover:bg-stone-200 dark:hover:bg-stone-800"
      aria-label={escuro ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
      title={escuro ? 'Modo claro' : 'Modo escuro'}
    >
      {escuro ? '☀️' : '🌙'}
    </button>
  );
}
