import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, sessao, urlImagem } from './api';

function respostaJson(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('cliente da API', () => {
  it('envia o token de sessão e o corpo em JSON', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(respostaJson(200, { ok: true }));
    vi.stubGlobal('fetch', fetchFalso);
    sessao.guardar('abc123');

    const dados = await api<{ ok: boolean }>('/pedidos', { method: 'POST', json: { mesa: 1 } });

    expect(dados).toEqual({ ok: true });
    const [url, opcoes] = fetchFalso.mock.calls[0];
    expect(url).toBe('/api/pedidos');
    expect(new Headers(opcoes.headers).get('Authorization')).toBe('Bearer abc123');
    expect(opcoes.body).toBe('{"mesa":1}');
  });

  it('mostra a mensagem de erro clara que vem do servidor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson(400, { erro: 'O prato está esgotado' })));
    await expect(api('/pedidos')).rejects.toThrow('O prato está esgotado');
  });

  it('termina a sessão quando o servidor responde 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson(401, { erro: 'Sessão expirada' })));
    sessao.guardar('token-antigo');
    const aviso = vi.fn();
    window.addEventListener('sessao-expirada', aviso);

    await expect(api('/auth/eu')).rejects.toBeInstanceOf(ApiError);

    expect(sessao.obter()).toBeNull();
    expect(aviso).toHaveBeenCalledOnce();
    window.removeEventListener('sessao-expirada', aviso);
  });

  it('avisa quando não há ligação ao servidor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api('/menu')).rejects.toThrow('Sem ligação ao servidor');
  });

  it('junta o endereço do back-end às imagens locais', () => {
    expect(urlImagem(null)).toBeNull();
    expect(urlImagem('https://res.cloudinary.com/x.jpg')).toBe('https://res.cloudinary.com/x.jpg');
    expect(urlImagem('/uploads/abc.jpg')).toBe('/uploads/abc.jpg');
  });
});
