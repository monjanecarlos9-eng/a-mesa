// Aplica o modo escuro antes de pintar a página (evita o "flash" branco).
// Está num ficheiro à parte (e não inline) para a Content-Security-Policy poder proibir scripts inline.
try {
  var t = localStorage.getItem('tema');
  if (t === 'escuro' || (!t && matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
} catch (e) {}
