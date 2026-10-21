/* Severo · app do motorista */
(function () {
  'use strict';
  const SV = window.SV, IC = window.IC, C = window.SEVERO_CONFIG || {}, U = SV.util;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = U.esc;
  const raiz = $('#tela');
  const CHAVE_FILA = 'sv_fila_envio';
  const CHAVE_VEIC = 'sv_veiculo_atual';

  const E = {
    tela: 'carregando',
    eu: null,
    veiculos: [], veiculosOk: false,
    pedidos: [],
    form: null,
    grav: null,
    editVeiculo: null,
    pararObs: [],
    cargas: [], interesses: {}, filtroCargas: null, recusa: false, negociar: false, negCarga: null
  };

  /* ---------- aviso ---------- */
  let tAviso;
  function aviso(txt, erro) {
    const a = $('#aviso');
    a.textContent = txt;
    a.classList.toggle('erro', !!erro);
    a.classList.add('mostrar');
    clearTimeout(tAviso);
    tAviso = setTimeout(() => a.classList.remove('mostrar'), 4200);
  }

  /* ---------- fila de envio (sem sinal) ---------- */
  const lerFila = () => { try { return JSON.parse(localStorage.getItem(CHAVE_FILA)) || []; } catch (e) { return []; } };
  const gravarFila = (f) => localStorage.setItem(CHAVE_FILA, JSON.stringify(f));
  async function enfileirar(pacote, audio) {
    let audioDados = null;
    if (audio) audioDados = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(audio); });
    const f = lerFila();
    f.push({ pacote: pacote, audio: audioDados, em: Date.now() });
    try { gravarFila(f); } catch (e) { f[f.length - 1].audio = null; gravarFila(f); }
  }
  let enviandoFila = false;
  async function enviarFila() {
    if (enviandoFila || !navigator.onLine) return;
    const f = lerFila();
    if (!f.length) return;
    enviandoFila = true;
    try {
      while (f.length) {
        const item = f[0];
        const audio = item.audio ? await (await fetch(item.audio)).blob() : null;
        await comPrazo(SV.enviarPedido(Object.assign({}, item.pacote, { audio: audio })), 25000);
        f.shift();
        gravarFila(f);
      }
      aviso('Pedido guardado foi enviado. A Severo recebeu.');
    } catch (e) { /* tenta de novo quando o sinal voltar */ }
    enviandoFila = false;
    desenhar();
  }
  const comPrazo = (p, ms) => Promise.race([p, new Promise((_, n) => setTimeout(() => n(new Error('prazo')), ms))]);

  /* ---------- navegação ---------- */
  function ir(tela) {
    E.tela = tela;
    if (tela !== 'pedido') pararGravacao(true);
    if (tela !== 'acompanhar') { E.recusa = false; E.negociar = false; }
    if (tela !== 'cargas' && tela !== 'inicio') E.negCarga = null;
    window.scrollTo(0, 0);
    desenhar();
  }
  window.addEventListener('popstate', () => { if (E.tela !== 'inicio' && E.eu) ir('inicio'); });

  function veiculoAtual() {
    const id = localStorage.getItem(CHAVE_VEIC);
    return E.veiculos.find((v) => v.id === id) || E.veiculos[0] || null;
  }
  function pedidoAtual() {
    const v = veiculoAtual();
    const doVeic = E.pedidos.filter((p) => !v || p.veiculoId === v.id);
    return doVeic[0] || E.pedidos[0] || null;
  }
  const ativo = (p) => p && SV.ATIVOS.includes(p.status);

  /* ---------- desenho ---------- */
  function desenhar() {
    const t = {
      carregando: telaCarregando, bloqueado: telaBloqueado, cadastro: telaCadastro, veiculo: telaVeiculo,
      inicio: telaInicio, pedido: telaPedido, acompanhar: telaAcompanhar, veiculos: telaVeiculos, cargas: telaCargas
    }[E.tela];
    raiz.innerHTML = t();
    const pos = { pedido: ligarPedido, cadastro: ligarCadastro, veiculo: ligarVeiculo }[E.tela];
    if (pos) pos();
  }

  function topo(voltar) {
    return '<header class="topo">' +
      (voltar ? '<button class="btn btn-fantasma voltar" data-ir="' + voltar + '" aria-label="Voltar">' + IC.voltar + 'Voltar</button>' : '<img class="logo" src="logo-severo.png" alt="Severo Transportes">') +
      (voltar ? '<img class="logo" src="logo-severo.png" alt="" style="height:30px;opacity:.7">' : '') +
      '</header>';
  }

  function telaBloqueado() {
    return topo() + '<section class="tela"><div class="estado-grande"><span class="etq vermelho">Acesso bloqueado</span>' +
      '<h1 class="titulo" style="margin-top:.7rem">Seu acesso ao app foi bloqueado</h1>' +
      '<p class="sub">Para saber o motivo ou pedir a liberação, fale com a central da Severo.</p></div>' +
      '<div class="acoes-coluna"><a class="btn btn-primario btn-grande" href="https://wa.me/' + U.soDigitos(C.centralWhatsApp) + '" target="_blank" rel="noopener">' + IC.zap + 'Falar com a central</a></div></section>';
  }
  function telaCarregando() {
    return topo() + '<div class="carregando">Carregando…</div>';
  }

  /* ----- cadastro ----- */
  function telaCadastro() {
    return topo() + '<section class="tela">' +
      '<h1 class="titulo" style="margin-top:1.4rem">Seu próximo frete começa aqui.</h1>' +
      '<p class="sub">Cadastro rápido, feito uma vez. Depois é só avisar quando ficar vazio.</p>' +
      '<form id="f-cad" novalidate>' +
      '<label class="campo"><span>Seu nome</span><input name="nome" autocomplete="name" required></label>' +
      '<label class="campo"><span>Celular com WhatsApp</span><input name="telefone" inputmode="tel" autocomplete="tel" placeholder="(21) 99999-9999" required>' +
      '<small>É por esse número que a Severo vai falar com você.</small></label>' +
      '<button class="btn btn-primario btn-grande" type="submit">Continuar</button>' +
      '</form></section>';
  }
  function ligarCadastro() {
    const f = $('#f-cad');
    f.telefone.addEventListener('input', (e) => { e.target.value = mascaraFone(e.target.value); });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nome = f.nome.value.trim(), tel = U.soDigitos(f.telefone.value);
      f.nome.classList.toggle('erro-campo', nome.length < 3);
      f.telefone.classList.toggle('erro-campo', tel.length < 10);
      if (nome.length < 3) return aviso('Digite seu nome.', true);
      if (tel.length < 10) return aviso('Digite o celular com DDD.', true);
      travar(f, 'Salvando…');
      try {
        E.eu = await SV.cadastrar({ nome: nome, telefone: tel });
        observar();
        E.editVeiculo = {};
        ir('veiculo');
      } catch (err) { destravar(f, 'Continuar'); aviso(msgErro(err), true); }
    });
  }
  function mascaraFone(v) {
    const d = U.soDigitos(v).slice(0, 11);
    if (d.length <= 2) return d.length ? '(' + d : '';
    if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  }

  /* ----- veículo ----- */
  function chips(nome, opcoes, valor) {
    return '<div class="chips" data-grupo="' + nome + '">' + opcoes.map((o) =>
      '<button type="button" class="chip" data-valor="' + esc(o) + '" aria-pressed="' + (o === valor) + '">' + esc(o) + '</button>').join('') + '</div>';
  }
  function telaVeiculo() {
    const v = E.editVeiculo || {};
    const primeiro = !E.veiculos.length;
    return topo(primeiro ? null : 'veiculos') + '<section class="tela">' +
      '<h1 class="titulo" style="margin-top:1.2rem">' + (v.id ? 'Editar veículo' : primeiro ? 'Qual é o seu veículo?' : 'Novo veículo') + '</h1>' +
      '<p class="sub">Fica salvo. Você não precisa preencher de novo a cada aviso.</p>' +
      '<form id="f-veic" novalidate>' +
      '<div class="campo"><span>Veículo</span>' + chips('tipo', SV.VEICULOS, v.tipo) + '</div>' +
      '<div class="campo"><span>Carroceria</span>' + chips('carroceria', SV.CARROCERIAS, v.carroceria) + '</div>' +
      '<p class="miudo" style="margin:-.4rem 0 1rem">Todos os campos são obrigatórios.</p>' +
      '<div class="linha-campos">' +
      '<label class="campo"><span>Capacidade (toneladas)</span><input name="cap" inputmode="decimal" placeholder="28" value="' + (v.capacidadeKg ? String(v.capacidadeKg / 1000).replace('.', ',') : '') + '"></label>' +
      '<label class="campo"><span>Ano</span><input name="ano" inputmode="numeric" maxlength="4" required placeholder="2019" value="' + esc(v.ano || '') + '"></label>' +
      '</div>' +
      '<label class="campo"><span>Placa</span><input name="placa" autocapitalize="characters" maxlength="7" required placeholder="ABC1D23" value="' + esc(v.placa || '') + '"></label>' +
      '<label class="interruptor" style="margin-bottom:1.4rem">Tem rastreador<input type="checkbox" name="rastreador"' + (v.rastreador ? ' checked' : '') + '></label>' +
      '<button class="btn btn-primario btn-grande" type="submit">Salvar veículo</button>' +
      '</form></section>';
  }
  function ligarVeiculo() {
    const f = $('#f-veic');
    ligarChips(f);
    f.placa.addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const tipo = valorChip(f, 'tipo'), carroceria = valorChip(f, 'carroceria');
      const cap = parseFloat(f.cap.value.replace(',', '.'));
      if (!tipo) return aviso('Escolha o tipo de veículo.', true);
      if (!carroceria) return aviso('Escolha a carroceria.', true);
      if (!cap || cap <= 0 || cap > 80) { f.cap.classList.add('erro-campo'); return aviso('Informe a capacidade em toneladas.', true); }
      const ano = parseInt(f.ano.value, 10), anoMax = new Date().getFullYear() + 1;
      if (!ano || ano < 1970 || ano > anoMax) { f.ano.classList.add('erro-campo'); return aviso('Informe o ano do veículo (ex.: 2019).', true); }
      if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(f.placa.value.trim())) { f.placa.classList.add('erro-campo'); return aviso('Informe a placa completa (ex.: ABC1D23 ou ABC1234).', true); }
      travar(f, 'Salvando…');
      try {
        const salvo = await SV.salvarVeiculo(Object.assign({}, E.editVeiculo, {
          motoristaId: E.eu.id, tipo: tipo, carroceria: carroceria, capacidadeKg: Math.round(cap * 1000),
          ano: parseInt(f.ano.value, 10) || null, placa: f.placa.value.trim(), rastreador: f.rastreador.checked
        }));
        localStorage.setItem(CHAVE_VEIC, salvo.id);
        if (!E.veiculos.find((x) => x.id === salvo.id)) E.veiculos.push(salvo);
        E.editVeiculo = null;
        aviso('Veículo salvo.');
        ir('inicio');
      } catch (err) { destravar(f, 'Salvar veículo'); aviso(msgErro(err), true); }
    });
  }

  function telaVeiculos() {
    const atual = veiculoAtual();
    return topo('inicio') + '<section class="tela">' +
      '<h1 class="titulo" style="margin-top:1.2rem">Seus veículos</h1>' +
      '<p class="sub">Toque para escolher com qual você vai avisar.</p>' +
      '<div class="lista-veiculos">' + E.veiculos.map((v) =>
        '<button class="cartao cartao-veiculo" data-escolher="' + v.id + '" aria-pressed="' + (atual && atual.id === v.id) + '">' +
        '<span class="icone">' + IC.caminhao + '</span><span class="info"><span class="nome">' + esc(v.tipo) + ' · ' + esc(v.carroceria) + '</span>' +
        '<span class="miudo">' + U.toneladas(v.capacidadeKg) + (v.ano ? ' · ' + v.ano : '') + (v.rastreador ? ' · rastreado' : '') + '</span>' +
        (v.placa ? '<br><span class="placa-br">' + esc(v.placa) + '</span>' : '') + '</span>' +
        '<span class="btn btn-p btn-fantasma" data-editar="' + v.id + '">Editar</span></button>').join('') + '</div>' +
      '<div class="acoes-coluna"><button class="btn" data-acao="novo-veiculo">' + IC.mais + 'Adicionar outro veículo</button></div>' +
      '<div class="acoes-coluna"><button class="btn btn-fantasma btn-perigo" data-acao="sair">' + IC.sair + 'Sair deste aparelho</button></div>' +
      '</section>';
  }

  /* ----- início ----- */
  function telaInicio() {
    const v = veiculoAtual();
    const p = pedidoAtual();
    const fila = lerFila();
    const primeiroNome = (E.eu.nome || '').split(' ')[0];
    let blocoPedido = '';
    if (fila.length) {
      blocoPedido = '<button class="cartao cartao-pedido pendente-box" data-ir="acompanhar"><span><span class="rotulo">Seu pedido</span><br><b>Aguardando envio</b><br><span class="miudo">Sem sinal. Vai sozinho quando a internet voltar.</span></span><span class="etq amarelo">Guardado</span></button>';
    } else if (p) {
      const st = SV.statusEfetivo(p), S = SV.STATUS[st];
      blocoPedido = '<button class="cartao cartao-pedido" data-ir="acompanhar"><span><span class="rotulo">Último pedido · ' + U.desde(p.atualizadoEm) + '</span><br><b>' + esc(S.motorista) + '</b></span><span class="etq ' + S.tom + '">' + (ativo(p) && st !== 'vencida' ? 'Ver' : 'Encerrado') + '</span></button>';
    }
    const temAtivo = p && ativo(p) && SV.statusEfetivo(p) !== 'vencida';
    return topo() + '<section class="tela">' +
      '<div class="saudacao"><h1 class="titulo">Olá, ' + esc(primeiroNome) + '.</h1></div>' +
      (v ? '<button class="cartao cartao-veiculo" data-ir="veiculos" style="width:100%;text-align:left">' +
        '<span class="icone">' + IC.caminhao + '</span><span class="info"><span class="miudo">Veículo selecionado</span><br>' +
        '<span class="nome">' + esc(v.tipo) + ' · ' + esc(v.carroceria) + '</span><br><span class="miudo">' + U.toneladas(v.capacidadeKg) + '</span>' +
        (v.placa ? ' <span class="placa-br">' + esc(v.placa) + '</span>' : '') + '</span><span class="miudo">Trocar</span></button>' : '') +
      blocoPedido +
      '<div class="zona-vazio">' +
      '<button class="btn-vazio" data-acao="vazio">' + (temAtivo ? 'ATUALIZAR<br>MEU AVISO' : 'ESTOU<br>VAZIO') +
      '<small>' + (temAtivo ? 'Mudou de cidade ou de rota? Atualize.' : 'Toque para avisar a Severo') + '</small>' +
      '<span class="caminhao">' + IC.caminhao.replace('stroke-width="2"', 'stroke-width="1.4"') + '</span></button>' +
      '<p class="promessa">Ficou vazio? Avise a Severo. Nosso time busca sua próxima carga.</p></div>' +
      blocoPush() +
      vitrineInicio() +
      '<div class="central"><span class="miudo">Central Severo<br>' + esc(C.centralHorario || '') + '</span>' +
      '<a class="btn btn-p" href="https://wa.me/' + U.soDigitos(C.centralWhatsApp) + '" target="_blank" rel="noopener">' + IC.zap + 'WhatsApp</a></div>' +
      '</section>';
  }

  /* ----- notificações ----- */
  function blocoPush() {
    if (SV.modo !== 'firebase' || SV.pushAtivo() || localStorage.getItem('sv_push_depois')) return '';
    const depois = '<button class="btn btn-p btn-fantasma" data-acao="push-depois">Agora não</button>';
    if (SV.iphoneSemInstalar()) {
      return '<div class="cartao push-card"><b>Receba avisos de proposta e de cargas</b>' +
        '<p class="miudo">No iPhone, as notificações só funcionam com o app na Tela de Início: no Safari, toque em Compartilhar e em <b>Adicionar à Tela de Início</b>. Depois abra o app pelo ícone.</p>' +
        '<div class="audio-acoes">' + depois + '</div></div>';
    }
    if (!SV.pushSuportado() || Notification.permission === 'denied') return '';
    return '<div class="cartao push-card"><b>Receba avisos no celular</b>' +
      '<p class="miudo">Proposta chegou, carga fechada, nova carga para o seu veículo. Mesmo com o app fechado.</p>' +
      '<div class="audio-acoes"><button class="btn btn-primario btn-p" style="flex:1;min-height:46px" data-acao="ativar-push">Ativar notificações</button>' + depois + '</div></div>';
  }

  /* ----- cargas disponíveis ----- */
  function cargasAvaliadas() {
    const v = veiculoAtual();
    const ult = E.pedidos[0] || {};
    const ref = { veiculo: v || {}, uf: ult.uf, cidade: ult.cidade, destinos: ult.destinos || [], aceitaOutras: ult.aceitaOutras, localEm: ult.localEm };
    return E.cargas.map((c) => ({ c: c, r: v ? SV.compatibilidade(ref, c) : { ok: true, falhas: [], pontos: [], nota: 0 }, rota: (ref.destinos || []).includes(c.destinoUF) }))
      .sort((x, y) => (y.r.ok - x.r.ok) || (y.r.nota - x.r.nota) || ((x.c.dataCarregamento || 0) - (y.c.dataCarregamento || 0)));
  }
  function cartaoCarga(x) {
    const c = x.c, ja = E.interesses[c.id];
    const data = c.dataCarregamento ? new Date(c.dataCarregamento).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) : 'a combinar';
    const zap = 'https://wa.me/' + U.soDigitos(C.centralWhatsApp) + '?text=' + encodeURIComponent('Olá! Tenho interesse na carga ' + c.origemCidade + '/' + c.origemUF + ' → ' + c.destinoCidade + '/' + c.destinoUF + ' (' + data + ').');
    return '<article class="cartao carga-m' + (x.r.ok ? '' : ' fraca') + '">' +
      (c.produto ? '<div class="miudo" style="color:var(--laranja-forte);font-weight:600;margin-bottom:.3rem">Carga de ' + esc(c.produto.toLowerCase()) + '</div>' : '') +
      '<div class="rota-m"><span class="escudo-mini">' + esc(c.origemUF) + '</span><b>' + esc(c.origemCidade || '') + '</b><span class="seta">→</span>' +
      '<span class="escudo-mini">' + esc(c.destinoUF) + '</span><b>' + esc(c.destinoCidade || '') + '</b></div>' +
      '<div class="miudo" style="margin:.35rem 0 .6rem">Carrega ' + data + (c.dataDescarga ? ' · descarrega ' + new Date(c.dataDescarga).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) : '') +
      ' · ' + U.toneladas(c.pesoKg) + ' · ' + esc([c.tipoVeiculo, (c.carrocerias || []).join(' ou ')].filter(Boolean).join(' ') || 'qualquer veículo') +
      (c.exigeRastreador ? ' · rastreado' : '') + (c.escolta ? ' · escolta' : '') + (c.anoMinimo ? ' · ano ' + c.anoMinimo + '+' : '') + (c.pagamento ? ' · pagamento ' + esc(c.pagamento) : '') + '</div>' +
      (c.valorOferecido ? '<div class="valor-m num">' + U.moeda(c.valorOferecido) + '<span> para você · ' + U.pedagio(c) + '</span></div>' : '<div class="miudo" style="margin-bottom:.6rem">Valor a combinar</div>') +
      (c.obsMotorista ? '<p class="miudo" style="margin:.2rem 0 .6rem">' + esc(c.obsMotorista) + '</p>' : '') +
      '<div class="chips" style="gap:.4rem;margin-bottom:.8rem">' +
      (x.r.ok ? '<span class="etq verde">Encaixa no seu veículo</span>' : '<span class="etq cinza">Não encaixa: ' + esc(x.r.falhas.join(', ')) + '</span>') +
      (x.rota ? '<span class="etq laranja">Sua rota</span>' : '') + '</div>' +
      (E.negCarga === c.id ? '<div><b>Quanto você pede por esta carga?</b><input class="entrada num" id="negc-valor" inputmode="decimal" placeholder="R$ 0,00" style="margin:.6rem 0">' +
          '<input class="entrada" id="negc-msg" placeholder="Mensagem para a central (opcional)" style="margin-bottom:.7rem">' +
          '<div class="audio-acoes"><button class="btn btn-primario btn-p" style="flex:1;min-height:46px" data-acao="enviar-negc" data-id="' + c.id + '">Enviar pedido</button><button class="btn btn-p btn-fantasma" style="min-height:46px" data-acao="voltar-negc">Voltar</button></div></div>' :
      ja ? '<div class="audio-acoes"><span class="btn btn-p" style="flex:1;pointer-events:none;border-color:var(--verde);color:var(--verde)">' + (ja.valorPedido ? 'Você pediu ' + U.moeda(ja.valorPedido) : 'Interesse enviado') + '</span><a class="btn btn-p" href="' + zap + '" target="_blank" rel="noopener">' + IC.zap + 'Chamar</a></div>'
          : '<div class="audio-acoes"><button class="btn btn-primario btn-p" style="flex:1;min-height:46px" data-acao="interesse" data-id="' + c.id + '">Tenho interesse</button>' +
            '<button class="btn btn-p" style="min-height:46px" data-acao="negociar-carga" data-id="' + c.id + '">Quero negociar</button>' +
            '<a class="btn btn-p" style="min-height:46px" href="' + zap + '" target="_blank" rel="noopener" aria-label="WhatsApp">' + IC.zap + '</a></div>') +
      '</article>';
  }
  function vitrineInicio() {
    if (!E.cargas.length) return '';
    const l = cargasAvaliadas(), encaixam = l.filter((x) => x.r.ok).length;
    return '<div class="bloco"><h2>Cargas na Severo agora <small>' + l.length + ' disponíve' + (l.length === 1 ? 'l' : 'is') + '</small></h2>' +
      l.slice(0, 2).map(cartaoCarga).join('') +
      '<button class="btn" style="width:100%;margin-top:.7rem" data-ir="cargas">Ver todas as cargas' + (encaixam ? ' · ' + encaixam + ' encaixam no seu veículo' : '') + '</button></div>';
  }
  function telaCargas() {
    const todas = cargasAvaliadas(), minhas = todas.filter((x) => x.r.ok);
    const filtro = E.filtroCargas || (minhas.length ? 'meu' : 'todas');
    const l = filtro === 'meu' ? minhas : todas;
    return topo('inicio') + '<section class="tela">' +
      '<h1 class="titulo" style="margin-top:1rem">Cargas disponíveis</h1>' +
      '<p class="sub">Cargas da Severo esperando veículo. Toque em “Tenho interesse” e a central fala com você.</p>' +
      '<div class="segmentos" style="margin-bottom:1rem">' +
      '<button class="chip" data-acao="filtro-cargas" data-valor="meu" aria-pressed="' + (filtro === 'meu') + '">Para meu veículo (' + minhas.length + ')</button>' +
      '<button class="chip" data-acao="filtro-cargas" data-valor="todas" aria-pressed="' + (filtro === 'todas') + '">Todas (' + todas.length + ')</button></div>' +
      (l.length ? l.map(cartaoCarga).join('') : '<div class="cartao"><b>Nenhuma carga ' + (filtro === 'meu' ? 'para o seu veículo' : 'disponível') + ' agora.</b><p class="miudo" style="margin:.4rem 0 0">Avise que está vazio e a Severo busca uma para a sua rota.</p></div>') +
      '<div class="acoes-coluna"><button class="btn btn-primario btn-grande" data-acao="vazio">Avisar que estou vazio</button></div></section>';
  }

  /* ----- pedido ----- */
  function novoForm() {
    const ult = E.pedidos[0];
    return {
      cidade: ult ? ult.cidade : '', uf: ult ? ult.uf : '', bairro: ult ? (ult.bairro || '') : '', lat: null, lng: null, localOk: false,
      quando: 'agora', dataHora: '', ocupacao: 'vazio', livreT: '',
      destinos: ult ? (ult.destinos || []).slice() : [], aceitaOutras: ult ? !!ult.aceitaOutras : false,
      obs: '', audio: null, audioUrl: null, audioSeg: 0
    };
  }
  function telaPedido() {
    const F = E.form;
    const ufOpts = '<option value="">UF</option>' + SV.UFS.slice().sort().map((u) => '<option' + (u === F.uf ? ' selected' : '') + '>' + u + '</option>').join('');
    return topo('inicio') + '<section class="tela"><form id="f-ped" novalidate>' +
      '<h1 class="titulo" style="margin-top:1rem">Onde você está e para onde quer ir?</h1>' +
      '<p class="sub">Prefere falar? Grave um áudio lá embaixo e o operador completa para você.</p>' +

      '<div class="bloco"><h2>Onde estou</h2>' +
      '<button type="button" class="btn btn-local' + (F.localOk ? ' ok' : '') + '" data-acao="localizar">' + IC.alvo + '<span>' + (F.localOk ? 'Localização registrada' : 'Usar minha localização') + '</span></button>' +
      '<div class="linha-campos"><label class="campo" style="margin:0"><span class="sr">Cidade</span><input name="cidade" placeholder="Cidade" value="' + esc(F.cidade) + '" autocomplete="address-level2"></label>' +
      '<label class="campo" style="margin:0"><span class="sr">UF</span><select name="uf">' + ufOpts + '</select></label></div>' +
      '<label class="campo" style="margin:.7rem 0 0"><span class="sr">Bairro ou referência</span><input name="bairro" placeholder="Bairro, posto ou rodovia (ex.: Posto Graal, km 32)" value="' + esc(F.bairro) + '"></label></div>' +

      '<div class="bloco"><h2>Quando posso carregar</h2>' +
      '<div class="segmentos" data-grupo="quando">' + [['agora', 'Agora'], ['hoje', 'Hoje'], ['amanha', 'Amanhã'], ['data', 'Outra data']].map((o) =>
        '<button type="button" class="chip" data-valor="' + o[0] + '" aria-pressed="' + (F.quando === o[0]) + '">' + o[1] + '</button>').join('') + '</div>' +
      '<label class="campo' + (F.quando === 'agora' ? ' oculto' : '') + '" id="c-hora" style="margin-top:.7rem"><span class="sr">Data e hora</span>' +
      '<input type="' + (F.quando === 'data' ? 'datetime-local' : 'time') + '" name="dataHora" value="' + esc(F.dataHora) + '"><small>Horário opcional.</small></label></div>' +

      '<div class="bloco"><h2>Como está o veículo</h2>' +
      '<div class="segmentos" data-grupo="ocupacao">' +
      '<button type="button" class="chip" data-valor="vazio" aria-pressed="' + (F.ocupacao === 'vazio') + '">Vazio</button>' +
      '<button type="button" class="chip" data-valor="parcial" aria-pressed="' + (F.ocupacao === 'parcial') + '">Parcialmente livre</button></div>' +
      '<label class="campo' + (F.ocupacao === 'parcial' ? '' : ' oculto') + '" id="c-livre" style="margin-top:.7rem"><span>Quanto ainda cabe (toneladas)</span><input name="livreT" inputmode="decimal" value="' + esc(F.livreT) + '"></label></div>' +

      '<div class="bloco"><h2>Para onde quer ir <small>até 3, em ordem</small></h2>' +
      '<div class="escudos" id="escudos">' + SV.UFS.map((u) => escudo(u)).join('') + '</div>' +
      '<label class="interruptor" style="margin-top:.9rem">Aceito outras rotas<input type="checkbox" name="aceitaOutras"' + (F.aceitaOutras ? ' checked' : '') + '></label></div>' +

      '<div class="bloco"><h2>Falar com a Severo <small>opcional</small></h2><div id="bloco-audio">' + blocoAudio() + '</div></div>' +

      '<div class="bloco"><label class="campo"><span>Observações</span><textarea name="obs" placeholder="Ex.: baú plotado, prefiro carga paletizada">' + esc(F.obs) + '</textarea></label></div>' +

      '<div class="rodape-fixo"><div><button class="btn btn-primario btn-grande" type="submit">Enviar para a Severo</button></div></div>' +
      '</form></section>';
  }
  function escudo(uf) {
    const i = E.form.destinos.indexOf(uf);
    return '<button type="button" class="escudo" data-uf="' + uf + '" aria-pressed="' + (i >= 0) + '" aria-label="' + uf + (i >= 0 ? ', ' + (i + 1) + 'ª opção' : '') + '">' +
      (i >= 0 ? '<span class="ordem">' + (i + 1) + '</span>' : '') + '<span class="placa">' + uf + '</span></button>';
  }
  function blocoAudio() {
    const F = E.form;
    if (E.grav) {
      return '<div class="audio-caixa gravando"><button type="button" class="mic" data-acao="parar"><span class="bola">' + IC.parar + '</span>' +
        '<span><b>Gravando <span id="tempo" class="num">0:00</span></b><span>Toque para parar</span></span></button>' +
        '<div class="ondas" id="ondas">' + '<i></i>'.repeat(28) + '</div></div>';
    }
    if (F.audio) {
      return '<div class="audio-caixa audio-pronto"><audio controls src="' + F.audioUrl + '"></audio>' +
        '<div class="audio-acoes"><button type="button" class="btn btn-p" data-acao="gravar">' + IC.refazer + 'Regravar</button>' +
        '<button type="button" class="btn btn-p btn-fantasma" data-acao="apagar-audio">' + IC.lixo + 'Apagar</button></div></div>';
    }
    return '<div class="audio-caixa"><button type="button" class="mic" data-acao="gravar"><span class="bola">' + IC.mic + '</span>' +
      '<span><b>Gravar áudio</b><span>Fale onde está, o veículo e para onde quer ir.</span></span></button>' +
      '<p class="exemplo-audio">“Estou vazio em Contagem. Carreta baú, 28 toneladas. Quero Rio, São Paulo ou Espírito Santo. Posso carregar hoje.”</p></div>';
  }

  function ligarPedido() {
    const f = $('#f-ped');
    const F = E.form;
    ligarChips(f, (grupo, valor) => {
      if (grupo === 'quando') {
        F.quando = valor;
        const c = $('#c-hora');
        c.classList.toggle('oculto', valor === 'agora');
        f.dataHora.type = valor === 'data' ? 'datetime-local' : 'time';
        f.dataHora.value = '';
      }
      if (grupo === 'ocupacao') { F.ocupacao = valor; $('#c-livre').classList.toggle('oculto', valor !== 'parcial'); }
    });
    $('#escudos').addEventListener('click', (e) => {
      const b = e.target.closest('[data-uf]');
      if (!b) return;
      const uf = b.dataset.uf, i = F.destinos.indexOf(uf);
      if (i >= 0) F.destinos.splice(i, 1);
      else if (F.destinos.length >= 3) return aviso('Escolha até 3 destinos. Toque em um para tirar.');
      else F.destinos.push(uf);
      $('#escudos').innerHTML = SV.UFS.map(escudo).join('');
      if (navigator.vibrate) navigator.vibrate(8);
    });
    f.addEventListener('submit', (e) => { e.preventDefault(); enviar(f); });
    // ao tocar em um campo, ele sobe para cima do teclado
    f.addEventListener('focusin', (e) => {
      if (!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
    });
  }

  function lerFormulario(f) {
    const F = E.form;
    F.cidade = f.cidade.value.trim();
    F.bairro = f.bairro.value.trim();
    F.uf = f.uf.value;
    F.dataHora = f.dataHora.value;
    F.livreT = f.livreT.value;
    F.aceitaOutras = f.aceitaOutras.checked;
    F.obs = f.obs.value.trim();
  }

  function montarQuando(F) {
    const agoraMs = Date.now();
    if (F.quando === 'agora') return { tipo: 'agora', em: agoraMs };
    if (F.quando === 'data') {
      const t = F.dataHora ? new Date(F.dataHora).getTime() : agoraMs + 86400000;
      return { tipo: 'data', em: t, comHora: !!F.dataHora };
    }
    const d = new Date();
    if (F.quando === 'amanha') d.setDate(d.getDate() + 1);
    if (F.dataHora) { const hm = F.dataHora.split(':'); d.setHours(+hm[0], +hm[1], 0, 0); }
    return { tipo: F.quando, em: d.getTime(), comHora: !!F.dataHora };
  }

  async function enviar(f) {
    lerFormulario(f);
    const F = E.form;
    const temAudio = !!F.audio;
    if (!temAudio) {
      if (!F.cidade || !F.uf) { f.cidade.classList.toggle('erro-campo', !F.cidade); return aviso('Informe a cidade e a UF onde você está, ou grave um áudio.', true); }
      if (!F.destinos.length && !F.aceitaOutras) return aviso('Escolha pelo menos um destino ou marque “Aceito outras rotas”.', true);
    }
    const v = veiculoAtual();
    if (!v) { E.editVeiculo = {}; return ir('veiculo'); }
    const pacote = {
      id: U.novoId(),
      motorista: { id: E.eu.id, nome: E.eu.nome, telefone: E.eu.telefone },
      veiculo: v,
      cidade: F.cidade, uf: F.uf, bairro: F.bairro, lat: F.lat, lng: F.lng,
      quando: montarQuando(F),
      ocupacao: F.ocupacao,
      capacidadeLivreKg: F.ocupacao === 'parcial' ? Math.round(parseFloat(String(F.livreT).replace(',', '.')) * 1000) || null : null,
      destinos: F.destinos.slice(), aceitaOutras: F.aceitaOutras, obs: F.obs
    };
    const btn = $('button[type=submit]', f);
    btn.disabled = true; btn.textContent = 'Enviando…';
    if (!navigator.onLine) {
      await enfileirar(pacote, F.audio);
      E.form = null;
      aviso('Sem sinal agora. Seu pedido ficou guardado e vai sozinho quando a internet voltar.');
      return ir('acompanhar');
    }
    try {
      await comPrazo(SV.enviarPedido(Object.assign({}, pacote, { audio: F.audio })), 25000);
      E.form = null;
      if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
      aviso('Pedido recebido pela Severo.');
      ir('acompanhar');
    } catch (err) {
      await enfileirar(pacote, F.audio);
      E.form = null;
      aviso('Conexão fraca. Seu pedido ficou guardado e vai sozinho quando o sinal melhorar.');
      ir('acompanhar');
    }
  }

  /* ----- localização ----- */
  function localizar(btn) {
    if (!('geolocation' in navigator)) return aviso('Este aparelho não informa a localização. Digite a cidade.', true);
    const span = $('span', btn);
    btn.disabled = true; span.textContent = 'Localizando…';
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const F = E.form;
      F.lat = +pos.coords.latitude.toFixed(5); F.lng = +pos.coords.longitude.toFixed(5); F.localOk = true;
      try {
        const r = await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&accept-language=pt-BR&lat=' + F.lat + '&lon=' + F.lng);
        const j = await r.json();
        const a = j.address || {};
        const cidade = a.city || a.town || a.village || a.municipality || a.county || '';
        const uf = (a['ISO3166-2-lvl4'] || '').replace('BR-', '');
        const bairro = a.suburb || a.neighbourhood || a.quarter || a.city_district || a.hamlet || a.road || '';
        const f = $('#f-ped');
        if (cidade) f.cidade.value = cidade;
        if (bairro) f.bairro.value = bairro;
        if (uf && SV.UFS.includes(uf)) f.uf.value = uf;
        aviso(cidade ? 'Você está em ' + (bairro ? bairro + ', ' : '') + cidade + (uf ? '/' + uf : '') + '. Confira e corrija se precisar.' : 'Localização registrada. Confira a cidade.');
      } catch (e) {
        aviso('Localização registrada. Digite a cidade para conferir.');
      }
      btn.disabled = false; btn.classList.add('ok'); span.textContent = 'Localização registrada';
    }, (err) => {
      btn.disabled = false; span.textContent = 'Usar minha localização';
      aviso(err.code === 1 ? 'A localização está bloqueada. Digite a cidade.' : 'Não deu para localizar agora. Digite a cidade.', true);
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
  }

  /* ----- áudio ----- */
  async function gravar() {
    if (!navigator.mediaDevices || !window.MediaRecorder) return aviso('Este navegador não grava áudio. Use as observações.', true);
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { return aviso('Libere o microfone para gravar o áudio.', true); }
    const tipo = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
    const opcoes = { audioBitsPerSecond: 24000 };
    if (tipo) opcoes.mimeType = tipo;
    let rec;
    try { rec = new MediaRecorder(stream, opcoes); } catch (e) { rec = new MediaRecorder(stream); }
    const partes = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) partes.push(e.data); };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const g = E.grav; E.grav = null;
      if (g && g.ctx) g.ctx.close();
      if (g && g.descartar) return;
      if (!partes.length || !E.form) return;
      const blob = new Blob(partes, { type: rec.mimeType || tipo || 'audio/webm' });
      if (E.form.audioUrl) URL.revokeObjectURL(E.form.audioUrl);
      E.form.audio = blob; E.form.audioUrl = URL.createObjectURL(blob);
      E.form.audioSeg = Math.round((Date.now() - g.inicio) / 1000);
      const b = $('#bloco-audio'); if (b) b.innerHTML = blocoAudio();
    };
    E.grav = { rec: rec, inicio: Date.now() };
    rec.start(250);
    const b = $('#bloco-audio'); b.innerHTML = blocoAudio();
    if (navigator.vibrate) navigator.vibrate(15);
    // nível do microfone em tempo real
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx(); const an = ctx.createAnalyser(); an.fftSize = 64;
      ctx.createMediaStreamSource(stream).connect(an);
      E.grav.ctx = ctx;
      const dados = new Uint8Array(an.frequencyBinCount);
      const quadro = () => {
        if (!E.grav || E.grav.rec !== rec) return;
        an.getByteFrequencyData(dados);
        $$('#ondas i').forEach((el, i) => { el.style.height = Math.max(8, dados[i % dados.length] / 255 * 100) + '%'; });
        requestAnimationFrame(quadro);
      };
      quadro();
    } catch (e) { /* sem visualização, segue gravando */ }
    E.grav.timer = setInterval(() => {
      if (!E.grav) return;
      const s = Math.floor((Date.now() - E.grav.inicio) / 1000);
      const t = $('#tempo'); if (t) t.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      const limite = C.usarStorage ? 90 : 60;
      if (s >= limite) { pararGravacao(); aviso('Áudio limitado a ' + (limite === 60 ? '1 minuto' : '1 min e 30 s') + '.'); }
    }, 250);
  }
  function pararGravacao(descartar) {
    if (!E.grav) return;
    clearInterval(E.grav.timer);
    E.grav.descartar = !!descartar;
    if (E.grav.rec.state !== 'inactive') E.grav.rec.stop();
  }

  /* ----- acompanhamento ----- */
  function telaAcompanhar() {
    const fila = lerFila();
    if (fila.length) {
      const pk = fila[fila.length - 1].pacote;
      return topo('inicio') + '<section class="tela"><div class="estado-grande"><span class="etq amarelo">Guardado no aparelho</span>' +
        '<h1 class="titulo" style="margin-top:.7rem">Aguardando envio</h1>' +
        '<p class="sub">Sem sinal estável. Seu pedido vai sozinho assim que a internet voltar. Só mostramos “recebido” quando a Severo confirmar.</p></div>' +
        resumo(pk) +
        '<div class="acoes-coluna"><button class="btn btn-primario btn-grande" data-acao="tentar">' + IC.refazer + 'Tentar enviar agora</button></div></section>';
    }
    const p = pedidoAtual();
    if (!p) return topo('inicio') + '<section class="tela"><div class="estado-grande"><h1 class="titulo">Nenhum pedido ainda</h1><p class="sub">Quando ficar vazio, avise pelo botão da tela inicial.</p></div></section>';
    const st = SV.statusEfetivo(p), S = SV.STATUS[st];
    const passos = ['Recebido', 'Em atendimento', 'Proposta', 'Carga fechada'];
    const idx = { disponivel: 0, em_atendimento: 1, proposta_enviada: 2, contraproposta: 2, aguardando_aprovacao: 2, carga_fechada: 3, carregado: 3 }[st];
    const trilha = idx == null ? '' : '<ol class="trilha">' + passos.map((n, i) =>
      '<li class="' + (i < idx || (i === idx && idx === 3) ? 'feito' : i === idx ? 'agora' : '') + '">' + n + '</li>').join('') + '</ol>';
    const pr = p.proposta;
    const propostaHtml = pr && (st === 'proposta_enviada' || st === 'contraproposta' || st === 'aguardando_aprovacao' || st === 'carga_fechada') ?
      '<div class="cartao proposta-box"><span class="miudo">Proposta da Severo</span><div class="valor num">' + U.moeda(pr.valorParceiro) + '</div>' +
      (pr.rota ? '<b>' + esc(pr.rota) + '</b><br>' : '') +
      '<span class="miudo">' + (U.pedagio(pr).replace(/^p/, 'P') + (pr.pedagio ? ' (' + U.moeda(pr.pedagio) + ')' : '') + '. ') + esc(pr.pagamento || '') + '</span>' +
      (st === 'contraproposta' && p.contraproposta ? '<div class="cartao" style="margin-top:1rem;background:var(--asfalto)"><span class="miudo">Você pediu</span><div class="valor-m num" style="margin:.2rem 0">' + U.moeda(p.contraproposta.valor) + '</div>' +
        (p.contraproposta.mensagem ? '<span class="miudo">“' + esc(p.contraproposta.mensagem) + '”</span>' : '') + '<p class="miudo" style="margin:.5rem 0 0">Aguardando a resposta da Severo.</p></div>' : '') +
      (st === 'proposta_enviada' && E.negociar
        ? '<div style="margin-top:1rem"><b>Quanto você pede pelo frete?</b>' +
          '<input class="entrada num" id="neg-valor" inputmode="decimal" placeholder="R$ 0,00" style="margin:.6rem 0">' +
          '<input class="entrada" id="neg-msg" placeholder="Explique, se quiser (ex.: rota tem muito pedágio)" style="margin-bottom:.7rem">' +
          '<div class="audio-acoes"><button class="btn btn-primario" style="flex:1" data-acao="enviar-negociacao">Enviar pedido</button><button class="btn btn-fantasma" data-acao="voltar-negociacao">Voltar</button></div></div>'
        : '') +
      (st === 'proposta_enviada' && !E.negociar ? (E.recusa
        ? '<div style="margin-top:1rem"><b>Por que não serve?</b><div class="chips" data-grupo="motivo" style="margin:.6rem 0">' +
          SV.MOTIVOS_RECUSA.map((m) => '<button type="button" class="chip" data-valor="' + esc(m) + '" aria-pressed="false">' + esc(m) + '</button>').join('') + '</div>' +
          '<input class="entrada" id="recusa-obs" placeholder="Quer dizer algo ao operador? (opcional)" style="margin-bottom:.7rem">' +
          '<div class="audio-acoes"><button class="btn btn-primario" data-acao="enviar-recusa">Enviar resposta</button><button class="btn btn-fantasma" data-acao="voltar-recusa">Voltar</button></div></div>'
        : '<div class="audio-acoes" style="margin-top:1rem"><button class="btn btn-primario" style="flex:1" data-acao="aceitar">Aceitar</button><button class="btn" data-acao="negociar">Quero negociar</button></div>' +
          '<button class="btn btn-fantasma" style="width:100%;margin-top:.4rem" data-acao="recusar">Recusar proposta</button>')
      : st === 'aguardando_aprovacao' && p.respostaMotorista && p.respostaMotorista.aceita ? '<p class="miudo" style="margin:.6rem 0 0">Você aceitou ' + U.desde(p.respostaMotorista.em) + '.</p>' : '') +
      '</div>' : '';
    const podeRenovar = ativo(p);
    const quaseVencendo = podeRenovar && p.expiraEm - Date.now() < 3 * 3600000;
    return topo('inicio') + '<section class="tela"><div class="estado-grande">' +
      '<span class="etq ' + S.tom + '">' + esc(U.desde(p.atualizadoEm)) + '</span>' +
      '<h1 class="titulo" style="margin-top:.7rem">' + esc(S.motorista) + '</h1>' +
      '<p class="sub">' + esc(S.passo) + '</p></div>' + trilha + propostaHtml +
      '<div class="cartao" style="margin-top:.7rem">' + resumo(p, true) + '</div>' +
      '<div class="acoes-coluna">' +
      (st === 'vencida' || quaseVencendo ? '<button class="btn btn-primario btn-grande" data-acao="renovar">Ainda estou vazio</button>' : '') +
      (!ativo(p) ? '<button class="btn btn-primario btn-grande" data-acao="vazio">Avisar que estou vazio</button>' : '<button class="btn" data-acao="vazio">Atualizar pedido</button>') +
      '<a class="btn" href="https://wa.me/' + U.soDigitos(C.centralWhatsApp) + '" target="_blank" rel="noopener">' + IC.zap + 'Falar com a central</a>' +
      (ativo(p) ? '<button class="btn btn-fantasma btn-perigo" data-acao="cancelar">Cancelar pedido</button>' : '') +
      '</div>' +
      (podeRenovar && st !== 'vencida' ? '<p class="miudo" style="text-align:center;margin-top:1rem">Seu aviso vale até ' + new Date(p.expiraEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '.</p>' : '') +
      '</section>';
  }
  function resumo(p, semCaixa) {
    const v = p.veiculo || {};
    const dests = (p.destinos || []).length ? '<span class="escudos-mini">' + p.destinos.map((u) => '<span class="escudo-mini">' + u + '</span>').join('') + '</span>' : '';
    const html = '<dl class="resumo">' +
      '<dt>Onde</dt><dd>' + (p.bairro ? esc(p.bairro) + '<br>' : '') + esc(p.cidade || 'Pelo áudio') + (p.uf ? '/' + esc(p.uf) : '') + '</dd>' +
      '<dt>Veículo</dt><dd>' + esc(v.tipo || '') + ' · ' + esc(v.carroceria || '') + ' · ' + U.toneladas(p.capacidadeLivreKg || v.capacidadeKg) + '</dd>' +
      '<dt>Carregar</dt><dd>' + U.quando(p.quando) + '</dd>' +
      '<dt>Destinos</dt><dd>' + (dests || '—') + (p.aceitaOutras ? '<br><span class="miudo">aceita outras rotas</span>' : '') + '</dd>' +
      (p.audioUrl || p.audio ? '<dt>Áudio</dt><dd>Enviado</dd>' : '') +
      '</dl>';
    return semCaixa ? html : '<div class="cartao">' + html + '</div>';
  }

  /* ---------- eventos globais ---------- */
  raiz.addEventListener('click', async (e) => {
    const alvoIr = e.target.closest('[data-ir]');
    if (alvoIr) { e.preventDefault(); return ir(alvoIr.dataset.ir); }
    const ed = e.target.closest('[data-editar]');
    if (ed) { e.stopPropagation(); E.editVeiculo = Object.assign({}, E.veiculos.find((v) => v.id === ed.dataset.editar)); return ir('veiculo'); }
    const esc2 = e.target.closest('[data-escolher]');
    if (esc2) { localStorage.setItem(CHAVE_VEIC, esc2.dataset.escolher); aviso('Veículo selecionado.'); return ir('inicio'); }
    const chipMotivo = e.target.closest('[data-grupo="motivo"] .chip');
    if (chipMotivo) { $$('.chip', chipMotivo.parentElement).forEach((x) => x.setAttribute('aria-pressed', String(x === chipMotivo))); return; }
    const b = e.target.closest('[data-acao]');
    if (!b) return;
    const acao = b.dataset.acao;
    if (acao === 'vazio') {
      if (!veiculoAtual()) { E.editVeiculo = {}; return ir('veiculo'); }
      const vv = veiculoAtual();
      if (!vv.placa || !vv.ano || !vv.capacidadeKg) { E.editVeiculo = Object.assign({}, vv); aviso('Complete os dados do veículo para continuar.'); return ir('veiculo'); }
      E.form = novoForm();
      history.pushState({}, '');
      return ir('pedido');
    }
    if (acao === 'localizar') return localizar(b);
    if (acao === 'gravar') { lerFormulario($('#f-ped')); return gravar(); }
    if (acao === 'parar') return pararGravacao();
    if (acao === 'apagar-audio') {
      if (E.form.audioUrl) URL.revokeObjectURL(E.form.audioUrl);
      E.form.audio = null; E.form.audioUrl = null;
      $('#bloco-audio').innerHTML = blocoAudio();
      return;
    }
    if (acao === 'novo-veiculo') { E.editVeiculo = {}; return ir('veiculo'); }
    if (acao === 'tentar') { if (!navigator.onLine) return aviso('Ainda sem internet. Vamos tentar sozinhos quando voltar.'); b.disabled = true; return enviarFila(); }
    if (acao === 'aceitar') {
      const p = pedidoAtual(), pr = p.proposta || {};
      if (!confirm('Aceitar ' + U.moeda(pr.valorParceiro) + (pr.rota ? ' para ' + pr.rota : '') + '?')) return;
      try { await SV.responderProposta(p, true); aviso('Proposta aceita. A Severo vai conferir os documentos e confirmar.'); if (navigator.vibrate) navigator.vibrate([20, 40, 20]); }
      catch (err) { aviso(msgErro(err), true); }
      return;
    }
    if (acao === 'recusar') { E.recusa = true; return desenhar(); }
    if (acao === 'negociar') { E.negociar = true; desenhar(); const i = $('#neg-valor'); if (i) i.focus(); return; }
    if (acao === 'voltar-negociacao') { E.negociar = false; return desenhar(); }
    if (acao === 'enviar-negociacao') {
      const v = parseFloat(String($('#neg-valor').value).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
      if (!v || v <= 0) return aviso('Digite o valor que você pede.', true);
      try { await SV.negociarProposta(pedidoAtual(), v, ($('#neg-msg').value || '').trim()); E.negociar = false; aviso('Pedido de negociação enviado. A Severo vai responder.'); desenhar(); }
      catch (err) { aviso(msgErro(err), true); }
      return;
    }
    if (acao === 'negociar-carga') { E.negCarga = b.dataset.id; desenhar(); const i = $('#negc-valor'); if (i) i.focus(); return; }
    if (acao === 'voltar-negc') { E.negCarga = null; return desenhar(); }
    if (acao === 'enviar-negc') {
      const c = E.cargas.find((x) => x.id === b.dataset.id);
      const v = parseFloat(String($('#negc-valor').value).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
      if (!c) return;
      if (!v || v <= 0) return aviso('Digite o valor que você pede.', true);
      b.disabled = true;
      try { await SV.registrarInteresse(c, E.eu, veiculoAtual(), { valor: v, mensagem: ($('#negc-msg').value || '').trim() }); E.negCarga = null; aviso('Pedido enviado. A central vai falar com você.'); }
      catch (err) { b.disabled = false; aviso(msgErro(err), true); }
      return;
    }
    if (acao === 'voltar-recusa') { E.recusa = false; return desenhar(); }
    if (acao === 'enviar-recusa') {
      const m = $('[data-grupo="motivo"] .chip[aria-pressed="true"]');
      if (!m) return aviso('Escolha o motivo.', true);
      try { await SV.responderProposta(pedidoAtual(), false, m.dataset.valor, ($('#recusa-obs').value || '').trim()); E.recusa = false; aviso('Resposta enviada. Seguimos buscando outra carga para você.'); desenhar(); }
      catch (err) { aviso(msgErro(err), true); }
      return;
    }
    if (acao === 'ativar-push') {
      b.disabled = true;
      try { await SV.ativarPush('motoristas', E.eu.id, true); aviso('Pronto! Você vai receber os avisos da Severo.'); }
      catch (err) { aviso(err.message, true); }
      return desenhar();
    }
    if (acao === 'push-depois') { localStorage.setItem('sv_push_depois', '1'); return desenhar(); }
    if (acao === 'filtro-cargas') { E.filtroCargas = b.dataset.valor; return desenhar(); }
    if (acao === 'interesse') {
      const c = E.cargas.find((x) => x.id === b.dataset.id);
      if (!c) return;
      b.disabled = true;
      try { await SV.registrarInteresse(c, E.eu, veiculoAtual()); aviso('Interesse enviado. A central vai falar com você.'); if (navigator.vibrate) navigator.vibrate(20); }
      catch (err) { b.disabled = false; aviso(msgErro(err), true); }
      return;
    }
    if (acao === 'renovar') {
      try { await SV.renovar(pedidoAtual()); aviso('Pronto. Seu aviso vale por mais ' + SV.validadeHoras + ' horas.'); }
      catch (err) { aviso(msgErro(err), true); }
      return;
    }
    if (acao === 'cancelar') {
      if (!confirm('Cancelar seu aviso de disponibilidade?')) return;
      try { await SV.cancelarPeloMotorista(pedidoAtual()); aviso('Pedido cancelado.'); }
      catch (err) { aviso(msgErro(err), true); }
      return;
    }
    if (acao === 'sair') {
      if (!confirm('Sair deste aparelho? Seus dados continuam salvos na Severo.')) return;
      E.pararObs.forEach((f) => f()); E.pararObs = [];
      await SV.sairMotorista();
      localStorage.removeItem(CHAVE_VEIC);
      E.eu = null; E.veiculos = []; E.pedidos = [];
      return ir('cadastro');
    }
  });

  /* ---------- utilidades de formulário ---------- */
  function ligarChips(raizForm, aoMudar) {
    raizForm.addEventListener('click', (e) => {
      const c = e.target.closest('[data-grupo] > .chip');
      if (!c) return;
      const g = c.parentElement;
      $$('.chip', g).forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
      if (aoMudar) aoMudar(g.dataset.grupo, c.dataset.valor);
    });
  }
  const valorChip = (f, grupo) => { const c = $('[data-grupo="' + grupo + '"] .chip[aria-pressed="true"]', f); return c ? c.dataset.valor : ''; };
  function travar(f, txt) { const b = $('button[type=submit]', f); b.disabled = true; b.dataset.txt = b.textContent; b.textContent = txt; }
  function destravar(f, txt) { const b = $('button[type=submit]', f); b.disabled = false; b.textContent = txt; }
  function msgErro(err) {
    const m = (err && err.message) || '';
    if (/network|offline|unavailable|prazo/i.test(m)) return 'Sem conexão com a Severo. Tente de novo em instantes.';
    if (/permission/i.test(m)) return 'Acesso negado. Fale com a central.';
    return m || 'Algo deu errado. Tente de novo.';
  }

  /* ---------- dados em tempo real ---------- */
  function observar() {
    E.pararObs.forEach((f) => f());
    E.pararObs = [
      SV.observarEu(E.eu.id, (m) => {
        if (!m) { E.pararObs.forEach((f) => f()); E.pararObs = []; SV.sairMotorista().catch(() => {}); E.eu = null; E.veiculos = []; E.pedidos = []; return ir('cadastro'); }
        E.eu = m;
        if (m.bloqueado && E.tela !== 'bloqueado') return ir('bloqueado');
        if (!m.bloqueado && E.tela === 'bloqueado') return ir('inicio');
      }),
      SV.observarVeiculos(E.eu.id, (l) => {
        E.veiculos = l.sort((a, b) => (a.atualizadoEm || 0) - (b.atualizadoEm || 0));
        E.veiculosOk = true;
        if (E.tela === 'bloqueado' || (E.eu && E.eu.bloqueado)) return;
        if (!E.veiculos.length && E.tela !== 'veiculo' && E.tela !== 'cadastro') { E.editVeiculo = {}; return ir('veiculo'); }
        if (E.tela === 'carregando') return ir('inicio');
        if (E.tela === 'inicio' || E.tela === 'veiculos') desenhar();
      }),
      SV.observarMeusPedidos(E.eu.id, (l) => {
        const antes = E.pedidos[0] && E.pedidos[0].status;
        E.pedidos = l;
        const depois = l[0] && l[0].status;
        if (antes && depois && antes !== depois) {
          aviso(SV.STATUS[depois].motorista + '. ' + SV.STATUS[depois].passo);
          if (navigator.vibrate) navigator.vibrate([30, 60, 30]);
        }
        if (E.tela === 'inicio' || (E.tela === 'acompanhar' && !E.recusa && !E.negociar)) desenhar();
      }),
      SV.observarCargasPublicas((l) => {
        E.cargas = l.filter((c) => c.status === 'aberta' && (!c.dataCarregamento || c.dataCarregamento > Date.now() - 86400000));
        if ((E.tela === 'inicio' || E.tela === 'cargas') && !E.negCarga) desenhar();
      }),
      SV.observarMeusInteresses(E.eu.id, (l) => {
        E.interesses = {}; l.forEach((i) => { E.interesses[i.cargaId] = i; });
        if (E.tela === 'cargas' || E.tela === 'inicio') desenhar();
      })
    ];
  }

  /* ---------- partida ---------- */
  async function iniciar() {
    desenhar();
    try { await SV.iniciar('motorista'); }
    catch (e) { raiz.innerHTML = topo() + '<div class="carregando">Sem conexão para abrir o app. Verifique a internet e toque para tentar de novo.</div>'; raiz.onclick = () => location.reload(); return; }
    if (location.protocol.indexOf('http') === 0 && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
    E.eu = await SV.eu();
    if (!E.eu) return ir('cadastro');
    if (E.eu.bloqueado) { observar(); return ir('bloqueado'); }
    observar();
    if (SV.pushAtivo()) SV.ativarPush('motoristas', E.eu.id, false).catch(() => {});
    enviarFila();
    setInterval(() => { if (E.tela === 'inicio' || E.tela === 'acompanhar') desenhar(); }, 60000);
  }
  window.addEventListener('online', () => { aviso('Internet de volta.'); enviarFila(); });
  window.addEventListener('offline', () => aviso('Sem internet. Se enviar um pedido, ele fica guardado.'));
  iniciar();
})();
