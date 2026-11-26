import { useCallback, useEffect, useState, type FormEvent } from 'react';
import QRCode from 'qrcode';
import { api, mensagemErro } from '../lib/api';
import type { Mesa } from '../tipos';
import { AdminLayout } from '../components/AdminLayout';
import { useAvisos } from '../components/Aviso';

const CHAVE_BASE = 'qrBase';

export default function AdminMesas() {
  const { mostrar, elemento: avisos } = useAvisos();
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [qrs, setQrs] = useState<Record<number, string>>({});
  const [numero, setNumero] = useState('');
  // Endereço público do site, usado nos QR codes. Em localhost convém pôr o IP do PC (ex.: http://192.168.1.20:5173)
  const [base, setBase] = useState(() => localStorage.getItem(CHAVE_BASE) || window.location.origin);

  const urlMesa = useCallback((m: Mesa) => `${base.replace(/\/$/, '')}/mesa/${m.qrToken}`, [base]);

  const carregar = useCallback(
    () =>
      api<Mesa[]>('/mesas')
        .then(setMesas)
        .catch((e) => mostrar(mensagemErro(e), 'erro')),
    [mostrar],
  );

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    localStorage.setItem(CHAVE_BASE, base);
    let cancelado = false;
    Promise.all(mesas.map(async (m) => [m.id, await QRCode.toDataURL(urlMesa(m), { width: 600, margin: 1, color: { dark: '#3b1a10' } })] as const)).then(
      (pares) => !cancelado && setQrs(Object.fromEntries(pares)),
    );
    return () => {
      cancelado = true;
    };
  }, [mesas, base, urlMesa]);

  async function criar(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/mesas', { method: 'POST', json: { numero: Number(numero) } });
      setNumero('');
      carregar();
    } catch (err) {
      mostrar(mensagemErro(err), 'erro');
    }
  }

  async function regenerar(m: Mesa) {
    if (!confirm(`Gerar um novo QR para a mesa ${m.numero}? O QR antigo deixa de funcionar.`)) return;
    try {
      await api(`/mesas/${m.id}/regenerar`, { method: 'POST' });
      mostrar('Novo QR gerado — não te esqueças de o imprimir', 'sucesso');
      carregar();
    } catch (err) {
      mostrar(mensagemErro(err), 'erro');
    }
  }

  async function apagar(m: Mesa) {
    if (!confirm(`Apagar a mesa ${m.numero}?`)) return;
    try {
      await api(`/mesas/${m.id}`, { method: 'DELETE' });
      carregar();
    } catch (err) {
      mostrar(mensagemErro(err), 'erro', 6000);
    }
  }

  const proximoNumero = mesas.length ? Math.max(...mesas.map((m) => m.numero)) + 1 : 1;

  return (
    <AdminLayout
      titulo="Mesas e QR codes"
      acoes={
        <button className="botao-primario" onClick={() => window.print()} disabled={mesas.length === 0}>
          🖨️ Imprimir todos
        </button>
      }
    >
      {avisos}
      <div className="mb-6 grid gap-4 print:hidden md:grid-cols-2">
        <form onSubmit={criar} className="cartao flex items-end gap-2 p-4">
          <div className="flex-1">
            <label className="text-sm font-medium" htmlFor="m-num">
              Nova mesa (número)
            </label>
            <input id="m-num" type="number" min={1} required className="campo mt-1" placeholder={String(proximoNumero)} value={numero} onChange={(e) => setNumero(e.target.value)} />
          </div>
          <button className="botao-primario">Adicionar</button>
        </form>
        <div className="cartao p-4">
          <label className="text-sm font-medium" htmlFor="m-base">
            Endereço usado nos QR codes
          </label>
          <input id="m-base" className="campo mt-1" value={base} onChange={(e) => setBase(e.target.value)} />
          <p className="mt-1 text-xs text-stone-500">Em testes locais, usa o IP do computador (ex.: http://192.168.1.20:5173) para o telemóvel conseguir abrir.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-2 print:gap-8">
        {mesas.map((m) => (
          <div key={m.id} className="cartao flex flex-col items-center p-4 text-center print:break-inside-avoid print:border-2 print:border-stone-800 print:shadow-none">
            <p className="font-display text-sm text-stone-500">Tasca do Zé</p>
            <p className="font-display text-3xl font-black">Mesa {m.numero}</p>
            {qrs[m.id] ? <img src={qrs[m.id]} alt={`QR code da mesa ${m.numero}`} className="my-3 aspect-square w-full max-w-48" /> : <div className="my-3 aspect-square w-full max-w-48 animate-pulse rounded bg-stone-200" />}
            <p className="text-sm font-medium">📱 Aponte a câmara para ver o menu e pedir</p>
            <div className="mt-3 flex w-full flex-wrap justify-center gap-1 print:hidden">
              <a href={urlMesa(m)} target="_blank" rel="noreferrer" className="rounded-lg px-2 py-1 text-sm hover:bg-stone-100 dark:hover:bg-stone-800" title="Abrir o menu desta mesa">
                🔗 Abrir
              </a>
              {qrs[m.id] && (
                <a href={qrs[m.id]} download={`mesa-${m.numero}.png`} className="rounded-lg px-2 py-1 text-sm hover:bg-stone-100 dark:hover:bg-stone-800">
                  ⬇️ PNG
                </a>
              )}
              <button onClick={() => regenerar(m)} className="rounded-lg px-2 py-1 text-sm hover:bg-stone-100 dark:hover:bg-stone-800" title="Gerar novo QR">
                🔄
              </button>
              <button onClick={() => apagar(m)} className="rounded-lg px-2 py-1 text-sm hover:bg-red-50 dark:hover:bg-red-950" title="Apagar mesa">
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
