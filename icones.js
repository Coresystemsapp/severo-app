/* Ícones em linha (traço), usados no app e no painel */
(function () {
  const s = (corpo, extra) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || '') + '>' + corpo + '</svg>';
  window.IC = {
    caminhao: s('<path d="M1 4h14v12H1z"/><path d="M15 8h4.5L23 11.5V16h-8z"/><circle cx="5.5" cy="18" r="2.2"/><circle cx="18.5" cy="18" r="2.2"/>'),
    mic: s('<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>'),
    parar: s('<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>'),
    pino: s('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>'),
    alvo: s('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/>'),
    fone: s('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.8.7a2 2 0 0 1 1.7 2z"/>'),
    zap: s('<path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.5L3 21l1.9-5.6A8.5 8.5 0 1 1 21 11.5z"/>'),
    voltar: s('<path d="M15 18l-6-6 6-6"/>'),
    lixo: s('<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>'),
    refazer: s('<path d="M1 4v6h6"/><path d="M3.5 15a9 9 0 1 0 2.1-9.4L1 10"/>'),
    ondas: s('<path d="M2 12h2M6 8v8M10 5v14M14 8v8M18 10v4M22 12h0"/>'),
    sair: s('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
    baixar: s('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>'),
    mais: s('<path d="M12 5v14M5 12h14"/>'),
    relogio: s('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')
  };
})();
