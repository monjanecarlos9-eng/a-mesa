import { useCallback, useRef, useState } from 'react';

type Tipo = 'sucesso' | 'erro' | 'info';

/** Pequenas notificações temporárias ("toast"). */
export function useAvisos() {
  const [avisos, setAvisos] = useState<{ id: number; texto: string; tipo: Tipo }[]>([]);
  const proximo = useRef(1);

  const mostrar = useCallback((texto: string, tipo: Tipo = 'info', duracaoMs = 3500) => {
    const id = proximo.current++;
    setAvisos((a) => [...a, { id, texto, tipo }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), duracaoMs);
  }, []);

  const elemento = (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
      {avisos.map((a) => (
        <div
          key={a.id}
          className={`animar-entrada pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
            a.tipo === 'erro' ? 'bg-red-600' : a.tipo === 'sucesso' ? 'bg-emerald-600' : 'bg-stone-800'
          }`}
        >
          {a.texto}
        </div>
      ))}
    </div>
  );

  return { mostrar, elemento };
}
