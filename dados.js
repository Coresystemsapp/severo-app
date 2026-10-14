/*
 * Severo · camada de dados
 * Uma única API (window.SV) com dois motores:
 *  - demo: localStorage + BroadcastChannel (app e painel conversam entre abas)
 *  - firebase: Auth + Firestore + Storage (SDK compat via CDN)
 *
 * Coleções
 *  motoristas/{uid}          nome, telefone, cadastro
 *  veiculos/{id}             motoristaId, tipo, carroceria, capacidadeKg, placa, ano, rastreador
 *  disponibilidades/{id}     o pedido "estou vazio" (o motorista lê o próprio)
 *  atendimentos/{dispId}     dados internos: notas, negociação, valores (só equipe)
 *  cargas/{id}               demandas de clientes (só equipe)
 *  usuarios/{uid}            equipe da central: nome, papel (operador|gestao|financeiro)
 */
(function () {
  'use strict';

  const cfg = window.SEVERO_CONFIG || {};
  const DEMO = !(cfg.firebase && cfg.firebase.apiKey);
  const VALIDADE_H = cfg.validadeHoras || 12;
  const VALIDADE_MS = VALIDADE_H * 3600 * 1000;
  const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';

  /* ---------- vocabulário do negócio ---------- */
  const STATUS = {
    disponivel:           { rotulo: 'Disponível',            motorista: 'Aguardando atendimento',  passo: 'A Severo vai entrar em contato com você.', tom: 'azul' },
    em_atendimento:       { rotulo: 'Em atendimento',        motorista: 'Buscando sua carga',      passo: 'Um operador da Severo está procurando carga para a sua rota.', tom: 'laranja' },
    proposta_enviada:     { rotulo: 'Proposta enviada',      motorista: 'Você recebeu uma proposta', passo: 'O operador te passou rota, valor e pagamento. Responda a ele por telefone ou WhatsApp.', tom: 'laranja' },
    aguardando_aprovacao: { rotulo: 'Aguardando aprovação',  motorista: 'Proposta aceita',         passo: 'Estamos conferindo documentos e aprovando a operação.', tom: 'amarelo' },
    carga_fechada:        { rotulo: 'Carga fechada',         motorista: 'Carga fechada',           passo: 'Siga as orientações do operador para o carregamento.', tom: 'verde' },
    carregado:            { rotulo: 'Carregado',             motorista: 'Carregado',               passo: 'Boa viagem. Quando ficar vazio de novo, avise a Severo.', tom: 'verde' },
    sem_carga:            { rotulo: 'Sem carga encontrada',  motorista: 'Sem carga desta vez',     passo: 'Não encontramos carga para essa rota agora. Avise de novo quando quiser.', tom: 'cinza' },
    cancelado:            { rotulo: 'Cancelado',             motorista: 'Pedido cancelado',        passo: 'Quando ficar vazio de novo, é só avisar.', tom: 'cinza' },
    vencida:              { rotulo: 'Vencida',               motorista: 'Aviso vencido',           passo: 'Seu aviso passou de ' + VALIDADE_H + ' horas. Confirme se ainda está vazio.', tom: 'cinza' }
  };
  const ATIVOS = ['disponivel', 'em_atendimento', 'proposta_enviada', 'aguardando_aprovacao'];
  const EM_OPERACAO = ['carga_fechada', 'carregado'];
  const MOTIVOS_RECUSA = ['Valor', 'Rota', 'Horário', 'Perfil do veículo', 'Outro'];
  const VEICULOS = ['Carreta', 'Carreta LS', 'Bitrem', 'Rodotrem', 'Truck', 'Bitruck', 'Toco', '3/4', 'VUC'];
  const CARROCERIAS = ['Baú', 'Sider', 'Graneleiro', 'Grade baixa', 'Refrigerado', 'Prancha', 'Caçamba', 'Porta-contêiner', 'Tanque'];
  const UFS = ['RJ', 'SP', 'MG', 'ES', 'PR', 'SC', 'RS', 'BA', 'GO', 'DF', 'MS', 'MT', 'TO', 'SE', 'AL', 'PE', 'PB', 'RN', 'CE', 'PI', 'MA', 'PA', 'AP', 'AM', 'RR', 'RO', 'AC'];

  /* ---------- utilidades ---------- */
  const agora = () => Date.now();
  const novoId = () => agora().toString(36) + Math.random().toString(36).slice(2, 9);
  const soDigitos = (s) => String(s || '').replace(/\D/g, '');
  const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const evento = (texto, por, tipo) => ({ em: agora(), texto: texto, tipo: tipo || 'status', por: por ? { id: por.id, nome: por.nome } : null });
  const vencida = (d) => ATIVOS.includes(d.status) && !!d.expiraEm && agora() > d.expiraEm;
  const statusEfetivo = (d) => (vencida(d) ? 'vencida' : d.status);

  const util = {
    esc, norm, soDigitos, novoId,
    desde(ms) {
      if (!ms) return '';
      const s = Math.max(0, (agora() - ms) / 1000);
      if (s < 60) return 'agora';
      if (s < 3600) return 'há ' + Math.floor(s / 60) + ' min';
      if (s < 86400) return 'há ' + Math.floor(s / 3600) + ' h';
      const d = Math.floor(s / 86400);
      return 'há ' + d + (d === 1 ? ' dia' : ' dias');
    },
    ate(ms) {
      const s = (ms - agora()) / 1000;
      if (s <= 0) return 'vencido';
      if (s < 3600) return 'em ' + Math.ceil(s / 60) + ' min';
      return 'em ' + Math.floor(s / 3600) + ' h';
    },
    toneladas(kg) {
      if (!kg && kg !== 0) return '—';
      return (kg / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' t';
    },
    moeda(v) {
      if (v == null || v === '' || isNaN(v)) return '—';
      return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    },
    telefone(t) {
      const d = soDigitos(t).replace(/^55(?=\d{10,11}$)/, '');
      if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
      if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
      return t || '';
    },
    whats(t) {
      const d = soDigitos(t);
      return d.length <= 11 ? '55' + d : d;
    },
    quando(q) {
      if (!q) return '—';
      if (q.tipo === 'agora') return 'Agora';
      const dt = new Date(q.em);
      const hora = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      if (q.tipo === 'hoje') return 'Hoje' + (q.comHora ? ', ' + hora : '');
      if (q.tipo === 'amanha') return 'Amanhã' + (q.comHora ? ', ' + hora : '');
      return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ', ' + hora;
    },
    hojeInicio() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
  };

  function paraDataUrl(blob) {
    return new Promise((ok, erro) => {
      const r = new FileReader();
      r.onload = () => ok(r.result);
      r.onerror = () => erro(new Error('Não foi possível ler o áudio.'));
      r.readAsDataURL(blob);
    });
  }

  function carregarScript(src) {
    return new Promise((ok, erro) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = ok;
      s.onerror = () => erro(new Error('Sem conexão para carregar ' + src));
      document.head.appendChild(s);
    });
  }

  /* ---------- motor demo ---------- */
  function motorDemo() {
    const P = 'sv_';
    const ouvintes = {};
    const bc = 'BroadcastChannel' in window ? new BroadcastChannel('severo-demo') : null;
    const ler = (c) => { try { return JSON.parse(localStorage.getItem(P + c)) || {}; } catch (e) { return {}; } };
    const avisar = (c) => (ouvintes[c] || []).forEach((fn) => fn());
    const escrever = (c, t) => {
      try { localStorage.setItem(P + c, JSON.stringify(t)); }
      catch (e) { throw new Error('O armazenamento do navegador encheu. Use "Limpar demonstração" no painel.'); }
      if (bc) bc.postMessage(c);
      avisar(c);
    };
    if (bc) bc.onmessage = (e) => avisar(e.data);
    window.addEventListener('storage', (e) => { if (e.key && e.key.indexOf(P) === 0) avisar(e.key.slice(P.length)); });

    return {
      async obter(c, id) { return ler(c)[id] || null; },
      async listar(c, filtro) {
        const l = Object.values(ler(c));
        return filtro ? l.filter((x) => x[filtro[0]] === filtro[1]) : l;
      },
      async gravar(c, id, dados) {
        const t = ler(c);
        t[id] = Object.assign({}, t[id], dados, { id: id });
        escrever(c, t);
        return t[id];
      },
      async atualizarCom(c, id, fn) {
        const t = ler(c);
        const atual = t[id];
        if (!atual) throw new Error('Registro não encontrado.');
        const patch = fn(Object.assign({}, atual));
        t[id] = Object.assign({}, atual, patch);
        escrever(c, t);
        return t[id];
      },
      observar(c, filtro, cb) {
        const fn = () => {
          let l = Object.values(ler(c));
          if (filtro) l = l.filter((x) => x[filtro[0]] === filtro[1]);
          cb(l);
        };
        (ouvintes[c] = ouvintes[c] || []).push(fn);
        setTimeout(fn, 0);
        return () => { ouvintes[c] = ouvintes[c].filter((f) => f !== fn); };
      },
      async enviarArquivo(caminho, blob) { return paraDataUrl(blob); },
      async motoristaId(criar) {
        let id = localStorage.getItem(P + 'eu');
        if (!id && criar) { id = novoId(); localStorage.setItem(P + 'eu', id); }
        return id;
      },
      async sairMotorista() { localStorage.removeItem(P + 'eu'); },
      async entrarOperador(email, senha, extra) {
        const op = { id: 'op-' + norm(extra.nome).replace(/\W+/g, '-'), nome: extra.nome, email: email, papel: extra.papel || 'operador' };
        localStorage.setItem(P + 'op', JSON.stringify(op));
        return op;
      },
      async operadorAtual() { try { return JSON.parse(localStorage.getItem(P + 'op')); } catch (e) { return null; } },
      async sairOperador() { localStorage.removeItem(P + 'op'); },
      limparTudo() {
        Object.keys(localStorage).filter((k) => k.indexOf(P) === 0 && k !== P + 'op').forEach((k) => localStorage.removeItem(k));
        ['motoristas', 'veiculos', 'disponibilidades', 'atendimentos', 'cargas'].forEach((c) => { if (bc) bc.postMessage(c); avisar(c); });
      }
    };
  }

  /* ---------- motor Firebase ---------- */
  async function motorFirebase(nomeApp) {
    const sdks = ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js'];
    if (cfg.usarStorage) sdks.push('firebase-storage-compat.js');
    for (const f of sdks) await carregarScript(FB + f);
    // apps com nomes diferentes = sessões separadas para motorista e painel no mesmo navegador
    const app = firebase.initializeApp(cfg.firebase, nomeApp);
    const auth = app.auth();
    const db = app.firestore();
    const st = cfg.usarStorage ? app.storage() : null;
    try { await db.enablePersistence({ synchronizeTabs: true }); } catch (e) { /* outra aba já habilitou */ }
    await new Promise((ok) => { const parar = auth.onAuthStateChanged(() => { parar(); ok(); }); });

    const col = (c) => db.collection(c);
    const motor = {
      async obter(c, id) {
        const s = await col(c).doc(id).get();
        return s.exists ? Object.assign({ id: s.id }, s.data()) : null;
      },
      async listar(c, filtro) {
        let q = col(c);
        if (filtro) q = q.where(filtro[0], '==', filtro[1]);
        const s = await q.get();
        return s.docs.map((d) => Object.assign({ id: d.id }, d.data()));
      },
      async gravar(c, id, dados) {
        const doc = Object.assign({}, dados, { id: id });
        await col(c).doc(id).set(doc, { merge: true });
        return doc;
      },
      async atualizarCom(c, id, fn) {
        return db.runTransaction(async (tx) => {
          const ref = col(c).doc(id);
          const s = await tx.get(ref);
          if (!s.exists) throw new Error('Registro não encontrado.');
          const atual = Object.assign({ id: s.id }, s.data());
          const patch = fn(Object.assign({}, atual));
          tx.update(ref, patch);
          return Object.assign(atual, patch);
        });
      },
      observar(c, filtro, cb) {
        let q = col(c);
        if (filtro) q = q.where(filtro[0], '==', filtro[1]);
        return q.onSnapshot(
          (snap) => cb(snap.docs.map((d) => Object.assign({ id: d.id }, d.data()))),
          (e) => console.error('[Severo] leitura de ' + c, e)
        );
      },
      async enviarArquivo(caminho, blob, meta) {
        if (st) {
          const ref = st.ref(caminho);
          await ref.put(blob, { contentType: blob.type || 'audio/webm' });
          return ref.getDownloadURL();
        }
        // plano gratuito: áudio vai como texto para a coleção "audios" (limite de 1 MB por documento)
        const dados = await paraDataUrl(blob);
        if (dados.length > 900000) throw new Error('Áudio muito longo. Grave até 1 minuto.');
        await col('audios').doc(meta.dispId).set({ motoristaId: meta.motoristaId, dados: dados, tipo: blob.type || '', em: agora() });
        return 'fs:' + meta.dispId;
      },
      async motoristaId(criar) {
        if (auth.currentUser) return auth.currentUser.uid;
        if (!criar) return null;
        const c = await auth.signInAnonymously();
        return c.user.uid;
      },
      async sairMotorista() { await auth.signOut(); },
      async entrarOperador(email, senha) {
        const c = await auth.signInWithEmailAndPassword(email, senha);
        const u = await motor.obter('usuarios', c.user.uid);
        if (!u || !u.papel) {
          await auth.signOut();
          throw new Error('Este usuário não tem acesso à central. Peça para a gestão liberar.');
        }
        return Object.assign({}, u, { id: c.user.uid });
      },
      async operadorAtual() {
        const u = auth.currentUser;
        if (!u || u.isAnonymous) return null;
        const d = await motor.obter('usuarios', u.uid);
        return d && d.papel ? Object.assign({}, d, { id: u.uid }) : null;
      },
      async sairOperador() { await auth.signOut(); }
    };
    return motor;
  }

  /* ---------- API pública ---------- */
  let M = null;
  const SV = {
    modo: DEMO ? 'demo' : 'firebase',
    STATUS, ATIVOS, EM_OPERACAO, MOTIVOS_RECUSA, VEICULOS, CARROCERIAS, UFS,
    validadeHoras: VALIDADE_H,
    util, vencida, statusEfetivo,

    async iniciar(nomeApp) {
      M = DEMO ? motorDemo() : await motorFirebase(nomeApp || 'motorista');
      return SV;
    },

    /* ----- motorista ----- */
    async eu() {
      const id = await M.motoristaId(false);
      return id ? M.obter('motoristas', id) : null;
    },
    async cadastrar(dados) {
      const id = await M.motoristaId(true);
      return M.gravar('motoristas', id, {
        nome: dados.nome.trim(), telefone: soDigitos(dados.telefone), criadoEm: agora(), cadastro: 'pendente'
      });
    },
    sairMotorista() { return M.sairMotorista(); },
    salvarVeiculo(v) {
      const id = v.id || novoId();
      return M.gravar('veiculos', id, Object.assign({}, v, { atualizadoEm: agora() }));
    },
    observarVeiculos(motoristaId, cb) { return M.observar('veiculos', ['motoristaId', motoristaId], cb); },
    observarMeusPedidos(motoristaId, cb) {
      return M.observar('disponibilidades', ['motoristaId', motoristaId], (l) => cb(l.sort((a, b) => (b.atualizadoEm || 0) - (a.atualizadoEm || 0))));
    },

    /** Cria ou atualiza o aviso "estou vazio". Uma disponibilidade ativa por veículo. */
    async enviarPedido(p) {
      const meus = await M.listar('disponibilidades', ['motoristaId', p.motorista.id]);
      const ativo = meus.find((d) => d.veiculoId === p.veiculo.id && ATIVOS.includes(d.status));
      const id = ativo ? ativo.id : (p.id || novoId());
      let audioUrl = ativo ? (ativo.audioUrl || null) : null;
      if (p.audio) {
        const ext = /mp4|aac/.test(p.audio.type) ? 'm4a' : /ogg/.test(p.audio.type) ? 'ogg' : 'webm';
        audioUrl = await M.enviarArquivo('audios/' + p.motorista.id + '/' + id + '-' + agora() + '.' + ext, p.audio, { motoristaId: p.motorista.id, dispId: id });
      }
      const v = p.veiculo;
      const base = {
        motoristaId: p.motorista.id,
        motoristaNome: p.motorista.nome,
        telefone: p.motorista.telefone,
        veiculoId: v.id,
        veiculo: { tipo: v.tipo, carroceria: v.carroceria, capacidadeKg: v.capacidadeKg || null, placa: v.placa || '', ano: v.ano || null, rastreador: !!v.rastreador },
        cidade: p.cidade || '', uf: p.uf || '',
        lat: p.lat == null ? null : p.lat, lng: p.lng == null ? null : p.lng,
        localEm: agora(),
        quando: p.quando,
        ocupacao: p.ocupacao,
        capacidadeLivreKg: p.ocupacao === 'parcial' ? (p.capacidadeLivreKg || null) : null,
        destinos: (p.destinos || []).slice(0, 3),
        aceitaOutras: !!p.aceitaOutras,
        obs: p.obs || '',
        audioUrl: audioUrl,
        expiraEm: agora() + VALIDADE_MS,
        atualizadoEm: agora()
      };
      if (ativo) {
        await M.atualizarCom('disponibilidades', id, (d) =>
          Object.assign(base, { historico: (d.historico || []).concat(evento('Motorista atualizou o pedido', null, 'motorista')) }));
      } else {
        await M.gravar('disponibilidades', id, Object.assign(base, {
          status: 'disponivel', criadoEm: agora(), responsavelId: null, responsavelNome: null,
          historico: [evento('Pedido enviado pelo motorista', null, 'motorista')]
        }));
      }
      return id;
    },
    renovar(d) {
      return M.atualizarCom('disponibilidades', d.id, (x) => ({
        expiraEm: agora() + VALIDADE_MS, atualizadoEm: agora(),
        historico: (x.historico || []).concat(evento('Motorista confirmou que segue disponível', null, 'motorista'))
      }));
    },
    cancelarPeloMotorista(d) {
      return M.atualizarCom('disponibilidades', d.id, (x) => ({
        status: 'cancelado', atualizadoEm: agora(),
        historico: (x.historico || []).concat(evento('Motorista cancelou o pedido', null, 'motorista'))
      }));
    },

    /** Endereço tocável do áudio (busca no Firestore quando salvo sem Storage). */
    async audio(url) {
      if (!url || url.indexOf('fs:') !== 0) return url;
      const a = await M.obter('audios', url.slice(3));
      return a ? a.dados : null;
    },

    /* ----- central ----- */
    entrarOperador(email, senha, extra) { return M.entrarOperador(email, senha, extra || {}); },
    operadorAtual() { return M.operadorAtual(); },
    sairOperador() { return M.sairOperador(); },
    observarFila(cb) { return M.observar('disponibilidades', null, cb); },
    observarAtendimentos(cb) { return M.observar('atendimentos', null, cb); },
    observarCargas(cb) { return M.observar('cargas', null, cb); },

    /** Assumir é transacional: dois operadores não ficam com o mesmo pedido. */
    assumir(d, op, transferir) {
      return M.atualizarCom('disponibilidades', d.id, (x) => {
        if (x.responsavelId && x.responsavelId !== op.id && !transferir) {
          throw new Error(x.responsavelNome + ' já assumiu este pedido.');
        }
        const texto = x.responsavelId && x.responsavelId !== op.id
          ? 'Atendimento transferido de ' + x.responsavelNome + ' para ' + op.nome
          : 'Atendimento assumido por ' + op.nome;
        const patch = { responsavelId: op.id, responsavelNome: op.nome, atualizadoEm: agora(), historico: (x.historico || []).concat(evento(texto, op, 'sistema')) };
        if (x.status === 'disponivel') { patch.status = 'em_atendimento'; patch.assumidoEm = agora(); }
        return patch;
      });
    },
    async mudarStatus(d, status, op, texto) {
      return M.atualizarCom('disponibilidades', d.id, (x) => {
        if (!x.responsavelId) throw new Error('Assuma o pedido antes de mudar a situação.');
        if (x.responsavelId !== op.id && op.papel !== 'gestao') throw new Error('Este pedido está com ' + x.responsavelNome + '.');
        const patch = {
          status: status, atualizadoEm: agora(),
          historico: (x.historico || []).concat(evento(texto || STATUS[status].rotulo, op, 'status'))
        };
        if (status === 'carga_fechada') patch.fechadoEm = agora();
        if (status === 'carregado') patch.carregadoEm = agora();
        return patch;
      });
    },
    async atendimento(dispId) { return (await M.obter('atendimentos', dispId)) || { id: dispId, notas: [], recusas: [] }; },
    async anotar(d, texto, op, tipo) {
      const a = await SV.atendimento(d.id);
      return M.gravar('atendimentos', d.id, { notas: (a.notas || []).concat(evento(texto, op, tipo || 'contato')) });
    },
    /** Proposta: valores internos em atendimentos; motorista vê só o que é dele. */
    async enviarProposta(d, op, n) {
      const a = await SV.atendimento(d.id);
      await M.gravar('atendimentos', d.id, {
        negociacao: Object.assign({}, n, { em: agora(), por: op.nome }),
        notas: (a.notas || []).concat(evento('Proposta: ' + util.moeda(n.repasse) + ' ao parceiro' + (n.cargaRotulo ? ' · ' + n.cargaRotulo : ''), op, 'proposta'))
      });
      await M.atualizarCom('disponibilidades', d.id, (x) => ({
        proposta: { rota: n.rota || '', valorParceiro: n.repasse, pedagio: n.pedagio || null, pagamento: n.pagamento || '', cargaId: n.cargaId || null },
        status: 'proposta_enviada', atualizadoEm: agora(),
        historico: (x.historico || []).concat(evento('Proposta enviada ao motorista', op, 'status'))
      }));
    },
    async registrarRecusa(d, op, motivo, obs) {
      const a = await SV.atendimento(d.id);
      await M.gravar('atendimentos', d.id, {
        recusas: (a.recusas || []).concat({ em: agora(), motivo: motivo, obs: obs || '', por: op.nome }),
        notas: (a.notas || []).concat(evento('Motorista recusou · ' + motivo + (obs ? ' · ' + obs : ''), op, 'recusa'))
      });
      await M.atualizarCom('disponibilidades', d.id, (x) => ({
        status: 'em_atendimento', proposta: null, atualizadoEm: agora(),
        historico: (x.historico || []).concat(evento('Proposta recusada, seguimos buscando', op, 'status'))
      }));
    },
    salvarCarga(c) {
      const id = c.id || novoId();
      return M.gravar('cargas', id, Object.assign({ status: 'aberta', criadoEm: agora() }, c, { atualizadoEm: agora() }));
    },

    /** Requisitos obrigatórios primeiro; depois pontua proximidade, destino e horário. */
    compatibilidade(d, c) {
      const v = d.veiculo || {};
      const falhas = [];
      const pontos = [];
      if (c.carrocerias && c.carrocerias.length && !c.carrocerias.includes(v.carroceria)) falhas.push('Carroceria ' + (v.carroceria || 'não informada'));
      const cap = d.ocupacao === 'parcial' && d.capacidadeLivreKg ? d.capacidadeLivreKg : v.capacidadeKg;
      if (c.pesoKg && cap && cap < c.pesoKg) falhas.push('Capacidade de ' + util.toneladas(cap));
      if (c.anoMinimo && v.ano && v.ano < c.anoMinimo) falhas.push('Ano ' + v.ano + ' abaixo do mínimo');
      if (c.exigeRastreador && !v.rastreador) falhas.push('Sem rastreador');
      let nota = 0;
      if (d.uf && d.uf === c.origemUF) {
        nota += 40; pontos.push('Na UF de origem');
        if (c.origemCidade && norm(d.cidade) === norm(c.origemCidade)) { nota += 20; pontos.push('Mesma cidade'); }
      }
      const i = (d.destinos || []).indexOf(c.destinoUF);
      if (i >= 0) { nota += [30, 20, 10][i]; pontos.push('Destino é a ' + (i + 1) + 'ª preferência'); }
      else if (d.aceitaOutras) { nota += 5; pontos.push('Aceita outras rotas'); }
      const idadeH = (agora() - (d.localEm || d.criadoEm || 0)) / 3600000;
      if (idadeH < 2) nota += 10;
      return { ok: falhas.length === 0, falhas: falhas, pontos: pontos, nota: nota };
    },

    /* ----- demonstração ----- */
    async semearDemo() {
      if (!DEMO) return;
      const h = 3600000;
      const t0 = agora();
      const pessoas = [
        ['Josué Ramos', '31988120455', 'Carreta', 'Baú', 28000, 'RTK4B21', 2019, true, 'Contagem', 'MG', ['RJ', 'SP', 'ES'], 0.2, 'disponivel'],
        ['Marcelo Duarte', '21997301122', 'Truck', 'Sider', 14000, 'LQP2E09', 2016, true, 'Duque de Caxias', 'RJ', ['SP', 'MG'], 0.6, 'disponivel'],
        ['Adriana Lopes', '11974450018', 'Carreta LS', 'Graneleiro', 32000, 'FHX7C33', 2021, true, 'Campinas', 'SP', ['RJ'], 1.4, 'em_atendimento'],
        ['Wellington Souza', '27999872310', 'Bitruck', 'Baú', 19000, 'MSZ1A88', 2014, false, 'Serra', 'ES', ['RJ', 'MG'], 3.1, 'proposta_enviada'],
        ['Cláudio Neves', '24988014567', 'Toco', 'Baú', 7000, 'KOP3F12', 2018, true, 'Volta Redonda', 'RJ', ['SP'], 5.5, 'disponivel'],
        ['Renato Farias', '32991002288', 'Carreta', 'Refrigerado', 26000, 'QTE8D41', 2020, true, 'Juiz de Fora', 'MG', ['RJ', 'SP'], 13, 'disponivel']
      ];
      const op = { id: 'op-central', nome: 'Central Severo' };
      for (const p of pessoas) {
        const mid = novoId(), vid = novoId(), did = novoId();
        const criado = t0 - p[11] * h;
        await M.gravar('motoristas', mid, { nome: p[0], telefone: p[1], criadoEm: criado, cadastro: 'aprovado' });
        const v = { motoristaId: mid, tipo: p[2], carroceria: p[3], capacidadeKg: p[4], placa: p[5], ano: p[6], rastreador: p[7] };
        await M.gravar('veiculos', vid, v);
        const assumido = p[12] !== 'disponivel';
        const hist = [evento('Pedido enviado pelo motorista', null, 'motorista')];
        hist[0].em = criado;
        if (assumido) hist.push({ em: criado + 9 * 60000, texto: 'Atendimento assumido por ' + op.nome, tipo: 'sistema', por: op });
        await M.gravar('disponibilidades', did, {
          motoristaId: mid, motoristaNome: p[0], telefone: p[1], veiculoId: vid,
          veiculo: { tipo: p[2], carroceria: p[3], capacidadeKg: p[4], placa: p[5], ano: p[6], rastreador: p[7] },
          cidade: p[8], uf: p[9], lat: null, lng: null, localEm: criado,
          quando: { tipo: 'agora', em: criado }, ocupacao: 'vazio', capacidadeLivreKg: null,
          destinos: p[10], aceitaOutras: p[10].length < 2, obs: '', audioUrl: null,
          status: p[12], criadoEm: criado, atualizadoEm: criado, expiraEm: criado + VALIDADE_MS,
          responsavelId: assumido ? op.id : null, responsavelNome: assumido ? op.nome : null,
          assumidoEm: assumido ? criado + 9 * 60000 : null,
          proposta: p[12] === 'proposta_enviada' ? { rota: 'Serra/ES → Rio de Janeiro/RJ', valorParceiro: 4200, pedagio: 310, pagamento: '70% no carregamento, 30% na entrega' } : null,
          historico: hist
        });
      }
      const cargas = [
        ['Atacadão Fluminense', 'Contagem', 'MG', 'Rio de Janeiro', 'RJ', 24000, ['Baú', 'Sider'], 2015, true, 6200, 0],
        ['Siderúrgica Vale do Paraíba', 'Volta Redonda', 'RJ', 'São Paulo', 'SP', 6500, ['Baú'], 0, false, 2900, 0],
        ['Laticínios Serra Azul', 'Juiz de Fora', 'MG', 'São Paulo', 'SP', 22000, ['Refrigerado'], 2018, true, 7400, 1],
        ['Distribuidora Porto Real', 'Duque de Caxias', 'RJ', 'Belo Horizonte', 'MG', 12000, ['Sider', 'Baú'], 0, false, 4100, 1]
      ];
      for (const c of cargas) {
        await SV.salvarCarga({
          cliente: c[0], origemCidade: c[1], origemUF: c[2], destinoCidade: c[3], destinoUF: c[4],
          pesoKg: c[5], carrocerias: c[6], anoMinimo: c[7] || null, exigeRastreador: c[8], escolta: false,
          valorCliente: c[9], dataCarregamento: t0 + c[10] * 86400000, obs: ''
        });
      }
    },
    limparDemo() { if (DEMO && M.limparTudo) M.limparTudo(); }
  };

  window.SV = SV;
})();
