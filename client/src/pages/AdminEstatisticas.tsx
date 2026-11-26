import { useEffect, useState } from 'react';
import { api, mensagemErro } from '../lib/api';
import { formatarPreco } from '../lib/formatar';
import { AdminLayout } from '../components/AdminLayout';

interface Estatisticas {
  hoje: { faturacao: number; pedidos: number; ticketMedio: number; emCurso: number };
  ultimos7Dias: { dia: string; faturacao: number; pedidos: number }[];
  topPratos: { id: number; nome: string; quantidade: number; receita: number }[];
}

const nomeDia = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric' });

export default function AdminEstatisticas() {
  const [dados, setDados] = useState<Estatisticas | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const carregar = () =>
      api<Estatisticas>('/estatisticas')
        .then(setDados)
        .catch((e) => setErro(mensagemErro(e)));
    carregar();
    const t = setInterval(carregar, 30_000);
    return () => clearInterval(t);
  }, []);

  const maxDia = Math.max(1, ...(dados?.ultimos7Dias.map((d) => d.faturacao) ?? []));
  const maxPrato = Math.max(1, ...(dados?.topPratos.map((p) => p.quantidade) ?? []));

  return (
    <AdminLayout titulo="Vendas">
      {erro && <p className="text-red-600">{erro}</p>}
      {!dados && !erro && <p className="text-stone-500">A carregar…</p>}
      {dados && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador rotulo="Faturação hoje" valor={formatarPreco(dados.hoje.faturacao)} destaque />
            <Indicador rotulo="Pedidos hoje" valor={String(dados.hoje.pedidos)} />
            <Indicador rotulo="Valor médio por pedido" valor={formatarPreco(dados.hoje.ticketMedio)} />
            <Indicador rotulo="Pedidos em curso" valor={String(dados.hoje.emCurso)} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="cartao p-5">
              <h2 className="mb-4 font-semibold">Faturação dos últimos 7 dias</h2>
              <div className="flex h-56 items-end gap-2">
                {dados.ultimos7Dias.map((d) => (
                  <div key={d.dia} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${d.pedidos} pedidos`}>
                    <span className="text-[11px] tabular-nums text-stone-500">{Math.round(d.faturacao)} €</span>
                    <div className="w-full max-w-12 rounded-t-md bg-tasca-600 transition-all dark:bg-tasca-500" style={{ height: `${(d.faturacao / maxDia) * 80}%`, minHeight: 2 }} />
                    <span className="text-xs capitalize text-stone-500">{nomeDia(d.dia)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="cartao p-5">
              <h2 className="mb-4 font-semibold">Pratos mais pedidos</h2>
              {dados.topPratos.length === 0 ? (
                <p className="text-sm text-stone-500">Ainda não há pedidos.</p>
              ) : (
                <ol className="space-y-2.5">
                  {dados.topPratos.map((p, i) => (
                    <li key={p.id}>
                      <div className="mb-1 flex justify-between gap-2 text-sm">
                        <span>
                          <span className="mr-1 text-stone-400 tabular-nums">{i + 1}.</span> {p.nome}
                        </span>
                        <span className="tabular-nums text-stone-500">
                          {p.quantidade}× · {formatarPreco(p.receita)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-stone-100 dark:bg-stone-800">
                        <div className="h-2 rounded-full bg-tasca-600 dark:bg-tasca-500" style={{ width: `${(p.quantidade / maxPrato) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </>
      )}
    </AdminLayout>
  );
}

function Indicador({ rotulo, valor, destaque = false }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 ${destaque ? 'bg-tasca-700 text-white' : 'cartao'}`}>
      <p className={`text-sm ${destaque ? 'text-tasca-100' : 'text-stone-500'}`}>{rotulo}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{valor}</p>
    </div>
  );
}
