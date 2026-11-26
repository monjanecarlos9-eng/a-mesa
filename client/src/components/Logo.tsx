export function Logo({ pequeno = false }: { pequeno?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <img src="/logo.svg" alt="" className={pequeno ? 'h-8 w-8' : 'h-10 w-10'} />
      <span className="leading-tight">
        <span className={`block font-display font-bold ${pequeno ? 'text-lg' : 'text-xl'}`}>Tasca do Zé</span>
        {!pequeno && <span className="block text-xs text-stone-500 dark:text-stone-400">Cozinha portuguesa desde 1987</span>}
      </span>
    </span>
  );
}
