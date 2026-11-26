/** Aviso de direitos de autor, mostrado no fundo das páginas. */
export const AUTOR = 'Carlos';
export const ANO = 2026;

export function Rodape({ className = '' }: { className?: string }) {
  return (
    <footer className={`py-6 text-center text-xs text-stone-400 dark:text-stone-500 print:hidden ${className}`}>
      © {ANO} {AUTOR} · <span className="font-semibold">À Mesa</span>. Todos os direitos reservados.
    </footer>
  );
}
