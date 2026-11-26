import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CampoSenha } from './CampoSenha';
import { Rodape } from './Rodape';
import { BotaoIdioma, IdiomaProvider, useIdioma } from '../lib/idioma';

describe('CampoSenha', () => {
  it('esconde a palavra-passe e mostra-a ao carregar no olho', () => {
    render(<CampoSenha aria-label="Palavra-passe" defaultValue="segredo123" />);
    const campo = screen.getByLabelText('Palavra-passe');
    expect(campo).toHaveProperty('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar palavra-passe' }));
    expect(campo).toHaveProperty('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar palavra-passe' }));
    expect(campo).toHaveProperty('type', 'password');
  });
});

describe('Idioma PT/EN', () => {
  function Saudacao() {
    const { t } = useIdioma();
    return <h1>{t('bemVindo')}</h1>;
  }

  it('troca o texto para inglês e lembra a escolha', () => {
    localStorage.setItem('idioma', 'pt');
    render(
      <IdiomaProvider>
        <BotaoIdioma />
        <Saudacao />
      </IdiomaProvider>,
    );
    const emPortugues = screen.getByRole('heading').textContent;

    fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }));

    expect(screen.getByRole('heading').textContent).not.toBe(emPortugues);
    expect(localStorage.getItem('idioma')).toBe('en');
    expect(screen.getByRole('button', { name: 'Mudar para português' })).toBeTruthy();
  });
});

describe('Rodape', () => {
  it('mostra o aviso de direitos de autor', () => {
    render(<Rodape />);
    expect(screen.getByText(/Todos os direitos reservados/)).toBeTruthy();
  });
});
