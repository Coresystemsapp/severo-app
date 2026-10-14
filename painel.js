/* Severo · painel da central */
(function () {
  'use strict';
  const SV = window.SV, IC = window.IC, C = window.SEVERO_CONFIG || {}, U = SV.util;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = U.esc;
  const raiz = $('#app');
  const META_MIN = C.metaPrimeiroContatoMin || 15;
  const ENCERRADOS = ['sem_carga', 'cancelado'];

  const P = {
    op: null, fila: [], atend: {}, cargas: [],
    sel: null, selCarga: null, aba: 'fila',
    f: { grupo: 'ativos', busca: '', uf: '', carroceria: '', destino: '', meus: false },
    vistos: null, parar: []
  };
  const veGestao = () => P.op && (P.op.papel === 'gestao' || P.op.papel === 'financeiro');

  /* ---------- aviso ---------- */
  let tAviso;
  function aviso(txt, erro) {
    const a = $('#aviso');
    a.textContent = txt;
    a.classList.toggle('erro', !!erro);
    a.classList.add('mostrar');
    clearTimeout(tAviso);
    tAviso = setTimeout(() => a.classList.remove('mostrar'), 4500);
  }
  function bipe() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext; const ctx = new Ctx();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; g.gain.setValueAtTime(.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(.12, ctx.currentTime + .02);
      g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .35);
      o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + .4);
    } catch (e) { /* sem som */ }
  }

  /* ---------- login ---------- */
  function telaLogin() {
    const demo = SV.modo === 'demo';
    raiz.innerHTML = '<div class="login"><form id="f-login" novalidate>' +
      '<img class="logo" src="assets/logo-severo.png" alt="Severo Transportes">' +
      '<h1 class="titulo">Central de cargas</h1>' +
      (demo
        ? '<p class="sub">Modo demonstração. Os dados ficam neste navegador. Abra o app do motorista em outra aba para ver os pedidos chegando ao vivo.</p>' +
          '<label class="campo"><span>Seu nome</span><input name="nome" required autocomplete="name"></label>' +
          '<label class="campo"><span>Função</span><select name="papel"><option value="operador">Operador</option><option value="gestao">Gestão</option><option value="financeiro">Financeiro</option></select></label>'
        : '<p class="sub">Entre com o acesso liberado pela gestão.</p>' +
          '<label class="campo"><span>E-mail</span><input name="email" type="email" required autocomplete="username"></label>' +
          '<label class="campo"><span>Senha</span><input name="senha" type="password" required autocomplete="current-password"></label>') +
      '<button class="btn btn-primario btn-grande" type="submit">Entrar</button>' +
      '<p class="miudo" style="margin-top:1.2rem">App do motorista: <a href="./" style="color:var(--azul)">abrir</a></p>' +
      '</form></div>';
    const f = $('#f-login');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const b = $('button[type=submit]', f);
      try {
        b.disabled = true; b.textContent = 'Entrando…';
        if (demo) {
          if (f.nome.value.trim().length < 2) throw new Error('Digite seu nome.');
          P.op = await SV.entrarOperador('', '', { nome: f.nome.value.trim(), papel: f.papel.value });
        } else {
          P.op = await SV.entrarOperador(f.email.value.trim(), f.senha.value);
        }
        montar();
      } catch (err) {
        b.disabled = false; b.textContent = 'Entrar';
        aviso(/password|user-not-found|invalid/i.test(err.code || err.message) ? 'E-mail ou senha incorretos.' : err.message, true);
      }
    });
  }

  /* ---------- estrutura ---------- */
  function montar() {
    const demo = SV.modo === 'demo';
    const papel = { operador: 'Operador', gestao: 'Gestão', financeiro: 'Financeiro' }[P.op.papel] || P.op.papel;
    raiz.innerHTML = '<div class="pn">' +
      '<aside class="pn-lado">' +
      '<img class="logo" src="assets/logo-severo.png" alt="Severo Transportes">' +
      '<button class="pn-nav" data-aba="fila">Fila de motoristas <span class="cont" id="cont-fila"></span></button>' +
      '<button class="pn-nav" data-aba="cargas">Cargas <span class="cont" id="cont-cargas" style="background:var(--cabine-3);color:var(--texto-2)"></span></button>' +
      '<button class="pn-nav" data-acao="exportar">Exportar planilha</button>' +
      '<div class="fim">' +
      (demo ? '<div class="selo-demo">Modo demonstração. Configure o Firebase em js/config.js para usar de verdade.</div>' +
        '<button class="btn btn-p" data-acao="semear">Gerar dados de exemplo</button>' +
        '<button class="btn btn-p btn-fantasma" data-acao="limpar">Limpar demonstração</button>' +
        '<a class="btn btn-p btn-fantasma" href="./" target="_blank" rel="noopener">Abrir app do motorista</a>' : '') +
      '<div class="pn-op"><b>' + esc(P.op.nome) + '</b><span>' + esc(papel) + '</span></div>' +
      '<button class="btn btn-p btn-fantasma" data-acao="sair">' + IC.sair + 'Sair</button>' +
      '</div></aside>' +
      '<main class="pn-main"><div class="pn-kpis" id="kpis"></div><div class="pn-corpo" id="corpo"></div></main>' +
      '</div>';
    trocarAba(P.aba);
    P.parar.forEach((f) => f());
    P.parar = [
      SV.observarFila((l) => { novosPedidos(l); P.fila = l; atualizar(); }),
      SV.observarAtendimentos((l) => { P.atend = {}; l.forEach((a) => { P.atend[a.id] = a; }); atualizar(); }),
      SV.observarCargas((l) => { P.cargas = l.sort((a, b) => (a.dataCarregamento || 0) - (b.dataCarregamento || 0)); atualizar(); })
    ];
  }

  function novosPedidos(l) {
    const ids = new Set(l.map((d) => d.id));
    if (P.vistos) {
      const novos = l.filter((d) => !P.vistos.has(d.id) && d.status === 'disponivel');
      if (novos.length) {
        const n = novos[0];
        aviso('Novo pedido: ' + n.motoristaNome + (n.cidade ? ' em ' + n.cidade + '/' + n.uf : ' (áudio)'));
        bipe();
      }
    }
    P.vistos = ids;
  }

  function trocarAba(aba) {
    P.aba = aba;
    P.assinDet = null;
    $$('.pn-nav[data-aba]').forEach((b) => b.setAttribute('aria-current', b.dataset.aba === aba ? 'page' : 'false'));
    const corpo = $('#corpo');
    if (aba === 'fila') {
      const opt = (lista, v, rot) => '<option value="">' + rot + '</option>' + lista.map((x) => '<option' + (x === v ? ' selected' : '') + '>' + x + '</option>').join('');
      corpo.innerHTML = '<section class="pn-coluna">' +
        '<div class="pn-abas" id="grupos">' + [['ativos', 'Na fila'], ['operacao', 'Em operação'], ['encerrados', 'Encerrados'], ['todos', 'Todos']].map((g) =>
          '<button class="pn-aba" data-grupo="' + g[0] + '" aria-pressed="' + (P.f.grupo === g[0]) + '">' + g[1] + '</button>').join('') + '</div>' +
        '<div class="pn-filtros">' +
        '<input class="entrada busca" id="f-busca" placeholder="Buscar motorista, cidade ou placa" value="' + esc(P.f.busca) + '">' +
        '<select class="entrada" id="f-uf" aria-label="UF onde está">' + opt(SV.UFS.slice().sort(), P.f.uf, 'Está em') + '</select>' +
        '<select class="entrada" id="f-destino" aria-label="Destino desejado">' + opt(SV.UFS.slice().sort(), P.f.destino, 'Quer ir para') + '</select>' +
        '<select class="entrada" id="f-carroceria" aria-label="Carroceria">' + opt(SV.CARROCERIAS, P.f.carroceria, 'Carroceria') + '</select>' +
        '<label class="miudo" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="f-meus"' + (P.f.meus ? ' checked' : '') + '> Só os meus</label>' +
        '</div><div class="pn-lista" id="lista"></div></section>' +
        '<section class="pn-detalhe" id="detalhe"></section>';
      $('#grupos').addEventListener('click', (e) => {
        const b = e.target.closest('[data-grupo]'); if (!b) return;
        P.f.grupo = b.dataset.grupo;
        $$('#grupos .pn-aba').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        desenharLista();
      });
      $('#f-busca').addEventListener('input', (e) => { P.f.busca = e.target.value; desenharLista(); });
      ['uf', 'destino', 'carroceria'].forEach((k) => $('#f-' + k).addEventListener('change', (e) => { P.f[k] = e.target.value; desenharLista(); }));
      $('#f-meus').addEventListener('change', (e) => { P.f.meus = e.target.checked; desenharLista(); });
    } else {
      corpo.innerHTML = '<section class="pn-coluna">' +
        '<div class="pn-filtros"><button class="btn btn-p btn-primario" data-acao="nova-carga">' + IC.mais + 'Nova carga</button>' +
        '<span class="miudo">Cadastre a demanda do cliente e veja quem encaixa.</span></div>' +
        '<div class="pn-lista" id="lista-cargas"></div></section>' +
        '<section class="pn-detalhe" id="det-carga"></section>';
    }
    atualizar();
  }

  function atualizar() {
    if (!P.op || !$('#kpis')) return;
    desenharKpis();
    const semResp = P.fila.filter((d) => SV.ATIVOS.includes(d.status) && !SV.vencida(d) && !d.responsavelId).length;
    $('#cont-fila').textContent = semResp || '';
    $('#cont-fila').style.display = semResp ? '' : 'none';
    const abertas = P.cargas.filter((c) => c.status === 'aberta').length;
    $('#cont-cargas').textContent = abertas || '';
    $('#cont-cargas').style.display = abertas ? '' : 'none';
    document.title = (semResp ? '(' + semResp + ') ' : '') + 'Central Severo';
    if (P.aba === 'fila') { desenharLista(); desenharDetalhe(); }
    else { desenharCargas(); desenharDetalheCarga(); }
  }

  /* ---------- indicadores ---------- */
  function desenharKpis() {
    const hoje = U.hojeInicio();
    const ativos = P.fila.filter((d) => SV.ATIVOS.includes(d.status) && !SV.vencida(d));
    const semResp = ativos.filter((d) => !d.responsavelId);
    const assumidosHoje = P.fila.filter((d) => d.assumidoEm && d.assumidoEm >= hoje);
    const media = assumidosHoje.length ? assumidosHoje.reduce((s, d) => s + (d.assumidoEm - d.criadoEm), 0) / assumidosHoje.length / 60000 : null;
    const fechadasHoje = P.fila.filter((d) => d.fechadoEm && d.fechadoEm >= hoje).length;
    const mes = Date.now() - 30 * 86400000;
    const criados30 = P.fila.filter((d) => d.criadoEm >= mes).length;
    const fechados30 = P.fila.filter((d) => d.fechadoEm && d.fechadoEm >= mes).length;
    const conv = criados30 ? Math.round(fechados30 / criados30 * 100) : null;
    const k = (v, rot, cls) => '<div class="kpi ' + (cls || '') + '"><b>' + v + '</b><span>' + rot + '</span></div>';
    $('#kpis').innerHTML =
      k(ativos.length, 'Motoristas na fila') +
      k(semResp.length, 'Sem responsável', semResp.some((d) => Date.now() - d.criadoEm > META_MIN * 60000) ? 'alerta' : '') +
      k(media == null ? '—' : Math.round(media) + ' min', '1º contato médio hoje · meta ' + META_MIN, media == null ? '' : media <= META_MIN ? 'bom' : 'alerta') +
      k(fechadasHoje, 'Cargas fechadas hoje', fechadasHoje ? 'bom' : '') +
      k(conv == null ? '—' : conv + '%', 'Avisos que viraram carga · 30 dias');
  }

  /* ---------- fila ---------- */
  function filtrar() {
    const f = P.f, b = U.norm(f.busca);
    return P.fila.filter((d) => {
      const st = SV.statusEfetivo(d);
      if (f.grupo === 'ativos' && !SV.ATIVOS.includes(st)) return false;
      if (f.grupo === 'operacao' && !SV.EM_OPERACAO.includes(st)) return false;
      if (f.grupo === 'encerrados' && !(ENCERRADOS.includes(st) || st === 'vencida')) return false;
      if (f.uf && d.uf !== f.uf) return false;
      if (f.destino && !(d.destinos || []).includes(f.destino) && !d.aceitaOutras) return false;
      if (f.carroceria && (d.veiculo || {}).carroceria !== f.carroceria) return false;
      if (f.meus && d.responsavelId !== P.op.id) return false;
      if (b) {
        const alvo = U.norm([d.motoristaNome, d.cidade, d.uf, (d.veiculo || {}).placa, d.telefone].join(' '));
        if (alvo.indexOf(b) < 0) return false;
      }
      return true;
    }).sort((a, z) => {
      if (P.f.grupo === 'ativos') {
        if (!a.responsavelId !== !z.responsavelId) return a.responsavelId ? 1 : -1;
        return (a.criadoEm || 0) - (z.criadoEm || 0);
      }
      return (z.atualizadoEm || 0) - (a.atualizadoEm || 0);
    });
  }

  function desenharLista() {
    const el = $('#lista'); if (!el) return;
    const l = filtrar();
    if (!l.length) {
      el.innerHTML = '<div class="pn-vazio">' + (P.fila.length
        ? 'Nenhum motorista com esses filtros.'
        : 'Nenhum aviso ainda. Quando um motorista tocar em “Estou vazio”, ele aparece aqui na hora.' +
          (SV.modo === 'demo' ? '<br><button class="btn btn-p" data-acao="semear">Gerar dados de exemplo</button>' : '')) + '</div>';
      return;
    }
    el.innerHTML = l.map((d) => {
      const st = SV.statusEfetivo(d), S = SV.STATUS[st], v = d.veiculo || {};
      const atrasado = SV.ATIVOS.includes(st) && !d.responsavelId && Date.now() - d.criadoEm > META_MIN * 60000;
      return '<button class="lf' + (atrasado ? ' atrasado' : '') + (st === 'vencida' ? ' apagado' : '') + '" data-sel="' + d.id + '" aria-current="' + (P.sel === d.id) + '">' +
        '<div><div class="loc">' + esc(d.cidade || 'Local no áudio') + (d.uf ? '<span>' + esc(d.uf) + '</span>' : '') + '</div>' +
        '<div class="veic">' + esc(d.motoristaNome) + ' · ' + esc(v.tipo) + ' ' + esc(v.carroceria) + ' · ' + U.toneladas(d.capacidadeLivreKg || v.capacidadeKg) + '</div></div>' +
        '<div class="dir"><span class="etq ' + S.tom + '">' + S.rotulo + '</span><span class="resp">' + (d.responsavelNome ? esc(d.responsavelNome.split(' ')[0]) : 'Sem responsável') + '</span></div>' +
        '<div class="linha3">' + escudos(d) + '<span>' + U.desde(d.criadoEm) + '</span>' +
        (d.audioUrl ? '<span class="ic-audio">' + IC.mic + 'áudio</span>' : '') + '</div></button>';
    }).join('');
  }
  function escudos(d) {
    const ds = d.destinos || [];
    return '<span class="escudos-mini">' + ds.map((u) => '<span class="escudo-mini">' + u + '</span>').join('') +
      (d.aceitaOutras ? '<span class="escudo-mini fraco" title="Aceita outras rotas">+</span>' : '') + '</span>';
  }

  /* ---------- detalhe do pedido ---------- */
  function desenharDetalhe() {
    const el = $('#detalhe'); if (!el) return;
    const d = P.fila.find((x) => x.id === P.sel);
    if (!d) {
      P.assinDet = null;
      el.innerHTML = '<div class="pn-vazio" style="padding-top:80px">Escolha um motorista na fila para ver o pedido, ouvir o áudio e negociar.</div>';
      return;
    }
    // não redesenha se nada mudou (evita cortar o áudio que o operador está ouvindo)
    const assin = JSON.stringify([d, P.atend[d.id] || null, P.cargas.map((c) => c.id + c.status + (c.atualizadoEm || '')).join(), P.op.id]);
    if (assin === P.assinDet && el.firstChild) return;
    P.assinDet = assin;
    const nota = $('#anotar-txt'); const notaTxt = nota ? nota.value : ''; const notaFoco = nota && document.activeElement === nota;
    const a = P.atend[d.id] || {};
    const st = SV.statusEfetivo(d), S = SV.STATUS[st], v = d.veiculo || {};
    const meu = d.responsavelId === P.op.id;
    const pode = meu || P.op.papel === 'gestao';
    const idadeLocalH = (Date.now() - (d.localEm || d.criadoEm)) / 3600000;
    const zap = 'https://wa.me/' + U.whats(d.telefone) + '?text=' + encodeURIComponent('Olá, ' + (d.motoristaNome || '').split(' ')[0] + '! Aqui é ' + P.op.nome.split(' ')[0] + ', da Severo. Vi que você está disponível' + (d.cidade ? ' em ' + d.cidade + '/' + d.uf : '') + '.');

    let acoes = '';
    if (pode) {
      if (st === 'em_atendimento') acoes = bt('proposta', 'Enviar proposta', 'btn-primario') + bt('sem-carga', 'Sem carga encontrada') + bt('cancelar', 'Cancelar', 'btn-fantasma btn-perigo');
      else if (st === 'proposta_enviada') acoes = bt('aceitou', 'Motorista aceitou', 'btn-primario') + bt('recusou', 'Motorista recusou') + bt('proposta', 'Refazer proposta', 'btn-fantasma');
      else if (st === 'aguardando_aprovacao') acoes = bt('fechar', 'Aprovar e fechar carga', 'btn-primario') + bt('recusou', 'Não aprovado / recusou');
      else if (st === 'carga_fechada') acoes = bt('carregado', 'Registrar carregamento', 'btn-primario');
      else if (st === 'vencida') acoes = '<span class="miudo">Aviso vencido. Ligue para confirmar; o motorista renova no app.</span> ' + bt('cancelar', 'Encerrar', 'btn-fantasma btn-perigo');
    }

    const hist = (d.historico || []).map((h) => Object.assign({ interno: false }, h))
      .concat((a.notas || []).map((h) => Object.assign({ interno: true }, h)))
      .sort((x, y) => y.em - x.em);

    const neg = a.negociacao;
    const negHtml = neg ? '<div class="det-sec"><h3>Negociação <small>' + esc(neg.por || '') + ' · ' + U.desde(neg.em) + '</small></h3>' +
      '<dl class="det-grade">' +
      '<div><dt>Repasse ao parceiro</dt><dd class="num">' + U.moeda(neg.repasse) + '</dd></div>' +
      '<div><dt>Pedágio (separado)</dt><dd class="num">' + U.moeda(neg.pedagio) + '</dd></div>' +
      (veGestao() ? '<div><dt>Valor do cliente</dt><dd class="num">' + U.moeda(neg.valorCliente) + '</dd></div>' +
        '<div><dt>Diferença comercial</dt><dd class="num">' + U.moeda((neg.valorCliente || 0) - (neg.repasse || 0)) + '<div class="miudo">antes de impostos e custos</div></dd></div>' : '') +
      '<div class="largo"><dt>Pagamento combinado</dt><dd>' + esc(neg.pagamento || '—') + '</dd></div>' +
      (neg.cargaRotulo ? '<div class="largo"><dt>Carga</dt><dd>' + esc(neg.cargaRotulo) + '</dd></div>' : '') +
      '</dl></div>' : '';

    let matches = '';
    if (SV.ATIVOS.includes(st)) {
      const abertas = P.cargas.filter((c) => c.status === 'aberta').map((c) => ({ c: c, r: SV.compatibilidade(d, c) }))
        .sort((x, y) => (y.r.ok - x.r.ok) || (y.r.nota - x.r.nota));
      matches = '<div class="det-sec"><h3>Cargas para este motorista <small>' + abertas.filter((x) => x.r.ok).length + ' compatíveis</small></h3>' +
        (abertas.length ? abertas.slice(0, 6).map((x) => cartaoMatch(x.c, x.r)).join('') : '<p class="miudo">Nenhuma carga aberta cadastrada. Cadastre em “Cargas” para o sistema sugerir.</p>') + '</div>';
    }

    el.innerHTML =
      '<div class="det-topo"><div><h2 class="det-nome">' + esc(d.motoristaNome) + '</h2>' +
      '<div class="det-sub num">' + esc(U.telefone(d.telefone)) + '</div></div>' +
      '<div class="det-contatos"><a class="btn btn-p" href="tel:+' + U.whats(d.telefone) + '">' + IC.fone + 'Ligar</a>' +
      '<a class="btn btn-p" href="' + zap + '" target="_blank" rel="noopener" data-contato="WhatsApp">' + IC.zap + 'WhatsApp</a></div></div>' +

      '<div class="det-faixa"><span class="etq ' + S.tom + '">' + S.rotulo + '</span>' +
      '<span class="miudo">' + (d.responsavelNome ? 'Com ' + esc(d.responsavelNome) : 'Sem responsável') + '</span>' +
      (SV.ATIVOS.includes(d.status) ? '<span class="miudo">· ' + (st === 'vencida' ? 'venceu ' + U.desde(d.expiraEm) : 'vale ' + U.ate(d.expiraEm)) + '</span>' : '') +
      '<span class="sep"></span>' +
      (!d.responsavelId && SV.ATIVOS.includes(d.status) ? bt('assumir', 'Assumir atendimento', 'btn-azul') : '') +
      (d.responsavelId && !meu && SV.ATIVOS.includes(d.status) ? bt('transferir', 'Transferir para mim', 'btn-fantasma') : '') +
      '</div>' +

      '<dl class="det-grade">' +
      '<div><dt>Onde está</dt><dd>' + esc(d.cidade || 'Informado no áudio') + (d.uf ? '/' + esc(d.uf) : '') +
      (d.lat ? ' <a class="miudo" style="color:var(--azul)" target="_blank" rel="noopener" href="https://www.google.com/maps?q=' + d.lat + ',' + d.lng + '">mapa</a>' : '') +
      '<div class="miudo">informado ' + U.desde(d.localEm || d.criadoEm) + '</div>' +
      (idadeLocalH > 2 ? '<div class="det-alerta">Posição antiga: pode não ser onde ele está agora.</div>' : '') + '</dd></div>' +
      '<div><dt>Pode carregar</dt><dd>' + U.quando(d.quando) + '</dd></div>' +
      '<div><dt>Veículo</dt><dd>' + esc(v.tipo) + ' · ' + esc(v.carroceria) + (v.placa ? ' <span class="placa-br" style="margin:0 0 0 4px">' + esc(v.placa) + '</span>' : '') + '</dd></div>' +
      '<div><dt>' + (d.ocupacao === 'parcial' ? 'Espaço livre' : 'Capacidade') + '</dt><dd>' + U.toneladas(d.capacidadeLivreKg || v.capacidadeKg) + (d.ocupacao === 'parcial' ? ' <span class="miudo">de ' + U.toneladas(v.capacidadeKg) + '</span>' : '') + '</dd></div>' +
      '<div class="largo"><dt>Destinos em ordem de preferência</dt><dd>' + ((d.destinos || []).length ? escudos(d) : '—') + (d.aceitaOutras ? ' <span class="miudo">aceita outras rotas</span>' : '') + '</dd></div>' +
      '<div><dt>Ano</dt><dd>' + (v.ano || '—') + '</dd></div>' +
      '<div><dt>Rastreador</dt><dd>' + (v.rastreador ? 'Sim' : 'Não') + '</dd></div>' +
      (d.obs ? '<div class="largo"><dt>Observações do motorista</dt><dd>' + esc(d.obs) + '</dd></div>' : '') +
      '</dl>' +

      (d.audioUrl ? '<div class="det-sec det-audio"><h3>Áudio do motorista</h3><audio controls preload="none" src="' + esc(d.audioUrl) + '"></audio></div>' : '') +
      (acoes ? '<div class="det-sec"><h3>Próximo passo</h3><div class="det-acoes">' + acoes + '</div></div>' : '') +
      negHtml + matches +

      '<div class="det-sec"><h3>Histórico <small>notas internas não aparecem para o motorista</small></h3>' +
      '<form class="anotar" id="f-anotar" style="margin-bottom:16px"><input class="entrada" id="anotar-txt" placeholder="Registrar contato: liguei, sem resposta…" autocomplete="off">' +
      '<button class="btn btn-p" type="submit">Registrar</button></form>' +
      '<ul class="hist">' + hist.map((h) => '<li class="' + esc(h.tipo) + '"><div>' + esc(h.texto) + (h.interno ? '<span class="interno">interno</span>' : '') + '</div>' +
        '<div class="q">' + new Date(h.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + (h.por ? ' · ' + esc(h.por.nome) : h.tipo === 'motorista' ? ' · motorista' : '') + '</div></li>').join('') + '</ul></div>';

    const n2 = $('#anotar-txt'); n2.value = notaTxt; if (notaFoco) n2.focus();
    $('#f-anotar').addEventListener('submit', async (e) => {
      e.preventDefault();
      const t = $('#anotar-txt').value.trim(); if (!t) return;
      try { $('#anotar-txt').value = ''; await SV.anotar(d, t, P.op); } catch (err) { aviso(err.message, true); }
    });
  }
  const bt = (acao, txt, cls) => '<button class="btn btn-p ' + (cls || '') + '" data-acao="' + acao + '">' + txt + '</button>';

  function cartaoMatch(c, r, dispMode) {
    return '<div class="match' + (r.ok ? '' : ' ruim') + '">' +
      '<div><div class="rota">' + esc(c.origemCidade) + '/' + esc(c.origemUF) + ' → ' + esc(c.destinoCidade) + '/' + esc(c.destinoUF) + '</div>' +
      '<div class="miudo">' + esc(c.cliente) + ' · ' + U.toneladas(c.pesoKg) + ' · ' + esc((c.carrocerias || []).join(', ') || 'qualquer carroceria') +
      (c.dataCarregamento ? ' · carrega ' + new Date(c.dataCarregamento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '') + '</div></div>' +
      '<div class="nota">' + (r.ok ? r.nota : 'não atende') + '</div>' +
      '<div class="detalhes">' + (r.ok ? esc(r.pontos.join(' · ') || 'Requisitos atendidos') : r.falhas.map((x) => '<span class="falha">' + esc(x) + '</span>').join(' · ')) + '</div>' +
      (dispMode || '') + '</div>';
  }

  /* ---------- cargas ---------- */
  function desenharCargas() {
    const el = $('#lista-cargas'); if (!el) return;
    if (!P.cargas.length) { el.innerHTML = '<div class="pn-vazio">Nenhuma carga cadastrada. Cadastre a demanda do cliente e o sistema sugere os veículos que encaixam.</div>'; return; }
    const ativos = P.fila.filter((d) => SV.ATIVOS.includes(d.status) && !SV.vencida(d));
    el.innerHTML = '<table class="tabela"><thead><tr><th>Rota</th><th>Cliente</th><th>Peso</th><th>Situação</th><th>Encaixam</th></tr></thead><tbody>' +
      P.cargas.map((c) => {
        const n = ativos.filter((d) => SV.compatibilidade(d, c).ok).length;
        return '<tr class="clicavel" data-carga="' + c.id + '" aria-current="' + (P.selCarga === c.id) + '">' +
          '<td><b>' + esc(c.origemUF) + ' → ' + esc(c.destinoUF) + '</b><div class="miudo">' + esc(c.origemCidade) + ' → ' + esc(c.destinoCidade) + '</div></td>' +
          '<td>' + esc(c.cliente) + '</td><td class="num">' + U.toneladas(c.pesoKg) + '</td>' +
          '<td><span class="etq ' + (c.status === 'aberta' ? 'azul' : c.status === 'fechada' ? 'verde' : 'cinza') + '">' + ({ aberta: 'Aberta', fechada: 'Fechada', cancelada: 'Cancelada' }[c.status] || c.status) + '</span></td>' +
          '<td class="num">' + (c.status === 'aberta' ? n : '—') + '</td></tr>';
      }).join('') + '</tbody></table>';
  }
  function desenharDetalheCarga() {
    const el = $('#det-carga'); if (!el) return;
    const c = P.cargas.find((x) => x.id === P.selCarga);
    if (!c) { el.innerHTML = '<div class="pn-vazio" style="padding-top:80px">Escolha uma carga para ver os motoristas que encaixam.</div>'; return; }
    const ativos = P.fila.filter((d) => SV.ATIVOS.includes(d.status) && !SV.vencida(d))
      .map((d) => ({ d: d, r: SV.compatibilidade(d, c) })).sort((x, y) => (y.r.ok - x.r.ok) || (y.r.nota - x.r.nota));
    el.innerHTML = '<div class="det-topo"><div><h2 class="det-nome">' + esc(c.origemCidade) + ' → ' + esc(c.destinoCidade) + '</h2>' +
      '<div class="det-sub">' + esc(c.cliente) + '</div></div>' +
      '<div class="det-contatos">' + bt('editar-carga', 'Editar') + (c.status === 'aberta' ? bt('cancelar-carga', 'Cancelar carga', 'btn-fantasma btn-perigo') : '') + '</div></div>' +
      '<dl class="det-grade" style="margin-top:18px">' +
      '<div><dt>Origem</dt><dd>' + esc(c.origemCidade) + '/' + esc(c.origemUF) + '</dd></div>' +
      '<div><dt>Destino</dt><dd>' + esc(c.destinoCidade) + '/' + esc(c.destinoUF) + '</dd></div>' +
      '<div><dt>Carregamento</dt><dd>' + (c.dataCarregamento ? new Date(c.dataCarregamento).toLocaleDateString('pt-BR') : '—') + '</dd></div>' +
      '<div><dt>Peso</dt><dd>' + U.toneladas(c.pesoKg) + '</dd></div>' +
      '<div><dt>Carroceria</dt><dd>' + esc((c.carrocerias || []).join(', ') || 'Qualquer') + '</dd></div>' +
      '<div><dt>Exigências</dt><dd>' + ([c.anoMinimo ? 'ano ' + c.anoMinimo + '+' : '', c.exigeRastreador ? 'rastreador' : '', c.escolta ? 'escolta' : ''].filter(Boolean).join(', ') || 'Nenhuma') + '</dd></div>' +
      (veGestao() ? '<div class="largo"><dt>Valor do cliente</dt><dd class="num">' + U.moeda(c.valorCliente) + '</dd></div>' : '') +
      (c.obs ? '<div class="largo"><dt>Observações</dt><dd>' + esc(c.obs) + '</dd></div>' : '') +
      '</dl>' +
      (c.status === 'aberta' ? '<div class="det-sec"><h3>Motoristas disponíveis <small>requisitos primeiro, depois proximidade e destino</small></h3>' +
        (ativos.length ? ativos.map((x) => '<div class="match' + (x.r.ok ? '' : ' ruim') + '"><div><div class="rota">' + esc(x.d.motoristaNome) + '</div>' +
          '<div class="miudo">' + esc(x.d.cidade || '?') + '/' + esc(x.d.uf || '?') + ' · ' + esc((x.d.veiculo || {}).tipo) + ' ' + esc((x.d.veiculo || {}).carroceria) + ' · ' + U.desde(x.d.localEm || x.d.criadoEm) + '</div></div>' +
          '<div class="nota">' + (x.r.ok ? x.r.nota : 'não atende') + '</div>' +
          '<div class="detalhes">' + (x.r.ok ? esc(x.r.pontos.join(' · ') || 'Requisitos atendidos') : x.r.falhas.map((f) => '<span class="falha">' + esc(f) + '</span>').join(' · ')) + '</div>' +
          '<button class="btn btn-p" data-abrir="' + x.d.id + '">Abrir pedido</button></div>').join('')
          : '<p class="miudo">Nenhum motorista na fila agora.</p>') + '</div>'
        : '<div class="det-sec"><p class="miudo">Carga ' + (c.status === 'fechada' ? 'fechada' + (c.motoristaNome ? ' com ' + esc(c.motoristaNome) : '') : 'cancelada') + '.</p></div>');
  }

  /* ---------- diálogos ---------- */
  function dialogo(html, aoEnviar, aoAbrir) {
    const dlg = $('#dlg');
    dlg.innerHTML = '<form novalidate>' + html + '</form>';
    const f = $('form', dlg);
    f.addEventListener('click', (e) => {
      if (e.target.closest('[data-fechar]')) { e.preventDefault(); dlg.close(); return; }
      const c = e.target.closest('.chips .chip');
      if (!c) return;
      const g = c.parentElement;
      if (g.dataset.multi) c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true'));
      else $$('.chip', g).forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
    });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const b = $('button[type=submit]', f);
      b.disabled = true;
      try { await aoEnviar(f); dlg.close(); }
      catch (err) { aviso(err.message || 'Não foi possível salvar.', true); b.disabled = false; }
    });
    if (aoAbrir) aoAbrir(f);
    dlg.showModal();
  }
  const rodape = (txt) => '<div class="rodape"><button type="button" class="btn" data-fechar>Voltar</button><button type="submit" class="btn btn-primario">' + txt + '</button></div>';
  const num = (v) => { const n = parseFloat(String(v || '').replace(/\./g, '').replace(',', '.')); return isNaN(n) ? null : n; };
  const chipsHtml = (opcoes, sel, multi) => '<div class="chips"' + (multi ? ' data-multi="1"' : '') + '>' + opcoes.map((o) => '<button type="button" class="chip" data-valor="' + esc(o) + '" aria-pressed="' + (multi ? (sel || []).includes(o) : o === sel) + '">' + esc(o) + '</button>').join('') + '</div>';
  const chipsLidos = (raizEl) => $$('.chip[aria-pressed="true"]', raizEl).map((c) => c.dataset.valor);

  function dlgProposta(d) {
    const a = P.atend[d.id] || {}, n = a.negociacao || {};
    const abertas = P.cargas.filter((c) => c.status === 'aberta').map((c) => ({ c: c, r: SV.compatibilidade(d, c) })).sort((x, y) => (y.r.ok - x.r.ok) || (y.r.nota - x.r.nota));
    const rot = (c) => c.cliente + ' · ' + c.origemCidade + '/' + c.origemUF + ' → ' + c.destinoCidade + '/' + c.destinoUF;
    dialogo('<h2>Proposta para ' + esc((d.motoristaNome || '').split(' ')[0]) + '</h2>' +
      '<label class="campo"><span>Carga</span><select name="carga"><option value="">Carga não cadastrada</option>' +
      abertas.map((x) => '<option value="' + x.c.id + '"' + (n.cargaId === x.c.id ? ' selected' : '') + '>' + esc(rot(x.c)) + (x.r.ok ? '' : ' (não atende)') + '</option>').join('') + '</select></label>' +
      '<label class="campo"><span>Rota informada ao motorista</span><input name="rota" value="' + esc(n.rota || '') + '" placeholder="Contagem/MG → Rio de Janeiro/RJ"></label>' +
      '<div class="grade2"><label class="campo"><span>Valor do cliente (R$)</span><input name="cliente" inputmode="decimal" value="' + (n.valorCliente || '') + '"></label>' +
      '<label class="campo"><span>Repasse ao parceiro (R$)</span><input name="repasse" inputmode="decimal" required value="' + (n.repasse || '') + '"></label></div>' +
      '<div class="grade2"><label class="campo"><span>Pedágio (R$)</span><input name="pedagio" inputmode="decimal" value="' + (n.pedagio || '') + '"><small>Fica separado da margem.</small></label>' +
      '<label class="campo"><span>Pagamento combinado</span><input name="pagamento" value="' + esc(n.pagamento || '') + '" placeholder="70% no carregamento"></label></div>' +
      (veGestao() ? '<div class="margem" id="margem"></div>' : '') +
      rodape('Registrar proposta'),
      async (f) => {
        const repasse = num(f.repasse.value);
        if (!repasse) throw new Error('Informe o valor de repasse ao parceiro.');
        const carga = P.cargas.find((c) => c.id === f.carga.value);
        await SV.enviarProposta(d, P.op, {
          cargaId: carga ? carga.id : null, cargaRotulo: carga ? rot(carga) : '', rota: f.rota.value.trim(),
          valorCliente: num(f.cliente.value), repasse: repasse, pedagio: num(f.pedagio.value), pagamento: f.pagamento.value.trim()
        });
        aviso('Proposta registrada. Avise o motorista por telefone ou WhatsApp.');
      },
      (f) => {
        const calc = () => {
          const m = $('#margem'); if (!m) return;
          const cl = num(f.cliente.value), rp = num(f.repasse.value);
          m.innerHTML = cl && rp ? 'Diferença comercial: <b>' + U.moeda(cl - rp) + '</b> (' + Math.round((cl - rp) / cl * 100) + '%). Antes de impostos, equipe e demais custos; não é lucro líquido.' : 'Preencha valor do cliente e repasse para ver a diferença comercial.';
        };
        f.carga.addEventListener('change', () => {
          const c = P.cargas.find((x) => x.id === f.carga.value);
          if (c) { f.rota.value = c.origemCidade + '/' + c.origemUF + ' → ' + c.destinoCidade + '/' + c.destinoUF; if (c.valorCliente) f.cliente.value = c.valorCliente; }
          calc();
        });
        f.cliente.addEventListener('input', calc); f.repasse.addEventListener('input', calc); calc();
      });
  }
  function dlgRecusa(d) {
    dialogo('<h2>Motivo da recusa</h2><div class="campo">' + chipsHtml(SV.MOTIVOS_RECUSA, '') + '</div>' +
      '<label class="campo"><span>Detalhe</span><input name="obs" placeholder="Ex.: queria R$ 500 a mais"></label>' + rodape('Registrar e seguir buscando'),
      async (f) => {
        const m = chipsLidos(f)[0];
        if (!m) throw new Error('Escolha o motivo.');
        await SV.registrarRecusa(d, P.op, m, f.obs.value.trim());
        aviso('Recusa registrada. O pedido volta para atendimento.');
      });
  }
  function dlgFechar(d) {
    dialogo('<h2>Fechar carga</h2><p class="sub">Confirme antes de fechar. Depois disso o pedido sai da fila e não recebe outras ofertas.</p>' +
      '<label class="interruptor" style="margin-bottom:10px">Documentos conferidos<input type="checkbox" name="docs"></label>' +
      '<label class="interruptor" style="margin-bottom:16px">Operação aprovada<input type="checkbox" name="op"></label>' + rodape('Fechar carga'),
      async (f) => {
        if (!f.docs.checked || !f.op.checked) throw new Error('Confirme documentos e aprovação.');
        await SV.mudarStatus(d, 'carga_fechada', P.op, 'Carga fechada: documentos conferidos e operação aprovada');
        const n = (P.atend[d.id] || {}).negociacao;
        if (n && n.cargaId) {
          const c = P.cargas.find((x) => x.id === n.cargaId);
          if (c) await SV.salvarCarga(Object.assign({}, c, { status: 'fechada', dispId: d.id, motoristaNome: d.motoristaNome }));
        }
        aviso('Carga fechada.');
      });
  }
  function dlgMotivo(d, status, titulo, rotulo) {
    dialogo('<h2>' + titulo + '</h2><label class="campo"><span>Observação</span><input name="obs" placeholder="Opcional"></label>' + rodape(rotulo),
      async (f) => {
        const o = f.obs.value.trim();
        await SV.mudarStatus(d, status, P.op, SV.STATUS[status].rotulo + (o ? ': ' + o : ''));
        aviso(SV.STATUS[status].rotulo + '.');
      });
  }
  function dlgCarga(c) {
    c = c || {};
    const ufs = SV.UFS.slice().sort();
    const sel = (nome, v) => '<select name="' + nome + '" required><option value="">UF</option>' + ufs.map((u) => '<option' + (u === v ? ' selected' : '') + '>' + u + '</option>').join('') + '</select>';
    const data = c.dataCarregamento ? new Date(c.dataCarregamento - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10) : '';
    dialogo('<h2>' + (c.id ? 'Editar carga' : 'Nova carga') + '</h2>' +
      '<label class="campo"><span>Cliente</span><input name="cliente" required value="' + esc(c.cliente || '') + '"></label>' +
      '<div class="grade3"><label class="campo"><span>Origem</span><input name="oc" required value="' + esc(c.origemCidade || '') + '"></label><label class="campo"><span>UF</span>' + sel('ou', c.origemUF) + '</label><label class="campo"><span>Data</span><input type="date" name="data" value="' + data + '"></label></div>' +
      '<div class="grade3"><label class="campo"><span>Destino</span><input name="dc" required value="' + esc(c.destinoCidade || '') + '"></label><label class="campo"><span>UF</span>' + sel('du', c.destinoUF) + '</label><label class="campo"><span>Peso (t)</span><input name="peso" inputmode="decimal" value="' + (c.pesoKg ? String(c.pesoKg / 1000).replace('.', ',') : '') + '"></label></div>' +
      '<div class="campo"><span>Carrocerias aceitas</span>' + chipsHtml(SV.CARROCERIAS, c.carrocerias || [], true) + '<small>Nenhuma marcada = qualquer carroceria.</small></div>' +
      '<div class="grade2"><label class="campo"><span>Ano mínimo</span><input name="ano" inputmode="numeric" value="' + (c.anoMinimo || '') + '"></label>' +
      '<label class="campo"><span>Valor do cliente (R$)</span><input name="valor" inputmode="decimal" value="' + (c.valorCliente || '') + '"></label></div>' +
      '<div class="grade2"><label class="interruptor" style="margin-bottom:1.1rem">Exige rastreador<input type="checkbox" name="rast"' + (c.exigeRastreador ? ' checked' : '') + '></label>' +
      '<label class="interruptor" style="margin-bottom:1.1rem">Escolta<input type="checkbox" name="escolta"' + (c.escolta ? ' checked' : '') + '></label></div>' +
      '<label class="campo"><span>Observações</span><textarea name="obs">' + esc(c.obs || '') + '</textarea></label>' + rodape('Salvar carga'),
      async (f) => {
        if (!f.cliente.value.trim() || !f.oc.value.trim() || !f.ou.value || !f.dc.value.trim() || !f.du.value) throw new Error('Preencha cliente, origem e destino com UF.');
        const salva = await SV.salvarCarga(Object.assign({}, c, {
          cliente: f.cliente.value.trim(), origemCidade: f.oc.value.trim(), origemUF: f.ou.value, destinoCidade: f.dc.value.trim(), destinoUF: f.du.value,
          dataCarregamento: f.data.value ? new Date(f.data.value + 'T08:00').getTime() : null,
          pesoKg: num(f.peso.value) ? Math.round(num(f.peso.value) * 1000) : null,
          carrocerias: chipsLidos($('.chips', f)), anoMinimo: parseInt(f.ano.value, 10) || null,
          valorCliente: num(f.valor.value), exigeRastreador: f.rast.checked, escolta: f.escolta.checked, obs: f.obs.value.trim()
        }));
        P.selCarga = salva.id;
        aviso('Carga salva.');
      });
  }

  /* ---------- exportação ---------- */
  function exportar() {
    const g = veGestao();
    const cab = ['Criado em', 'Motorista', 'Telefone', 'Cidade', 'UF', 'Veículo', 'Carroceria', 'Capacidade (t)', 'Placa', 'Destinos', 'Aceita outras', 'Situação', 'Responsável', '1º contato (min)', 'Repasse', 'Pedágio', 'Pagamento']
      .concat(g ? ['Valor cliente', 'Diferença comercial'] : []).concat(['Motivos de recusa']);
    const dt = (ms) => ms ? new Date(ms).toLocaleString('pt-BR') : '';
    const linhas = P.fila.slice().sort((a, b) => a.criadoEm - b.criadoEm).map((d) => {
      const v = d.veiculo || {}, a = P.atend[d.id] || {}, n = a.negociacao || {};
      return [dt(d.criadoEm), d.motoristaNome, U.telefone(d.telefone), d.cidade, d.uf, v.tipo, v.carroceria, v.capacidadeKg ? v.capacidadeKg / 1000 : '', v.placa,
        (d.destinos || []).join(' '), d.aceitaOutras ? 'sim' : 'não', SV.STATUS[SV.statusEfetivo(d)].rotulo, d.responsavelNome || '',
        d.assumidoEm ? Math.round((d.assumidoEm - d.criadoEm) / 60000) : '', n.repasse || '', n.pedagio || '', n.pagamento || '']
        .concat(g ? [n.valorCliente || '', n.valorCliente && n.repasse ? n.valorCliente - n.repasse : ''] : [])
        .concat([(a.recusas || []).map((r) => r.motivo).join(', ')]);
    });
    const csv = '\ufeff' + [cab].concat(linhas).map((l) => l.map((c) => {
      const s = typeof c === 'number' ? String(c).replace('.', ',') : String(c == null ? '' : c);
      return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'severo-atendimentos-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    aviso('Planilha exportada (' + linhas.length + ' registros).');
  }

  /* ---------- eventos ---------- */
  raiz.addEventListener('click', async (e) => {
    const nav = e.target.closest('[data-aba]');
    if (nav) return trocarAba(nav.dataset.aba);
    const s = e.target.closest('[data-sel]');
    if (s) { P.sel = s.dataset.sel; desenharLista(); desenharDetalhe(); $('#detalhe').scrollTop = 0; return; }
    const ca = e.target.closest('[data-carga]');
    if (ca) { P.selCarga = ca.dataset.carga; desenharCargas(); desenharDetalheCarga(); return; }
    const ab = e.target.closest('[data-abrir]');
    if (ab) { P.sel = ab.dataset.abrir; P.f.grupo = 'ativos'; return trocarAba('fila'); }
    const zap = e.target.closest('[data-contato]');
    const d = P.fila.find((x) => x.id === P.sel);
    if (zap && d) { SV.anotar(d, 'Contato por ' + zap.dataset.contato, P.op).catch(() => {}); return; }
    const b = e.target.closest('[data-acao]');
    if (!b) return;
    const acao = b.dataset.acao;
    try {
      if (acao === 'sair') { P.parar.forEach((f) => f()); await SV.sairOperador(); P.op = null; return telaLogin(); }
      if (acao === 'semear') { await SV.semearDemo(); return aviso('Dados de exemplo criados.'); }
      if (acao === 'limpar') { if (confirm('Apagar todos os dados de demonstração deste navegador?')) { SV.limparDemo(); P.sel = null; aviso('Demonstração limpa.'); } return; }
      if (acao === 'exportar') return exportar();
      if (acao === 'nova-carga') return dlgCarga();
      if (acao === 'editar-carga') return dlgCarga(P.cargas.find((c) => c.id === P.selCarga));
      if (acao === 'cancelar-carga') {
        const c = P.cargas.find((x) => x.id === P.selCarga);
        if (c && confirm('Cancelar esta carga?')) await SV.salvarCarga(Object.assign({}, c, { status: 'cancelada' }));
        return;
      }
      if (!d) return;
      if (acao === 'assumir') { await SV.assumir(d, P.op); return aviso('Atendimento é seu. Ligue ou chame no WhatsApp.'); }
      if (acao === 'transferir') { if (confirm('Transferir o atendimento de ' + d.responsavelNome + ' para você?')) { await SV.assumir(d, P.op, true); aviso('Atendimento transferido para você.'); } return; }
      if (acao === 'proposta') return dlgProposta(d);
      if (acao === 'recusou') return dlgRecusa(d);
      if (acao === 'fechar') return dlgFechar(d);
      if (acao === 'aceitou') { await SV.mudarStatus(d, 'aguardando_aprovacao', P.op, 'Motorista aceitou a proposta'); return aviso('Aceite registrado. Falta a aprovação documental.'); }
      if (acao === 'carregado') { await SV.mudarStatus(d, 'carregado', P.op, 'Carregamento registrado'); return aviso('Carregamento registrado. Disponibilidade encerrada.'); }
      if (acao === 'sem-carga') return dlgMotivo(d, 'sem_carga', 'Sem carga encontrada', 'Encerrar e avisar');
      if (acao === 'cancelar') return dlgMotivo(d, 'cancelado', 'Cancelar atendimento', 'Cancelar pedido');
    } catch (err) { aviso(err.message || 'Não foi possível concluir.', true); }
  });

  /* ---------- partida ---------- */
  async function iniciar() {
    raiz.innerHTML = '<div class="login"><span class="miudo">Carregando a central…</span></div>';
    try { await SV.iniciar('painel'); }
    catch (e) { raiz.innerHTML = '<div class="login"><p>Sem conexão com o servidor. Verifique a internet e recarregue.</p></div>'; return; }
    P.op = await SV.operadorAtual();
    if (P.op) montar(); else telaLogin();
    setInterval(() => { if (P.op) { desenharKpis(); if (P.aba === 'fila') desenharLista(); } }, 30000);
  }
  iniciar();
})();
