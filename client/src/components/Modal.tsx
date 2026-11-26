import { useEffect, type ReactNode } from 'react';

/** Janela modal: no telemóvel abre como "folha" a partir de baixo; no computador fica centrada. */
export function Modal({ aberto, aoFechar, titulo, children }: { aberto: boolean; aoFechar: () => void; titulo?: string; children: ReactNode }) {
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', tecla);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', tecla);
      document.body.style.overflow = '';
    };
  }, [aberto, aoFechar]);

  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={aoFechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="animar-subir max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-3xl dark:bg-stone-900"
        onClick={(e) => e.stopPropagation()}
      >
        {titulo && (
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="font-display text-xl font-bold">{titulo}</h2>
            <button onClick={aoFechar} className="rounded-full p-1.5 text-xl leading-none hover:bg-stone-100 dark:hover:bg-stone-800" aria-label="Fechar">
              ×
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
