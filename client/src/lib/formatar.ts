const euros = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });

export const formatarPreco = (v: number) => euros.format(v);

export const formatarHora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

export function haQuantoTempo(iso: string, agora = Date.now()): string {
  const min = Math.floor((agora - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  return `há ${h} h ${min % 60} min`;
}
