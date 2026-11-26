import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Limpa o DOM e o armazenamento entre testes
afterEach(() => {
  cleanup();
  localStorage.clear();
});
