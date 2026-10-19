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
    f: { grupo: 'ativos', busca: '', uf: '', carroceria: '', destino: '', meus: false, ordem: 'espera' },
    vistos: null, parar: [], statusAnt: null, usuarios: [], acessos: [], motoristas: [], veiculos: [], bloqueios: [], adm: 'geral', buscaMot: '', interesses: [], intVistos: null, sincronizadas: {}
  };
  const lugar = (cid, uf) => (cid ? cid + '/' : '') + (uf || '?');
  const papel = () => (P.op && P.op.papel) || '';
  const ehAdmin = () => papel() === 'admin';
  const ehGestao = () => papel() === 'gestao' || papel() === 'admin';
  const soCargas = () => papel() === 'operacoes';

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
      '<img class="logo" src="logo-severo.png" alt="Severo Transportes">' +
      '<h1 class="titulo">Central de cargas</h1>' +
      (demo
        ? '<p class="sub">Modo demonstração. Os dados ficam neste navegador. Abra o app do motorista em outra aba para ver os pedidos chegando ao vivo.</p>' +
          '<label class="campo"><span>Seu nome</span><input name="nome" required autocomplete="name"></label>' +
          '<label class="campo"><span>Função</span><select name="papel">' + Object.keys(SV.PAPEIS).map((k) => '<option value="' + k + '"' + (k === 'admin' ? ' selected' : '') + '>' + SV.PAPEIS[k] + '</option>').join('') + '</select></label>'
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
    const rotPapel = SV.PAPEIS[P.op.papel] || P.op.papel;
    if (soCargas()) P.aba = 'cargas';
    if (P.aba === 'admin' && !ehAdmin()) P.aba = 'fila';
    raiz.innerHTML = '<div class="pn">' +
      '<aside class="pn-lado">' +
      '<img class="logo" src="logo-severo.png" alt="Severo Transportes">' +
      (soCargas() ? '' : '<button class="pn-nav" data-aba="fila">Fila de motoristas <span class="cont" id="cont-fila"></span></button>') +
      '<button class="pn-nav" data-aba="cargas">Cargas <span class="cont" id="cont-cargas" style="background:var(--cabine-3);color:var(--texto-2)"></span></button>' +
      (ehAdmin() ? '<button class="pn-nav" data-aba="admin">Administração <span class="cont" id="cont-online" style="background:var(--verde-tinta);color:var(--verde)"></span></button>' : '') +
      (soCargas() ? '' : '<button class="pn-nav" data-acao="exportar">Exportar planilha</button>') +
      '<div class="fim">' +
      (demo ? '<div class="selo-demo">Modo demonstração. Configure o Firebase em config.js para usar de verdade.</div>' +
        '<button class="btn btn-p" data-acao="semear">Gerar dados de exemplo</button>' +
        '<button class="btn btn-p btn-fantasma" data-acao="limpar">Limpar demonstração</button>' +
        '<a class="btn btn-p btn-fantasma" href="./" target="_blank" rel="noopener">Abrir app do motorista</a>' : '') +
      '<div class="pn-op"><b>' + esc(P.op.nome) + '</b><span>' + esc(rotPapel) + (P.op.email ? '<br>' + esc(P.op.email) : '') + '</span></div>' +
      '<button class="btn btn-p btn-fantasma" data-acao="sair">' + IC.sair + 'Sair</button>' +
      '</div></aside>' +
      '<main class="pn-main"><div class="pn-kpis" id="kpis"></div><div class="pn-corpo" id="corpo"></div></main>' +
      '</div>';
    trocarAba(P.aba);
    P.parar.forEach((f) => f());
    clearInterval(P.tPresenca);
    SV.presenca(P.op, true).catch(() => {});
    P.tPresenca = setInterval(() => { if (P.op) SV.presenca(P.op).catch(() => {}); }, 120000);
    const obsCargas = SV.observarCargas((l) => {
        P.cargas = l.sort((a, b) => (a.dataCarregamento || 0) - (b.dataCarregamento || 0));
        if (!soCargas()) l.filter((c) => c.publicada !== 2 && !P.sincronizadas[c.id]).forEach((c) => { P.sincronizadas[c.id] = 1; SV.salvarCarga(c).catch(() => {}); });
        atualizar();
      });
    if (soCargas()) { P.parar = [obsCargas]; return; }
    P.parar = [
      obsCargas,
      SV.observarFila((l) => { novosPedidos(l); P.fila = l; atualizar(); }),
      SV.observarAtendimentos((l) => { P.atend = {}; l.forEach((a) => { P.atend[a.id] = a; }); atualizar(); }),
      SV.observarInteresses((l) => {
        if (P.intVistos) {
          const novo = l.find((i) => !P.intVistos.has(i.id));
          if (novo) {
            const c = P.cargas.find((x) => x.id === novo.cargaId);
            aviso(novo.motoristaNome + (novo.valorPedido ? ' quer negociar a carga' : ' tem interesse na carga') + (c ? ' ' + c.origemUF + ' → ' + c.destinoUF : '') + (novo.valorPedido ? ': pede ' + U.moeda(novo.valorPedido) : '') + '.');
            bipe();
          }
        }
        P.intVistos = new Set(l.map((i) => i.id));
        P.interesses = l.sort((a, b) => b.em - a.em);
        atualizar();
      })
    ];
    if (ehAdmin()) {
      P.parar.push(
        SV.observarUsuarios((l) => { P.usuarios = l; atualizar(); }),
        SV.observarAcessos((l) => { P.acessos = l; if (P.aba === 'admin') desenharAdmin(); }),
        SV.observarMotoristas((l) => { P.motoristas = l; if (P.aba === 'admin') desenharAdmin(); }),
        SV.observarTodosVeiculos((l) => { P.veiculos = l; if (P.aba === 'admin') desenharAdmin(); }),
        SV.observarBloqueios((l) => { P.bloqueios = l.sort((a, b) => (b.em || 0) - (a.em || 0)); if (P.aba === 'admin') desenharAdmin(); })
      );
    }
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
    // resposta do motorista pelo app
    if (P.statusAnt) {
      l.forEach((d) => {
        const antes = P.statusAnt[d.id];
        if (antes === 'proposta_enviada' && d.respostaMotorista && Date.now() - d.respostaMotorista.em < 120000) {
          if (d.status === 'aguardando_aprovacao') { aviso(d.motoristaNome + ' aceitou a proposta pelo app.'); bipe(); }
          else if (d.status === 'em_atendimento') { aviso(d.motoristaNome + ' recusou a proposta: ' + d.respostaMotorista.motivo + '.', true); bipe(); }
        }
        if (antes === 'proposta_enviada' && d.status === 'contraproposta' && d.contraproposta) { aviso(d.motoristaNome + ' quer negociar: pede ' + U.moeda(d.contraproposta.valor) + '.'); bipe(); }
      });
    }
    P.statusAnt = {}; l.forEach((d) => { P.statusAnt[d.id] = d.status; });
  }

  function trocarAba(aba) {
    P.aba = aba;
    P.assinDet = null;
    $$('.pn-nav[data-aba]').forEach((b) => b.setAttribute('aria-current', b.dataset.aba === aba ? 'page' : 'false'));
    const corpo = $('#corpo');
    corpo.classList.toggle('unica', aba === 'admin');
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
        '<select class="entrada" id="f-ordem" aria-label="Ordenar fila">' + [['espera', 'Ordem: esperando há mais tempo'], ['recentes', 'Ordem: mais recentes'], ['carregar', 'Ordem: carrega primeiro'], ['vence', 'Ordem: vence primeiro'], ['capacidade', 'Ordem: maior capacidade'], ['cidade', 'Ordem: cidade (A–Z)'], ['situacao', 'Ordem: situação']]
          .map((o) => '<option value="' + o[0] + '"' + (P.f.ordem === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' +
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
      ['uf', 'destino', 'carroceria', 'ordem'].forEach((k) => $('#f-' + k).addEventListener('change', (e) => { P.f[k] = e.target.value; desenharLista(); }));
      $('#f-meus').addEventListener('change', (e) => { P.f.meus = e.target.checked; desenharLista(); });
    } else if (aba === 'admin') {
      corpo.innerHTML = '<section class="pn-admin" id="admin"></section>';
    } else {
      corpo.innerHTML = '<section class="pn-coluna">' +
        '<div class="pn-filtros">' + (soCargas() ? '<span class="miudo">Cargas disponíveis na Severo. Acesso somente para consulta.</span>'
          : '<button class="btn btn-p btn-primario" data-acao="carga-voz">' + IC.mic + 'Lançar por áudio</button><button class="btn btn-p" data-acao="nova-carga">' + IC.mais + 'Nova carga</button><span class="miudo">Fale ou cole a mensagem do WhatsApp.</span>') + '</div>' +
        '<div class="pn-lista" id="lista-cargas"></div></section>' +
        '<section class="pn-detalhe" id="det-carga"></section>';
    }
    atualizar();
  }

  function atualizar() {
    if (!P.op || !$('#kpis')) return;
    desenharKpis();
    const semResp = P.fila.filter((d) => SV.ATIVOS.includes(d.status) && !SV.vencida(d) && !d.responsavelId).length;
    const cf = $('#cont-fila');
    if (cf) { cf.textContent = semResp || ''; cf.style.display = semResp ? '' : 'none'; }
    const co = $('#cont-online');
    if (co) { const n = P.usuarios.filter(online).length; co.textContent = n ? n + ' on' : ''; co.style.display = n ? '' : 'none'; }
    const abertas = P.cargas.filter((c) => c.status === 'aberta').length;
    $('#cont-cargas').textContent = abertas || '';
    $('#cont-cargas').style.display = abertas ? '' : 'none';
    document.title = (semResp ? '(' + semResp + ') ' : '') + 'Central Severo';
    if (P.aba === 'fila') { desenharLista(); desenharDetalhe(); }
    else if (P.aba === 'admin') desenharAdmin();
    else { desenharCargas(); desenharDetalheCarga(); }
  }

  /* ---------- indicadores ---------- */
  function desenharKpis() {
    const hoje = U.hojeInicio();
    const k0 = (v, rot, cls) => '<div class="kpi ' + (cls || '') + '"><b>' + v + '</b><span>' + rot + '</span></div>';
    if (soCargas()) {
      const ab = P.cargas.filter((c) => c.status === 'aberta');
      const amanha = hoje + 86400000;
      $('#kpis').innerHTML = k0(ab.length, 'Cargas abertas') +
        k0(ab.filter((c) => c.dataCarregamento >= hoje && c.dataCarregamento < amanha).length, 'Carregam hoje') +
        k0(ab.filter((c) => c.dataCarregamento >= amanha && c.dataCarregamento < amanha + 86400000).length, 'Carregam amanhã') +
        k0(P.cargas.filter((c) => c.status === 'fechada').length, 'Fechadas') +
        k0(P.cargas.length, 'Total cadastradas');
      return;
    }
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
        const alvo = U.norm([d.motoristaNome, d.cidade, d.bairro, d.uf, (d.veiculo || {}).placa, d.telefone].join(' '));
        if (alvo.indexOf(b) < 0) return false;
      }
      return true;
    }).sort((a, z) => {
      const cap = (d) => d.capacidadeLivreKg || (d.veiculo || {}).capacidadeKg || 0;
      const ordemSit = ['disponivel', 'em_atendimento', 'proposta_enviada', 'aguardando_aprovacao', 'carga_fechada', 'carregado', 'vencida', 'sem_carga', 'cancelado'];
      switch (P.f.ordem) {
        case 'recentes': return (z.criadoEm || 0) - (a.criadoEm || 0);
        case 'carregar': return ((a.quando || {}).em || 0) - ((z.quando || {}).em || 0);
        case 'vence': return (a.expiraEm || 0) - (z.expiraEm || 0);
        case 'capacidade': return cap(z) - cap(a);
        case 'cidade': return (a.cidade || '').localeCompare(z.cidade || '', 'pt-BR') || (a.bairro || '').localeCompare(z.bairro || '', 'pt-BR');
        case 'situacao': return ordemSit.indexOf(SV.statusEfetivo(a)) - ordemSit.indexOf(SV.statusEfetivo(z)) || (a.criadoEm || 0) - (z.criadoEm || 0);
        default:
          if (P.f.grupo === 'ativos') {
            if (!a.responsavelId !== !z.responsavelId) return a.responsavelId ? 1 : -1;
            return (a.criadoEm || 0) - (z.criadoEm || 0);
          }
          return (z.atualizadoEm || 0) - (a.atualizadoEm || 0);
      }
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
        '<div><div class="loc">' + esc(d.cidade || 'Local no áudio') + (d.uf ? '<span>' + esc(d.uf) + (d.bairro ? ' · ' + esc(d.bairro) : '') + '</span>' : '') + '</div>' +
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
    const pode = meu || ehGestao();
    const idadeLocalH = (Date.now() - (d.localEm || d.criadoEm)) / 3600000;
    const zap = 'https://wa.me/' + U.whats(d.telefone) + '?text=' + encodeURIComponent('Olá, ' + (d.motoristaNome || '').split(' ')[0] + '! Aqui é ' + P.op.nome.split(' ')[0] + ', da Severo. Vi que você está disponível' + (d.cidade ? ' em ' + d.cidade + '/' + d.uf : '') + '.');

    let acoes = '';
    if (pode) {
      const rm = d.respostaMotorista;
      if (rm && !rm.aceita && st === 'em_atendimento') acoes = '<div class="det-alerta" style="width:100%;margin:0 0 6px">Motorista recusou pelo app ' + U.desde(rm.em) + ': ' + esc(rm.motivo) + (rm.obs ? ' · ' + esc(rm.obs) : '') + '</div>';
      if (rm && rm.aceita && st === 'aguardando_aprovacao') acoes = '<div class="det-alerta" style="width:100%;margin:0 0 6px;color:var(--verde)">Motorista aceitou pelo app ' + U.desde(rm.em) + '. Confira os documentos e feche.</div>';
      if (st === 'em_atendimento') acoes += bt('proposta', 'Enviar proposta', 'btn-primario') + bt('sem-carga', 'Sem carga encontrada') + bt('cancelar', 'Cancelar', 'btn-fantasma btn-perigo');
      else if (st === 'proposta_enviada') acoes = '<span class="miudo" style="width:100%">Aguardando o motorista responder no app, ou registre a resposta dada por telefone:</span>' + bt('aceitou', 'Motorista aceitou', 'btn-primario') + bt('recusou', 'Motorista recusou') + bt('proposta', 'Refazer proposta', 'btn-fantasma');
      else if (st === 'contraproposta') {
        const cp = d.contraproposta || {};
        acoes = '<div class="det-alerta" style="width:100%;margin:0 0 6px;color:var(--amarelo)">Motorista quer negociar: pede <b>' + U.moeda(cp.valor) + '</b>' + (d.proposta ? ' (proposta era ' + U.moeda(d.proposta.valorParceiro) + ')' : '') + (cp.mensagem ? ' · “' + esc(cp.mensagem) + '”' : '') + '</div>' +
          bt('aceitar-contra', 'Aceitar ' + U.moeda(cp.valor), 'btn-primario') + bt('proposta', 'Fazer nova proposta') + bt('cancelar', 'Encerrar', 'btn-fantasma btn-perigo');
      }
      else if (st === 'aguardando_aprovacao') acoes += bt('fechar', 'Aprovar e fechar carga', 'btn-primario') + bt('recusou', 'Não aprovado / recusou');
      else if (st === 'carga_fechada') acoes = bt('carregado', 'Registrar carregamento', 'btn-primario');
      else if (st === 'vencida') acoes = '<span class="miudo">Aviso vencido. Ligue para confirmar; o motorista renova no app.</span> ' + bt('cancelar', 'Encerrar', 'btn-fantasma btn-perigo');
    }

    const hist = (d.historico || []).map((h) => Object.assign({ interno: false }, h))
      .concat((a.notas || []).map((h) => Object.assign({ interno: true }, h)))
      .sort((x, y) => y.em - x.em);

    const neg = a.negociacao;
    const negHtml = neg ? '<div class="det-sec"><h3>Negociação <small>' + esc(neg.por || '') + ' · ' + U.desde(neg.em) + '</small></h3>' +
      '<dl class="det-grade">' +
      '<div><dt>Frete ao motorista</dt><dd class="num">' + U.moeda(neg.repasse) + '</dd></div>' +
      '<div><dt>Pedágio</dt><dd>' + (neg.pedagioIncluso ? 'Incluso no frete' : 'À parte' + (neg.pedagio ? ' · ' + U.moeda(neg.pedagio) : '')) + '</dd></div>' +
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
      '<a class="btn btn-p" href="' + zap + '" target="_blank" rel="noopener" data-contato="WhatsApp">' + IC.zap + 'WhatsApp</a>' +
      (ehGestao() ? '<button class="btn btn-p btn-fantasma btn-perigo" data-acao="bloquear-disp">Bloquear</button>' : '') + '</div></div>' +

      '<div class="det-faixa"><span class="etq ' + S.tom + '">' + S.rotulo + '</span>' +
      '<span class="miudo">' + (d.responsavelNome ? 'Com ' + esc(d.responsavelNome) : 'Sem responsável') + '</span>' +
      (SV.ATIVOS.includes(d.status) ? '<span class="miudo">· ' + (st === 'vencida' ? 'venceu ' + U.desde(d.expiraEm) : 'vale ' + U.ate(d.expiraEm)) + '</span>' : '') +
      '<span class="sep"></span>' +
      (!d.responsavelId && SV.ATIVOS.includes(d.status) ? bt('assumir', 'Assumir atendimento', 'btn-azul') : '') +
      (d.responsavelId && !meu && SV.ATIVOS.includes(d.status) ? bt('transferir', 'Transferir para mim', 'btn-fantasma') : '') +
      '</div>' +

      '<dl class="det-grade">' +
      '<div><dt>Onde está</dt><dd>' + (d.bairro ? esc(d.bairro) + '<br>' : '') + esc(d.cidade || 'Informado no áudio') + (d.uf ? '/' + esc(d.uf) : '') +
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

      (d.audioUrl ? '<div class="det-sec det-audio"><h3>Áudio do motorista</h3><audio controls preload="none" id="audio-det"' + (d.audioUrl.indexOf('fs:') === 0 ? '' : ' src="' + esc(d.audioUrl) + '"') + '></audio></div>' : '') +
      (acoes ? '<div class="det-sec"><h3>Próximo passo</h3><div class="det-acoes">' + acoes + '</div></div>' : '') +
      negHtml + matches +

      '<div class="det-sec"><h3>Histórico <small>notas internas não aparecem para o motorista</small></h3>' +
      '<form class="anotar" id="f-anotar" style="margin-bottom:16px"><input class="entrada" id="anotar-txt" placeholder="Registrar contato: liguei, sem resposta…" autocomplete="off">' +
      '<button class="btn btn-p" type="submit">Registrar</button></form>' +
      '<ul class="hist">' + hist.map((h) => '<li class="' + esc(h.tipo) + '"><div>' + esc(h.texto) + (h.interno ? '<span class="interno">interno</span>' : '') + '</div>' +
        '<div class="q">' + new Date(h.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + (h.por ? ' · ' + esc(h.por.nome) : h.tipo === 'motorista' ? ' · motorista' : '') + '</div></li>').join('') + '</ul></div>';

    if (d.audioUrl && d.audioUrl.indexOf('fs:') === 0) {
      P.audios = P.audios || {};
      const tocar = (src) => { const el2 = $('#audio-det'); if (el2 && src) el2.src = src; };
      if (P.audios[d.audioUrl]) tocar(P.audios[d.audioUrl]);
      else SV.audio(d.audioUrl).then((src) => { P.audios[d.audioUrl] = src; tocar(src); }).catch(() => aviso('Não foi possível carregar o áudio.', true));
    }
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
    const ativos = soCargas() ? [] : P.fila.filter((d) => SV.ATIVOS.includes(d.status) && !SV.vencida(d));
    el.innerHTML = '<table class="tabela"><thead><tr><th>Rota</th><th>Cliente</th><th>Peso</th><th>Frete</th><th>Situação</th>' + (soCargas() ? '' : '<th>Encaixam</th><th>Interesse</th>') + '</tr></thead><tbody>' +
      P.cargas.map((c) => {
        const n = ativos.filter((d) => SV.compatibilidade(d, c).ok).length;
        return '<tr class="clicavel" data-carga="' + c.id + '" aria-current="' + (P.selCarga === c.id) + '">' +
          '<td><b>' + esc(c.origemUF) + ' → ' + esc(c.destinoUF) + '</b><div class="miudo">' + esc(c.origemCidade || c.origemUF) + ' → ' + esc(c.destinoCidade || c.destinoUF) + '</div></td>' +
          '<td>' + (esc(c.cliente) || '<span class="miudo">não informado</span>') + (c.produto ? '<div class="miudo">' + esc(c.produto) + '</div>' : '') + '</td><td class="num">' + U.toneladas(c.pesoKg) + '</td>' +
          '<td class="num">' + (c.valorOferecido ? U.moeda(c.valorOferecido) + '<div class="miudo">' + (c.pedagioIncluso ? 'c/ pedágio' : 's/ pedágio') + '</div>' : '<span class="miudo">a combinar</span>') + '</td>' +
          '<td>' + (c.status === 'aberta' && c.dataCarregamento && c.dataCarregamento < Date.now() - 86400000 ? '<span class="etq vermelho">Data passada</span>' : '<span class="etq ' + (c.status === 'aberta' ? 'azul' : c.status === 'fechada' ? 'verde' : c.status === 'rascunho' ? 'amarelo' : 'cinza') + '">' + ({ aberta: 'Aberta', fechada: 'Fechada', cancelada: 'Cancelada', rascunho: 'Rascunho' }[c.status] || c.status) + '</span>') + '</td>' +
          (soCargas() ? '</tr>' : '<td class="num">' + (c.status === 'aberta' ? n : '—') + '</td>' +
          '<td class="num">' + (function () { const q = P.interesses.filter((i) => i.cargaId === c.id && i.status !== 'descartado'); const novos = q.filter((i) => i.status === 'novo').length; return q.length ? q.length + (novos ? ' <span class="etq laranja">' + novos + ' novo' + (novos > 1 ? 's' : '') + '</span>' : '') : '—'; })() + '</td></tr>');
      }).join('') + '</tbody></table>';
  }
  function secInteressados(c) {
    const l = P.interesses.filter((i) => i.cargaId === c.id && i.status !== 'descartado');
    if (!l.length) return c.status === 'aberta' ? '<div class="det-sec"><h3>Interessados pelo app</h3><p class="miudo">Nenhum motorista marcou interesse ainda. A carga aparece no app de todos os motoristas.</p></div>' : '';
    return '<div class="det-sec"><h3>Interessados pelo app <small>' + l.length + '</small></h3>' + l.map((i) => {
      const v = i.veiculo || {};
      const r = SV.compatibilidade({ veiculo: v }, c);
      const zap = 'https://wa.me/' + U.whats(i.telefone) + '?text=' + encodeURIComponent('Olá, ' + (i.motoristaNome || '').split(' ')[0] + '! Aqui é ' + P.op.nome.split(' ')[0] + ', da Severo. Vi seu interesse na carga ' + c.origemCidade + ' → ' + c.destinoCidade + '.');
      return '<div class="match' + (r.ok ? '' : ' ruim') + '"><div><div class="rota">' + esc(i.motoristaNome) + ' ' + (i.status === 'novo' ? '<span class="etq laranja">novo</span>' : '<span class="etq cinza">' + esc(i.atendidoPor ? 'com ' + i.atendidoPor : 'visto') + '</span>') + '</div>' +
        '<div class="miudo">' + esc(U.telefone(i.telefone)) + ' · ' + esc(v.tipo || '') + ' ' + esc(v.carroceria || '') + ' · ' + U.toneladas(v.capacidadeKg) + ' · ' + U.desde(i.em) + '</div>' +
        (i.valorPedido ? '<div style="margin-top:4px;color:var(--amarelo);font-weight:600">Quer negociar: pede ' + U.moeda(i.valorPedido) + (i.mensagem ? ' · “' + esc(i.mensagem) + '”' : '') + '</div>' : '') + '</div>' +
        '<div class="nota">' + (r.ok ? 'encaixa' : 'não atende') + '</div>' +
        (r.ok ? '' : '<div class="detalhes">' + r.falhas.map((f) => '<span class="falha">' + esc(f) + '</span>').join(' · ') + '</div>') +
        '<div class="det-acoes" style="grid-column:1/-1"><a class="btn btn-p" href="' + zap + '" target="_blank" rel="noopener" data-int-contato="' + i.id + '">' + IC.zap + 'WhatsApp</a>' +
        '<a class="btn btn-p" href="tel:+' + U.whats(i.telefone) + '" data-int-contato="' + i.id + '">' + IC.fone + 'Ligar</a>' +
        '<button class="btn btn-p btn-fantasma" data-int-descartar="' + i.id + '">Descartar</button></div></div>';
    }).join('') + '</div>';
  }
  function desenharDetalheCarga() {
    const el = $('#det-carga'); if (!el) return;
    const c = P.cargas.find((x) => x.id === P.selCarga);
    if (!c) { el.innerHTML = '<div class="pn-vazio" style="padding-top:80px">Escolha uma carga para ver os motoristas que encaixam.</div>'; return; }
    const ativos = P.fila.filter((d) => SV.ATIVOS.includes(d.status) && !SV.vencida(d))
      .map((d) => ({ d: d, r: SV.compatibilidade(d, c) })).sort((x, y) => (y.r.ok - x.r.ok) || (y.r.nota - x.r.nota));
    const dia = (ms) => ms ? new Date(ms).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) : '—';
    el.innerHTML = '<div class="det-topo"><div><h2 class="det-nome">' + esc(c.origemCidade || c.origemUF) + ' → ' + esc(c.destinoCidade || c.destinoUF) + '</h2>' +
      '<div class="det-sub">' + [esc(c.produto ? 'Carga de ' + c.produto.toLowerCase() : ''), esc(c.cliente)].filter(Boolean).join(' · ') + '</div></div>' +
      '<div class="det-contatos">' + (soCargas() ? '' : (c.status === 'rascunho' ? bt('editar-carga', 'Revisar e publicar', 'btn-primario') : bt('editar-carga', 'Editar')) + (c.status === 'aberta' || c.status === 'rascunho' ? bt('cancelar-carga', c.status === 'rascunho' ? 'Descartar' : 'Cancelar carga', 'btn-fantasma btn-perigo') : '')) + '</div></div>' +
      (c.status === 'rascunho' ? '<div class="det-alerta" style="margin-top:12px">Rascunho lançado por áudio: ainda não aparece para os motoristas. Revise e publique.</div>' : '') +
      (c.status === 'aberta' && c.dataCarregamento && c.dataCarregamento < Date.now() - 86400000 ? '<div class="det-alerta" style="margin-top:12px">A data de carregamento (' + new Date(c.dataCarregamento).toLocaleDateString('pt-BR') + ') já passou, por isso esta carga não aparece para os motoristas. Clique em Editar e corrija a data.</div>' : '') +
      '<dl class="det-grade" style="margin-top:18px">' +
      '<div><dt>Origem</dt><dd>' + esc(lugar(c.origemCidade, c.origemUF)) + '</dd></div>' +
      '<div><dt>Destino</dt><dd>' + esc(lugar(c.destinoCidade, c.destinoUF)) + '</dd></div>' +
      '<div><dt>Carregamento</dt><dd>' + dia(c.dataCarregamento) + '</dd></div>' +
      '<div><dt>Descarga</dt><dd>' + dia(c.dataDescarga) + '</dd></div>' +
      '<div><dt>Peso</dt><dd>' + U.toneladas(c.pesoKg) + '</dd></div>' +
      '<div><dt>Veículo</dt><dd>' + esc([c.tipoVeiculo, (c.carrocerias || []).join(', ')].filter(Boolean).join(' · ') || 'Qualquer') + '</dd></div>' +
      '<div><dt>Pagamento</dt><dd>' + esc(c.pagamento || '—') + '</dd></div>' +
      '<div><dt>Exigências</dt><dd>' + ([c.anoMinimo ? 'ano ' + c.anoMinimo + '+' : '', c.exigeRastreador ? 'rastreador' : '', c.escolta ? 'escolta' : ''].filter(Boolean).join(', ') || 'Nenhuma') + '</dd></div>' +
      '<div><dt>Frete ao motorista</dt><dd class="num">' + (c.valorOferecido ? U.moeda(c.valorOferecido) + '<div class="miudo">' + (c.pedagioIncluso ? 'pedágio incluso' : 'pedágio à parte') + '</div>' : 'a combinar') + '</dd></div>' +
      '<div class="largo"><dt>No app do motorista</dt><dd>' + (c.status === 'aberta' && c.visivelApp !== false ? 'Visível' : 'Oculta') + '</dd></div>' +
      (c.obsMotorista ? '<div class="largo"><dt>Observação para o motorista</dt><dd>' + esc(c.obsMotorista) + '</dd></div>' : '') +
      (c.obs && !soCargas() ? '<div class="largo"><dt>Observações internas</dt><dd>' + esc(c.obs) + '</dd></div>' : '') +
      '</dl>' +
      (soCargas() ? '' : secInteressados(c)) +
      (soCargas() ? '' : c.status === 'aberta' ? '<div class="det-sec"><h3>Motoristas disponíveis <small>requisitos primeiro, depois proximidade e destino</small></h3>' +
        (ativos.length ? ativos.map((x) => '<div class="match' + (x.r.ok ? '' : ' ruim') + '"><div><div class="rota">' + esc(x.d.motoristaNome) + '</div>' +
          '<div class="miudo">' + esc(x.d.cidade || '?') + '/' + esc(x.d.uf || '?') + ' · ' + esc((x.d.veiculo || {}).tipo) + ' ' + esc((x.d.veiculo || {}).carroceria) + ' · ' + U.desde(x.d.localEm || x.d.criadoEm) + '</div></div>' +
          '<div class="nota">' + (x.r.ok ? x.r.nota : 'não atende') + '</div>' +
          '<div class="detalhes">' + (x.r.ok ? esc(x.r.pontos.join(' · ') || 'Requisitos atendidos') : x.r.falhas.map((f) => '<span class="falha">' + esc(f) + '</span>').join(' · ')) + '</div>' +
          '<button class="btn btn-p" data-abrir="' + x.d.id + '">Abrir pedido</button></div>').join('')
          : '<p class="miudo">Nenhum motorista na fila agora.</p>') + '</div>'
        : '<div class="det-sec"><p class="miudo">Carga ' + (c.status === 'fechada' ? 'fechada' + (c.motoristaNome ? ' com ' + esc(c.motoristaNome) : '') : 'cancelada') + '.</p></div>');
  }

  /* ---------- administração ---------- */
  const online = (u) => u.ativo !== false && u.vistoEm && Date.now() - u.vistoEm < 5 * 60000;
  const quando = (ms) => ms ? new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  const DESC_PAPEL = {
    admin: 'Tudo, inclusive usuários, acessos e motoristas cadastrados.',
    gestao: 'Fila, cargas e negociações de toda a equipe.',
    operador: 'Atende a fila e cadastra cargas.',
    financeiro: 'Fila, cargas e exportação da planilha.',
    operacoes: 'Somente consulta as cargas. Não vê motoristas nem negociações.'
  };
  function barras(contagem, max) {
    const l = Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, max || 6);
    if (!l.length) return '<p class="miudo">Sem dados ainda.</p>';
    const topo = l[0][1];
    return l.map((x) => '<div class="barra"><span>' + esc(x[0]) + '</span><i style="width:' + Math.max(4, x[1] / topo * 100) + '%"></i><b class="num">' + x[1] + '</b></div>').join('');
  }
  function desenharAdmin() {
    const el = $('#admin'); if (!el) return;
    const b0 = $('#adm-busca'); const foco = b0 && document.activeElement === b0;
    const abas = [['geral', 'Visão geral'], ['usuarios', 'Usuários e acessos'], ['motoristas', 'Motoristas cadastrados']];
    el.innerHTML = '<div class="adm-topo"><h1 class="titulo-m" style="margin:0">Administração</h1>' +
      '<div class="pn-abas" style="border:0;padding:0">' + abas.map((a) => '<button class="pn-aba" data-adm="' + a[0] + '" aria-pressed="' + (P.adm === a[0]) + '">' + a[1] + '</button>').join('') + '</div></div>' +
      (P.adm === 'usuarios' ? admUsuarios() : P.adm === 'motoristas' ? admMotoristas() : admGeral());
    if (foco) { const b = $('#adm-busca'); b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
  }
  function admGeral() {
    const mes = Date.now() - 30 * 86400000;
    const on = P.usuarios.filter(online);
    const avisos30 = P.fila.filter((d) => d.criadoEm >= mes);
    const recusas = {};
    Object.values(P.atend).forEach((a) => (a.recusas || []).forEach((r) => { recusas[r.motivo] = (recusas[r.motivo] || 0) + 1; }));
    P.fila.forEach((d) => { const r = d.respostaMotorista; if (r && !r.aceita && r.motivo) recusas[r.motivo] = (recusas[r.motivo] || 0) + 1; });
    const destinos = {};
    avisos30.forEach((d) => (d.destinos || []).forEach((u) => { destinos[u] = (destinos[u] || 0) + 1; }));
    const origens = {};
    avisos30.forEach((d) => { if (d.cidade) { const k = d.cidade + '/' + d.uf; origens[k] = (origens[k] || 0) + 1; } });
    const n = (v, rot) => '<div><b class="num">' + v + '</b><span>' + rot + '</span></div>';
    return '<div class="adm-numeros">' +
      n(on.length, 'Usuários online agora') + n(P.usuarios.filter((u) => u.ativo !== false).length, 'Usuários ativos') +
      n(P.motoristas.length, 'Motoristas cadastrados') + n(P.veiculos.length, 'Veículos cadastrados') +
      n(avisos30.length, 'Avisos “estou vazio” · 30 dias') + n(P.cargas.filter((c) => c.status === 'aberta').length, 'Cargas abertas') +
      n(P.fila.filter((d) => d.fechadoEm && d.fechadoEm >= mes).length, 'Cargas fechadas · 30 dias') +
      n(P.fila.filter((d) => d.respostaMotorista && d.respostaMotorista.aceita).length, 'Propostas aceitas no app') +
      n(P.fila.filter((d) => d.contraproposta).length + P.interesses.filter((i) => i.valorPedido).length, 'Pedidos de negociação') +
      n(P.interesses.length, 'Interesses em cargas') + '</div>' +
      '<div class="adm-col">' +
      '<div class="det-sec"><h3>Online agora <small>visto nos últimos 5 min</small></h3>' +
      (on.length ? on.map((u) => '<div class="match"><div><div class="rota"><span class="ponto-on"></span>' + esc(u.nome) + '</div><div class="miudo">' + esc(u.email || '') + ' · ' + esc(SV.PAPEIS[u.papel] || u.papel) + ' · ' + esc(u.dispositivo || '') + '</div></div><div class="miudo">' + U.desde(u.vistoEm) + '</div></div>').join('') : '<p class="miudo">Ninguém online.</p>') + '</div>' +
      '<div class="det-sec"><h3>Últimos acessos</h3>' + tabelaAcessos(8) + '</div>' +
      '<div class="det-sec"><h3>Destinos mais pedidos <small>30 dias</small></h3>' + barras(destinos) + '</div>' +
      '<div class="det-sec"><h3>Onde os motoristas ficam vazios <small>30 dias</small></h3>' + barras(origens) + '</div>' +
      '<div class="det-sec"><h3>Motivos de recusa</h3>' + barras(recusas) + '</div>' +
      '</div>';
  }
  function tabelaAcessos(max) {
    const l = P.acessos.slice(0, max);
    if (!l.length) return '<p class="miudo">Nenhum acesso registrado ainda.</p>';
    return '<div style="overflow-x:auto"><table class="tabela"><thead><tr><th>Quando</th><th>Usuário</th><th>E-mail</th><th>Função</th><th>Dispositivo</th></tr></thead><tbody>' +
      l.map((a) => '<tr><td class="num">' + quando(a.em) + '</td><td>' + esc(a.nome) + '</td><td>' + esc(a.email) + '</td><td>' + esc(SV.PAPEIS[a.papel] || a.papel) + '</td><td class="miudo">' + esc(a.dispositivo || '') + '</td></tr>').join('') + '</tbody></table></div>';
  }
  function admUsuarios() {
    const l = P.usuarios.slice().sort((a, b) => (online(b) - online(a)) || ((b.vistoEm || 0) - (a.vistoEm || 0)));
    return '<div class="adm-acoes"><button class="btn btn-p btn-primario" data-acao="novo-usuario">' + IC.mais + 'Novo usuário</button>' +
      '<span class="miudo">' + l.filter(online).length + ' online · ' + l.filter((u) => u.ativo !== false).length + ' ativos · ' + l.length + ' no total</span></div>' +
      '<div style="overflow-x:auto"><table class="tabela"><thead><tr><th>Usuário</th><th>Função</th><th>Situação</th><th>Último acesso</th><th>Dispositivo</th><th></th></tr></thead><tbody>' +
      l.map((u) => {
        const eu = u.id === P.op.id;
        const sit = u.ativo === false ? '<span class="etq vermelho">Desativado</span>' : online(u) ? '<span class="etq verde">Online agora</span>' : '<span class="etq cinza">' + (u.vistoEm ? 'Visto ' + U.desde(u.vistoEm) : 'Nunca entrou') + '</span>';
        return '<tr><td><b>' + esc(u.nome) + (eu ? ' <span class="miudo">(você)</span>' : '') + '</b><div class="miudo">' + esc(u.email || '—') + '</div></td>' +
          '<td><select class="entrada" data-usr-papel="' + u.id + '"' + (eu ? ' disabled' : '') + ' style="min-height:36px;font-size:.88rem">' +
          Object.keys(SV.PAPEIS).map((k) => '<option value="' + k + '"' + (k === u.papel ? ' selected' : '') + '>' + SV.PAPEIS[k] + '</option>').join('') + '</select></td>' +
          '<td>' + sit + '</td><td class="num">' + quando(u.ultimoAcesso) + '</td><td class="miudo">' + esc(u.dispositivo || '—') + '</td>' +
          '<td style="white-space:nowrap">' + (u.email ? '<button class="btn btn-p btn-fantasma" data-usr-reset="' + u.id + '">Redefinir senha</button>' : '') +
          (eu ? '' : '<button class="btn btn-p btn-fantasma' + (u.ativo === false ? '' : ' btn-perigo') + '" data-usr-ativo="' + u.id + '">' + (u.ativo === false ? 'Reativar' : 'Desativar') + '</button>') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="det-sec"><h3>Histórico de acessos <small>últimos ' + Math.min(60, P.acessos.length) + '</small></h3>' + tabelaAcessos(60) + '</div>';
  }
  function admMotoristas() {
    const b = U.norm(P.buscaMot);
    const veics = {}; P.veiculos.forEach((v) => { (veics[v.motoristaId] = veics[v.motoristaId] || []).push(v); });
    const avisos = {}; P.fila.forEach((d) => { (avisos[d.motoristaId] = avisos[d.motoristaId] || []).push(d); });
    const l = P.motoristas.filter((m) => !b || U.norm(m.nome + ' ' + m.telefone + ' ' + (veics[m.id] || []).map((v) => v.placa).join(' ')).indexOf(b) >= 0)
      .sort((x, y) => ((avisos[y.id] || [])[0] ? Math.max.apply(null, avisos[y.id].map((d) => d.criadoEm)) : y.criadoEm) - ((avisos[x.id] || [])[0] ? Math.max.apply(null, avisos[x.id].map((d) => d.criadoEm)) : x.criadoEm));
    return '<div class="adm-acoes"><input class="entrada" id="adm-busca" placeholder="Buscar por nome, telefone ou placa" value="' + esc(P.buscaMot) + '" style="max-width:360px;min-height:40px;font-size:.95rem">' +
      '<span class="miudo">' + P.motoristas.length + ' motoristas · ' + P.veiculos.length + ' veículos</span></div>' +
      '<div style="overflow-x:auto"><table class="tabela"><thead><tr><th>Motorista</th><th>Veículos</th><th>Cadastro</th><th>Último aviso</th><th>Avisos</th><th>Fechadas</th><th>Agora</th><th></th></tr></thead><tbody>' +
      (l.length ? l.map((m) => {
        const av = (avisos[m.id] || []).sort((x, y) => y.criadoEm - x.criadoEm), ult = av[0];
        const vs = veics[m.id] || [];
        return '<tr><td><b>' + esc(m.nome) + '</b><div class="miudo num">' + esc(U.telefone(m.telefone)) + '</div></td>' +
          '<td>' + (vs.length ? vs.map((v) => esc(v.tipo + ' ' + v.carroceria) + ' · ' + U.toneladas(v.capacidadeKg) + (v.placa ? ' <span class="placa-br" style="margin:0">' + esc(v.placa) + '</span>' : '')).join('<br>') : '<span class="miudo">—</span>') + '</td>' +
          '<td class="num">' + quando(m.criadoEm) + '</td>' +
          '<td>' + (ult ? esc(ult.cidade || 'áudio') + (ult.uf ? '/' + esc(ult.uf) : '') + '<div class="miudo">' + U.desde(ult.criadoEm) + '</div>' : '<span class="miudo">nunca</span>') + '</td>' +
          '<td class="num">' + av.length + '</td><td class="num">' + av.filter((d) => d.fechadoEm).length + '</td>' +
          '<td>' + (m.bloqueado ? '<span class="etq vermelho">' + (m.excluidoEm ? 'Excluído e bloqueado' : 'Bloqueado') + '</span>' : ult ? '<span class="etq ' + SV.STATUS[SV.statusEfetivo(ult)].tom + '">' + SV.STATUS[SV.statusEfetivo(ult)].rotulo + '</span>' : '') + '</td>' +
          '<td style="white-space:nowrap">' + (m.bloqueado ? '<button class="btn btn-p btn-fantasma" data-mot-desbloq="' + m.id + '">Desbloquear</button>'
            : '<button class="btn btn-p btn-fantasma btn-perigo" data-mot-bloq="' + m.id + '">Bloquear</button>') +
          (m.excluidoEm ? '' : '<button class="btn btn-p btn-fantasma btn-perigo" data-mot-excluir="' + m.id + '">Excluir</button>') + '</td></tr>';
      }).join('') : '<tr><td colspan="8" class="miudo">Nenhum motorista encontrado.</td></tr>') + '</tbody></table></div>' +
      (P.bloqueios.length ? '<div class="det-sec"><h3>Números bloqueados <small>não conseguem se cadastrar de novo</small></h3><div style="overflow-x:auto"><table class="tabela"><thead><tr><th>Telefone</th><th>Nome</th><th>Motivo</th><th>Bloqueado por</th><th></th></tr></thead><tbody>' +
        P.bloqueios.map((b) => '<tr><td class="num">' + esc(U.telefone(b.telefone)) + '</td><td>' + esc(b.nome || '—') + '</td><td>' + esc(b.motivo || '—') + '</td><td>' + esc(b.por || '') + '<div class="miudo">' + quando(b.em) + '</div></td>' +
          '<td><button class="btn btn-p btn-fantasma" data-tel-desbloq="' + esc(b.id) + '">Desbloquear</button></td></tr>').join('') + '</tbody></table></div></div>' : '');
  }
  function gerarSenha() {
    const c = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let r = ''; const a = new Uint32Array(10); crypto.getRandomValues(a);
    a.forEach((x) => { r += c[x % c.length]; });
    return r;
  }
  function dlgUsuario() {
    dialogo('<h2>Novo usuário da central</h2>' +
      '<label class="campo"><span>Nome</span><input name="nome" required autocomplete="off"></label>' +
      '<label class="campo"><span>E-mail</span><input name="email" type="email" required autocomplete="off"></label>' +
      '<label class="campo"><span>Senha provisória</span><input name="senha" value="' + gerarSenha() + '" autocomplete="off"><small>Mínimo de 6 caracteres. A pessoa pode trocar depois em “Redefinir senha”.</small></label>' +
      '<label class="campo"><span>Função</span><select name="papel">' + Object.keys(SV.PAPEIS).map((k) => '<option value="' + k + '"' + (k === 'operador' ? ' selected' : '') + '>' + SV.PAPEIS[k] + '</option>').join('') + '</select>' +
      '<small id="desc-papel">' + DESC_PAPEL.operador + '</small></label>' +
      rodape('Criar usuário'),
      async (f) => {
        const nome = f.nome.value.trim(), email = f.email.value.trim().toLowerCase(), senha = f.senha.value;
        if (nome.length < 2) throw new Error('Digite o nome.');
        if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Digite um e-mail válido.');
        if (senha.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
        await SV.criarUsuario({ nome: nome, email: email, senha: senha, papel: f.papel.value, criadoPor: P.op.nome });
        const link = location.origin + '/painel';
        setTimeout(() => dialogo('<h2>Usuário criado</h2><p class="sub">Envie estes dados para ' + esc(nome.split(' ')[0]) + '.</p>' +
          '<div class="margem" id="cred" style="line-height:1.7">Endereço: <b>' + esc(link) + '</b><br>E-mail: <b>' + esc(email) + '</b><br>Senha: <b>' + esc(senha) + '</b><br>Função: <b>' + esc(SV.PAPEIS[f.papel.value]) + '</b></div>' +
          (SV.modo === 'demo' ? '<p class="miudo">No modo demonstração, o login é feito pelo nome.</p>' : '') +
          '<div class="rodape"><button type="button" class="btn" data-copiar-cred>Copiar</button><button type="submit" class="btn btn-primario">Pronto</button></div>',
          async () => {}), 0);
      },
      (f) => { f.papel.addEventListener('change', () => { $('#desc-papel').textContent = DESC_PAPEL[f.papel.value]; }); });
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
    const incluso = n.pedagioIncluso == null ? true : n.pedagioIncluso;
    dialogo('<h2>Proposta para ' + esc((d.motoristaNome || '').split(' ')[0]) + '</h2>' +
      (d.contraproposta && d.status === 'contraproposta' ? '<div class="margem">O motorista pediu <b>' + U.moeda(d.contraproposta.valor) + '</b>' + (d.contraproposta.mensagem ? ': “' + esc(d.contraproposta.mensagem) + '”' : '') + '</div>' : '') +
      '<label class="campo"><span>Carga</span><select name="carga"><option value="">Carga não cadastrada</option>' +
      abertas.map((x) => '<option value="' + x.c.id + '"' + (n.cargaId === x.c.id ? ' selected' : '') + '>' + esc(rot(x.c)) + (x.r.ok ? '' : ' (não atende)') + '</option>').join('') + '</select></label>' +
      '<label class="campo"><span>Rota informada ao motorista</span><input name="rota" value="' + esc(n.rota || '') + '" placeholder="Contagem/MG → Rio de Janeiro/RJ"></label>' +
      '<div class="grade2"><label class="campo"><span>Valor do frete ao motorista (R$)</span><input name="repasse" inputmode="decimal" required value="' + (n.repasse || '') + '"></label>' +
      '<label class="interruptor" style="margin:1.75rem 0 1.1rem">Pedágio incluso<input type="checkbox" name="incluso"' + (incluso ? ' checked' : '') + '></label></div>' +
      '<div class="grade2"><label class="campo" id="c-pedagio"' + (incluso ? ' style="display:none"' : '') + '><span>Pedágio à parte (R$)</span><input name="pedagio" inputmode="decimal" value="' + (n.pedagio || '') + '"><small>Vale-pedágio pago separado. Opcional.</small></label>' +
      '<label class="campo"><span>Pagamento combinado</span><input name="pagamento" value="' + esc(n.pagamento || '') + '" placeholder="70% no carregamento"></label></div>' +
      rodape('Enviar proposta ao motorista'),
      async (f) => {
        const repasse = num(f.repasse.value);
        if (!repasse) throw new Error('Informe o valor do frete ao motorista.');
        const carga = P.cargas.find((c) => c.id === f.carga.value);
        await SV.enviarProposta(d, P.op, {
          cargaId: carga ? carga.id : null, cargaRotulo: carga ? rot(carga) : '', rota: f.rota.value.trim(),
          repasse: repasse, pedagioIncluso: f.incluso.checked, pedagio: f.incluso.checked ? null : num(f.pedagio.value), pagamento: f.pagamento.value.trim()
        });
        aviso('Proposta enviada. O motorista recebe no app para aceitar, negociar ou recusar.');
      },
      (f) => {
        f.incluso.addEventListener('change', () => { $('#c-pedagio').style.display = f.incluso.checked ? 'none' : ''; });
        f.carga.addEventListener('change', () => {
          const c = P.cargas.find((x) => x.id === f.carga.value);
          if (!c) return;
          f.rota.value = c.origemCidade + '/' + c.origemUF + ' → ' + c.destinoCidade + '/' + c.destinoUF;
          if (c.valorOferecido) f.repasse.value = c.valorOferecido;
          f.incluso.checked = !!c.pedagioIncluso; $('#c-pedagio').style.display = f.incluso.checked ? 'none' : '';
        });
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
  function dlgCarga(c, faltando) {
    c = c || {};
    const ufs = SV.UFS.slice().sort();
    const sel = (nome, v) => '<select name="' + nome + '" required><option value="">UF</option>' + ufs.map((u) => '<option' + (u === v ? ' selected' : '') + '>' + u + '</option>').join('') + '</select>';
    const dt = (ms) => ms ? new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10) : '';
    const rascunho = c.status === 'rascunho';
    dialogo('<h2>' + (rascunho ? 'Revisar carga' : c.id ? 'Editar carga' : 'Nova carga') + '</h2>' +
      (!c.id && c.obs && c.obs.indexOf('Lançada por áudio: ') === 0 ? '<div class="margem" style="margin-bottom:8px">Você disse: <i>“' + esc(c.obs.slice(19)) + '”</i></div>' : '') +
      (!faltando ? '' : faltando.length ? '<div class="margem">Faltou: <b>' + esc(faltando.join(', ')) + '</b>. Preencha se souber.</div>' : '<div class="margem" style="color:var(--verde)">Entendi tudo. Confira e publique.</div>') +
      '<div class="grade2"><label class="campo"><span>Produto</span><input name="produto" value="' + esc(c.produto || '') + '" placeholder="Ex.: medicamentos"></label>' +
      '<label class="campo"><span>Cliente</span><input name="cliente" value="' + esc(c.cliente || '') + '" placeholder="Opcional"></label></div>' +
      '<div class="grade3"><label class="campo"><span>Origem</span><input name="oc" value="' + esc(c.origemCidade || '') + '" placeholder="Cidade"></label><label class="campo"><span>UF</span>' + sel('ou', c.origemUF) + '</label><label class="campo"><span>Carrega</span><input type="date" name="data" value="' + dt(c.dataCarregamento) + '"></label></div>' +
      '<div class="grade3"><label class="campo"><span>Destino</span><input name="dc" value="' + esc(c.destinoCidade || '') + '" placeholder="Cidade"></label><label class="campo"><span>UF</span>' + sel('du', c.destinoUF) + '</label><label class="campo"><span>Descarrega</span><input type="date" name="descarga" value="' + dt(c.dataDescarga) + '"></label></div>' +
      '<div class="grade3"><label class="campo"><span>Tipo de veículo</span><select name="tipo"><option value="">Qualquer</option>' + SV.VEICULOS.map((v) => '<option' + (v === c.tipoVeiculo ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label>' +
      '<label class="campo"><span>Peso (t)</span><input name="peso" inputmode="decimal" value="' + (c.pesoKg ? String(c.pesoKg / 1000).replace('.', ',') : '') + '"></label>' +
      '<label class="campo"><span>Pagamento</span><input name="pagamento" value="' + esc(c.pagamento || '') + '" placeholder="70% + 30%"></label></div>' +
      '<div class="campo"><span>Carrocerias aceitas</span>' + chipsHtml(SV.CARROCERIAS, c.carrocerias || [], true) + '<small>Nenhuma marcada = qualquer carroceria.</small></div>' +
      '<div class="grade2"><label class="campo"><span>Ano mínimo</span><input name="ano" inputmode="numeric" value="' + (c.anoMinimo || '') + '"></label>' +
      '<label class="campo"><span>Valor do frete ao motorista (R$)</span><input name="oferecido" inputmode="decimal" value="' + (c.valorOferecido || '') + '"><small>Aparece no app. Em branco = “a combinar”.</small></label></div>' +
      '<div class="grade2"><label class="interruptor" style="margin-bottom:1.1rem">Exige rastreador<input type="checkbox" name="rast"' + (c.exigeRastreador ? ' checked' : '') + '></label>' +
      '<label class="interruptor" style="margin-bottom:1.1rem">Escolta<input type="checkbox" name="escolta"' + (c.escolta ? ' checked' : '') + '></label></div>' +
      '<div class="grade2"><label class="interruptor" style="margin-bottom:1.1rem">Pedágio incluso no frete<input type="checkbox" name="incluso"' + (c.pedagioIncluso ? ' checked' : '') + '></label>' +
      '<label class="interruptor" style="margin-bottom:1.1rem">Mostrar no app<input type="checkbox" name="visivel"' + (c.visivelApp === false ? '' : ' checked') + '></label></div>' +
      '<label class="campo"><span>Observação para o motorista</span><input name="obsMot" value="' + esc(c.obsMotorista || '') + '" placeholder="Ex.: carga paletizada, descarga com agendamento"><small>Aparece no app do motorista.</small></label>' +
      '<label class="campo"><span>Observações internas</span><textarea name="obs">' + esc(c.obs || '') + '</textarea><small>Só a equipe vê.</small></label>' + rodape(rascunho ? 'Publicar carga' : 'Salvar carga'),
      async (f) => {
        if (!f.ou.value || !f.du.value) throw new Error('Escolha a UF de origem e a de destino.');
        const ontem = Date.now() - 86400000, anoAtual = new Date().getFullYear();
        const confere = (campo, rot) => {
          if (!f[campo].value) return;
          const d = new Date(f[campo].value + 'T08:00');
          if (d.getFullYear() < anoAtual - 1 || d.getFullYear() > anoAtual + 1) throw new Error('A data de ' + rot + ' está com o ano ' + d.getFullYear() + '. Digite a data com o ano certo.');
          if (campo === 'data' && d.getTime() < ontem && !confirm('A data de carregamento já passou. Cargas com data no passado não aparecem para os motoristas. Salvar assim mesmo?')) throw new Error('Ajuste a data de carregamento.');
        };
        confere('data', 'carregamento'); confere('descarga', 'descarga');
        if (f.data.value && f.descarga.value && f.descarga.value < f.data.value) throw new Error('A descarga está antes do carregamento.');
        const salva = await SV.salvarCarga(Object.assign({}, c, {
          status: rascunho || !c.status ? 'aberta' : c.status,
          produto: f.produto.value.trim(), tipoVeiculo: f.tipo.value, pagamento: f.pagamento.value.trim(),
          cliente: f.cliente.value.trim(), origemCidade: f.oc.value.trim(), origemUF: f.ou.value, destinoCidade: f.dc.value.trim(), destinoUF: f.du.value,
          dataCarregamento: f.data.value ? new Date(f.data.value + 'T08:00').getTime() : null,
          dataDescarga: f.descarga.value ? new Date(f.descarga.value + 'T08:00').getTime() : null,
          pesoKg: num(f.peso.value) ? Math.round(num(f.peso.value) * 1000) : null,
          carrocerias: chipsLidos($('.chips', f)), anoMinimo: parseInt(f.ano.value, 10) || null,
          valorOferecido: num(f.oferecido.value), pedagioIncluso: f.incluso.checked, visivelApp: f.visivel.checked, obsMotorista: f.obsMot.value.trim(),
          exigeRastreador: f.rast.checked, escolta: f.escolta.checked, obs: f.obs.value.trim()
        }));
        P.selCarga = salva.id;
        atualizar();
        aviso(rascunho ? 'Carga publicada. Já aparece no app dos motoristas.' : 'Carga salva.');
      });
  }

  /* ---------- bloquear e excluir motorista ---------- */
  function dlgBloquear(m) {
    dialogo('<h2>Bloquear ' + esc((m.nome || 'motorista').split(' ')[0]) + '</h2>' +
      '<p class="sub">O motorista perde o acesso ao app na hora, sai da fila e o número ' + esc(U.telefone(m.telefone)) + ' não consegue se cadastrar de novo. Dá para desbloquear depois.</p>' +
      '<label class="campo"><span>Motivo</span><input name="motivo" placeholder="Ex.: não compareceu ao carregamento"><small>Só a equipe vê.</small></label>' + rodape('Bloquear motorista'),
      async (f) => { await SV.bloquearMotorista(m, P.op, f.motivo.value.trim()); aviso((m.nome || 'Motorista') + ' bloqueado.'); });
  }
  function dlgExcluir(m) {
    dialogo('<h2>Excluir ' + esc(m.nome || 'motorista') + '</h2>' +
      '<p class="sub">Apaga o cadastro, os veículos, os avisos e o histórico de atendimento deste motorista. Não dá para desfazer.</p>' +
      '<label class="interruptor" style="margin-bottom:12px">Também bloquear o número ' + esc(U.telefone(m.telefone)) + '<input type="checkbox" name="bloq"></label>' +
      '<label class="campo"><span>Motivo do bloqueio</span><input name="motivo" placeholder="Opcional"></label>' +
      '<label class="interruptor" style="margin-bottom:16px">Entendo que os dados serão apagados<input type="checkbox" name="ok"></label>' + rodape('Excluir motorista'),
      async (f) => {
        if (!f.ok.checked) throw new Error('Confirme que entende que os dados serão apagados.');
        await SV.excluirMotorista(m, P.op, f.bloq.checked, f.motivo.value.trim());
        aviso((m.nome || 'Motorista') + ' excluído' + (f.bloq.checked ? ' e bloqueado.' : '.'));
      });
  }

  /* ---------- lançar carga por áudio ou mensagem colada ---------- */
  function dlgVoz() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let rec = null, ouvindo = false, base = '', ultimo = null, parar = () => {};
    dialogo('<h2>Lançar carga por áudio</h2>' +
      '<p class="sub" style="margin-bottom:14px">Toque no microfone e fale a carga, ou cole aqui a mensagem do WhatsApp.</p>' +
      '<button type="button" class="voz-mic" id="voz-mic"><span class="voz-bola">' + IC.mic + '</span><span><b id="voz-rot">' + (SR ? 'Toque para falar' : 'Use o microfone do teclado') + '</b>' +
        '<small id="voz-dica">' + (SR ? 'Fale com calma. Toque de novo para parar.' : 'Este navegador não transcreve sozinho: toque no campo abaixo e use o microfone do teclado do celular.') + '</small></span></button>' +
      '<label class="campo" style="margin-top:14px"><span class="sr">Texto da carga</span><textarea name="texto" rows="6" placeholder="Ex.: carga de medicamentos do Rio para Contagem, carreta baú ano 2010 pra cima, até 15 toneladas, carrega sábado, descarrega domingo, 4.500 mais pedágio, pagamento 70 e 30, rastreado e com escolta."></textarea></label>' +
      '<div id="voz-prev" class="voz-prev"></div>' +
      '<div class="rodape"><button type="button" class="btn" data-fechar>Voltar</button><button type="button" class="btn" id="voz-rasc">Salvar rascunho</button><button type="submit" class="btn btn-primario">Revisar e publicar</button></div>',
      async (f) => {
        parar();
        if (!ultimo || !f.texto.value.trim()) throw new Error('Fale ou cole a carga primeiro.');
        const r = ultimo;
        setTimeout(() => dlgCarga(Object.assign({ visivelApp: true }, r.campos, { obs: 'Lançada por áudio: ' + r.texto }), r.faltando), 0);
      },
      (f) => {
        const prev = $('#voz-prev'), mic = $('#voz-mic');
        const interpretar = () => {
          const txt = f.texto.value.trim();
          if (!txt) { prev.innerHTML = ''; ultimo = null; return; }
          ultimo = LeitorCarga.ler(txt);
          const itens = LeitorCarga.resumo(ultimo.campos);
          prev.innerHTML = (itens.length ? itens.map((x) => '<span class="voz-chip">' + esc(x) + '</span>').join('') : '<span class="miudo">Ainda não reconheci nenhum campo.</span>') +
            (ultimo.faltando.length ? '<div class="miudo" style="width:100%;margin-top:6px">Faltou: ' + esc(ultimo.faltando.join(', ')) + '</div>' : '<div class="miudo" style="width:100%;margin-top:6px;color:var(--verde)">Tudo reconhecido.</div>');
        };
        f.texto.addEventListener('input', interpretar);
        parar = () => { ouvindo = false; if (rec) { try { rec.stop(); } catch (e) { /* já parou */ } } mic.classList.remove('ouvindo'); $('#voz-rot').textContent = 'Toque para falar'; };
        mic.addEventListener('click', () => {
          if (!SR) { f.texto.focus(); return; }
          if (ouvindo) return parar();
          rec = new SR();
          rec.lang = 'pt-BR'; rec.continuous = true; rec.interimResults = true;
          base = f.texto.value ? f.texto.value.trim() + ' ' : '';
          rec.onresult = (e) => {
            let fim = '', parcial = '';
            for (let i = 0; i < e.results.length; i++) { if (e.results[i].isFinal) fim += e.results[i][0].transcript + ' '; else parcial += e.results[i][0].transcript; }
            f.texto.value = (base + fim + parcial).replace(/\s+/g, ' ');
            interpretar();
          };
          rec.onerror = (e) => { aviso(e.error === 'not-allowed' ? 'Libere o microfone para transcrever.' : 'A transcrição parou. Toque de novo para continuar.', true); parar(); };
          rec.onend = () => { if (ouvindo) parar(); };
          try { rec.start(); ouvindo = true; mic.classList.add('ouvindo'); $('#voz-rot').textContent = 'Ouvindo… toque para parar'; }
          catch (e) { aviso('Não foi possível usar o microfone.', true); }
        });
        $('#voz-rasc').addEventListener('click', async () => {
          parar();
          if (!ultimo) return aviso('Fale ou cole a carga primeiro.', true);
          try {
            const salva = await SV.salvarCarga(Object.assign({ visivelApp: true }, ultimo.campos, { status: 'rascunho', obs: 'Lançada por áudio: ' + ultimo.texto }));
            P.selCarga = salva.id; $('#dlg').close(); atualizar();
            aviso('Rascunho salvo. Revise e publique quando puder.');
          } catch (err) { aviso(err.message, true); }
        });
        $('#dlg').addEventListener('close', () => parar(), { once: true });
      });
  }

  /* ---------- exportação ---------- */
  function exportar() {
    const cab = ['Criado em', 'Motorista', 'Telefone', 'Bairro', 'Cidade', 'UF', 'Veículo', 'Carroceria', 'Capacidade (t)', 'Placa', 'Destinos', 'Aceita outras', 'Situação', 'Responsável', '1º contato (min)', 'Frete ao motorista', 'Pedágio incluso', 'Pedágio à parte', 'Pagamento', 'Motorista pediu', 'Resposta no app', 'Motivos de recusa'];
    const dt = (ms) => ms ? new Date(ms).toLocaleString('pt-BR') : '';
    const linhas = P.fila.slice().sort((a, b) => a.criadoEm - b.criadoEm).map((d) => {
      const v = d.veiculo || {}, a = P.atend[d.id] || {}, n = a.negociacao || {};
      return [dt(d.criadoEm), d.motoristaNome, U.telefone(d.telefone), d.bairro || '', d.cidade, d.uf, v.tipo, v.carroceria, v.capacidadeKg ? v.capacidadeKg / 1000 : '', v.placa,
        (d.destinos || []).join(' '), d.aceitaOutras ? 'sim' : 'não', SV.STATUS[SV.statusEfetivo(d)].rotulo, d.responsavelNome || '',
        d.assumidoEm ? Math.round((d.assumidoEm - d.criadoEm) / 60000) : '', n.repasse || '', n.repasse ? (n.pedagioIncluso ? 'sim' : 'não') : '', n.pedagio || '', n.pagamento || '',
        d.contraproposta ? d.contraproposta.valor : '', d.respostaMotorista ? (d.respostaMotorista.aceita ? 'aceitou' : 'recusou: ' + d.respostaMotorista.motivo) : '',
        (a.recusas || []).map((r) => r.motivo).concat(d.respostaMotorista && !d.respostaMotorista.aceita ? [d.respostaMotorista.motivo] : []).join(', ')];
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
    const adm = e.target.closest('[data-adm]');
    if (adm) { P.adm = adm.dataset.adm; return desenharAdmin(); }
    const ur = e.target.closest('[data-usr-reset]');
    if (ur) {
      const u = P.usuarios.find((x) => x.id === ur.dataset.usrReset);
      if (u && confirm('Enviar e-mail de redefinição de senha para ' + u.email + '?')) {
        try { await SV.redefinirSenha(u.email); aviso(SV.modo === 'demo' ? 'No modo demonstração não há e-mail.' : 'E-mail de redefinição enviado para ' + u.email + '.'); } catch (err) { aviso(err.message, true); }
      }
      return;
    }
    const ua = e.target.closest('[data-usr-ativo]');
    if (ua) {
      const u = P.usuarios.find((x) => x.id === ua.dataset.usrAtivo);
      const desativar = u && u.ativo !== false;
      if (u && confirm((desativar ? 'Desativar ' : 'Reativar ') + u.nome + '?' + (desativar ? ' A pessoa perde o acesso à central na hora.' : ''))) {
        try { await SV.atualizarUsuario(u.id, { ativo: !desativar }); aviso(u.nome + (desativar ? ' desativado.' : ' reativado.')); } catch (err) { aviso(err.message, true); }
      }
      return;
    }
    const mb = e.target.closest('[data-mot-bloq]');
    if (mb) { const m = P.motoristas.find((x) => x.id === mb.dataset.motBloq); if (m) dlgBloquear(m); return; }
    const me = e.target.closest('[data-mot-excluir]');
    if (me) { const m = P.motoristas.find((x) => x.id === me.dataset.motExcluir); if (m) dlgExcluir(m); return; }
    const md = e.target.closest('[data-mot-desbloq]');
    if (md) {
      const m = P.motoristas.find((x) => x.id === md.dataset.motDesbloq);
      if (m && confirm('Desbloquear ' + (m.nome || 'este motorista') + '?' + (m.excluidoEm ? ' Como o cadastro foi excluído, ele poderá se cadastrar de novo.' : ''))) {
        try { await SV.desbloquearMotorista(m); aviso('Motorista desbloqueado.'); } catch (err) { aviso(err.message, true); }
      }
      return;
    }
    const td = e.target.closest('[data-tel-desbloq]');
    if (td) {
      const b = P.bloqueios.find((x) => x.id === td.dataset.telDesbloq);
      if (b && confirm('Desbloquear o número ' + U.telefone(b.telefone) + '?')) {
        const m = P.motoristas.find((x) => x.id === b.motoristaId) || { id: null, telefone: b.telefone };
        try { await SV.desbloquearMotorista(m); aviso('Número desbloqueado.'); } catch (err) { aviso(err.message, true); }
      }
      return;
    }
    const nav = e.target.closest('[data-aba]');
    if (nav) return trocarAba(nav.dataset.aba);
    const s = e.target.closest('[data-sel]');
    if (s) { P.sel = s.dataset.sel; desenharLista(); desenharDetalhe(); $('#detalhe').scrollTop = 0; return; }
    const ca = e.target.closest('[data-carga]');
    if (ca) { P.selCarga = ca.dataset.carga; desenharCargas(); desenharDetalheCarga(); return; }
    const ab = e.target.closest('[data-abrir]');
    if (ab) { P.sel = ab.dataset.abrir; P.f.grupo = 'ativos'; return trocarAba('fila'); }
    const ic = e.target.closest('[data-int-contato]');
    if (ic) { const i = P.interesses.find((x) => x.id === ic.dataset.intContato); if (i && i.status === 'novo') SV.marcarInteresse(i, 'contatado', P.op).catch(() => {}); return; }
    const idesc = e.target.closest('[data-int-descartar]');
    if (idesc) { const i = P.interesses.find((x) => x.id === idesc.dataset.intDescartar); if (i) SV.marcarInteresse(i, 'descartado', P.op).catch((err) => aviso(err.message, true)); return; }
    const zap = e.target.closest('[data-contato]');
    const d = P.fila.find((x) => x.id === P.sel);
    if (zap && d) { SV.anotar(d, 'Contato por ' + zap.dataset.contato, P.op).catch(() => {}); return; }
    const b = e.target.closest('[data-acao]');
    if (!b) return;
    const acao = b.dataset.acao;
    try {
      if (acao === 'sair') { clearInterval(P.tPresenca); P.parar.forEach((f) => f()); await SV.sairOperador(); P.op = null; return telaLogin(); }
      if (acao === 'semear') { await SV.semearDemo(); return aviso('Dados de exemplo criados.'); }
      if (acao === 'limpar') { if (confirm('Apagar todos os dados de demonstração deste navegador?')) { SV.limparDemo(); P.sel = null; aviso('Demonstração limpa.'); } return; }
      if (acao === 'exportar') return exportar();
      if (acao === 'nova-carga') return dlgCarga();
      if (acao === 'carga-voz') return dlgVoz();
      if (acao === 'novo-usuario') return dlgUsuario();
      if (acao === 'editar-carga') return dlgCarga(P.cargas.find((c) => c.id === P.selCarga));
      if (acao === 'cancelar-carga') {
        const c = P.cargas.find((x) => x.id === P.selCarga);
        if (c && confirm('Cancelar esta carga?')) await SV.salvarCarga(Object.assign({}, c, { status: 'cancelada' }));
        return;
      }
      if (!d) return;
      if (acao === 'assumir') { await SV.assumir(d, P.op); return aviso('Atendimento é seu. Ligue ou chame no WhatsApp.'); }
      if (acao === 'transferir') { if (confirm('Transferir o atendimento de ' + d.responsavelNome + ' para você?')) { await SV.assumir(d, P.op, true); aviso('Atendimento transferido para você.'); } return; }
      if (acao === 'bloquear-disp') return dlgBloquear({ id: d.motoristaId, nome: d.motoristaNome, telefone: d.telefone });
      if (acao === 'proposta') return dlgProposta(d);
      if (acao === 'aceitar-contra') { if (confirm('Aceitar ' + U.moeda((d.contraproposta || {}).valor) + ' pedido pelo motorista?')) { await SV.aceitarContraproposta(d, P.op); aviso('Valor aceito. Falta a aprovação documental.'); } return; }
      if (acao === 'recusou') return dlgRecusa(d);
      if (acao === 'fechar') return dlgFechar(d);
      if (acao === 'aceitou') { await SV.mudarStatus(d, 'aguardando_aprovacao', P.op, 'Motorista aceitou a proposta'); return aviso('Aceite registrado. Falta a aprovação documental.'); }
      if (acao === 'carregado') { await SV.mudarStatus(d, 'carregado', P.op, 'Carregamento registrado'); return aviso('Carregamento registrado. Disponibilidade encerrada.'); }
      if (acao === 'sem-carga') return dlgMotivo(d, 'sem_carga', 'Sem carga encontrada', 'Encerrar e avisar');
      if (acao === 'cancelar') return dlgMotivo(d, 'cancelado', 'Cancelar atendimento', 'Cancelar pedido');
    } catch (err) { aviso(err.message || 'Não foi possível concluir.', true); }
  });

  raiz.addEventListener('change', async (e) => {
    const sel = e.target.closest('[data-usr-papel]');
    if (!sel) return;
    const u = P.usuarios.find((x) => x.id === sel.dataset.usrPapel);
    if (!u) return;
    if (!confirm('Mudar ' + u.nome + ' para ' + SV.PAPEIS[sel.value] + '?')) { sel.value = u.papel; return; }
    try { await SV.atualizarUsuario(u.id, { papel: sel.value }); aviso('Função atualizada.'); } catch (err) { sel.value = u.papel; aviso(err.message, true); }
  });
  raiz.addEventListener('input', (e) => { if (e.target.id === 'adm-busca') { P.buscaMot = e.target.value; desenharAdmin(); } });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-copiar-cred]')) return;
    const t = $('#cred').innerText;
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => aviso('Dados copiados.')).catch(() => aviso('Selecione o texto e copie.'));
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
