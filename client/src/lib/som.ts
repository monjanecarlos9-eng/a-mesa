// Aviso sonoro gerado com a Web Audio API (sem ficheiros de som).
// Os browsers só deixam tocar som depois de um clique, por isso há um botão "Ativar som".
let ctx: AudioContext | null = null;

export async function ativarSom(): Promise<boolean> {
  ctx ??= new AudioContext();
  await ctx.resume();
  return ctx.state === 'running';
}

export function tocarAviso(notas: number[] = [880, 1175, 1568]) {
  if (!ctx || ctx.state !== 'running') return;
  const inicio = ctx.currentTime;
  notas.forEach((freq, i) => {
    const t = inicio + i * 0.16;
    const osc = ctx!.createOscillator();
    const ganho = ctx!.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    ganho.gain.setValueAtTime(0.0001, t);
    ganho.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    ganho.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(ganho).connect(ctx!.destination);
    osc.start(t);
    osc.stop(t + 0.32);
  });
}
