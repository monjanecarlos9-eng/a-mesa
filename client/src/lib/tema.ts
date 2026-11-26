import { useState } from 'react';

export function useTema() {
  const [escuro, setEscuro] = useState(() => document.documentElement.classList.contains('dark'));
  const alternar = () => {
    const novo = !escuro;
    document.documentElement.classList.toggle('dark', novo);
    localStorage.setItem('tema', novo ? 'escuro' : 'claro');
    setEscuro(novo);
  };
  return { escuro, alternar };
}
