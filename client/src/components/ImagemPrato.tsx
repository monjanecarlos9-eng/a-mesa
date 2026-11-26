import { useState } from 'react';
import { urlImagem } from '../lib/api';

const EMOJIS: [RegExp, string][] = [
  [/caf[eé]/i, '☕'],
  [/vinho/i, '🍷'],
  [/imperial|cerveja/i, '🍺'],
  [/[aá]gua|sumo/i, '🥤'],
  [/bacalhau|sardinha|polvo|peixe/i, '🐟'],
  [/nata|doce|baba|bolo/i, '🍮'],
  [/caldo|sopa/i, '🥣'],
  [/queijo/i, '🧀'],
  [/p[aã]o/i, '🥖'],
  [/legumes|gr[aã]o|salada/i, '🥗'],
];

/** Mostra a foto do prato ou, se não houver, um fundo com um emoji a condizer. */
export function ImagemPrato({ url, nome, className = '' }: { url: string | null; nome: string; className?: string }) {
  const [falhou, setFalhou] = useState(false);
  const src = urlImagem(url);
  if (src && !falhou) {
    return <img src={src} alt={nome} loading="lazy" onError={() => setFalhou(true)} className={`object-cover ${className}`} />;
  }
  const emoji = EMOJIS.find(([re]) => re.test(nome))?.[1] ?? '🍽️';
  return (
    <div className={`flex items-center justify-center bg-linear-to-br from-tasca-100 to-tasca-200 text-4xl dark:from-tasca-900 dark:to-stone-800 ${className}`} aria-hidden>
      {emoji}
    </div>
  );
}
