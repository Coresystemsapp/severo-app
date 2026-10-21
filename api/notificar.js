/*
 * Severo · envio de notificações
 * Roda como função do Vercel (pasta /api). Usa a variável FIREBASE_SERVICE_ACCOUNT.
 *
 * Quem pode pedir:
 *  - equipe da central (coleção usuarios, ativo): avisa motoristas  { motoristas:[ids], titulo, corpo, link, tag }
 *  - motorista cadastrado: avisa a equipe sobre o que ELE fez  { evento:'novo_pedido'|'resposta'|'interesse', dispId|interesseId }
 * O texto das notificações do motorista é montado aqui, a partir do banco, nunca do que o aparelho manda.
 */
const admin = require('firebase-admin');

const CENTRAL = ['admin', 'gestao', 'operador', 'financeiro'];
const moeda = (v) => (v == null ? '' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

function iniciar() {
  if (admin.apps.length) return;
  const bruto = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!bruto) throw new Error('FIREBASE_SERVICE_ACCOUNT não configurada no Vercel.');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(bruto)) });
}

async function tokensDe(db, colecao, ids) {
  const lista = [];
  for (const id of ids) {
    const s = await db.collection(colecao).doc(id).get();
    if (!s.exists) continue;
    const d = s.data();
    if (colecao === 'motoristas' && d.bloqueado) continue;
    if (colecao === 'usuarios' && d.ativo === false) continue;
    (d.pushTokens || []).forEach((t) => lista.push({ token: t, ref: s.ref }));
  }
  return lista;
}

async function tokensDaEquipe(db) {
  const snap = await db.collection('usuarios').get();
  const lista = [];
  snap.forEach((s) => {
    const d = s.data();
    if (d.ativo === false || !CENTRAL.includes(d.papel)) return;
    (d.pushTokens || []).forEach((t) => lista.push({ token: t, ref: s.ref }));
  });
  return lista;
}

async function enviar(alvos, msg) {
  if (!alvos.length) return 0;
  const tokens = alvos.map((a) => a.token);
  const r = await admin.messaging().sendEachForMulticast({
    tokens: tokens,
    data: { titulo: String(msg.titulo).slice(0, 80), corpo: String(msg.corpo || '').slice(0, 240), link: msg.link || '/', tag: msg.tag || '' },
    webpush: { headers: { Urgency: 'high', TTL: '86400' } }
  });
  // limpa aparelhos que desinstalaram ou trocaram de navegador
  const mortos = [];
  r.responses.forEach((x, i) => {
    const c = x.error && x.error.code;
    if (c === 'messaging/registration-token-not-registered' || c === 'messaging/invalid-registration-token' || c === 'messaging/invalid-argument') mortos.push(alvos[i]);
  });
  for (const m of mortos) await m.ref.update({ pushTokens: admin.firestore.FieldValue.arrayRemove(m.token) }).catch(() => {});
  return r.successCount;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST.' });
  try {
    iniciar();
    const db = admin.firestore();
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ erro: 'Sem login.' });
    const quem = await admin.auth().verifyIdToken(token);
    const corpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    const perfilSnap = await db.collection('usuarios').doc(quem.uid).get();
    const perfil = perfilSnap.exists ? perfilSnap.data() : null;
    const ehCentral = perfil && perfil.ativo !== false && CENTRAL.includes(perfil.papel);

    // equipe avisando motoristas
    if (ehCentral && Array.isArray(corpo.motoristas)) {
      const ids = corpo.motoristas.filter((x) => typeof x === 'string').slice(0, 200);
      const alvos = await tokensDe(db, 'motoristas', ids);
      const n = await enviar(alvos, { titulo: corpo.titulo || 'Severo', corpo: corpo.corpo || '', link: '/', tag: corpo.tag || '' });
      return res.status(200).json({ enviadas: n });
    }

    // motorista avisando a equipe sobre algo que ele acabou de fazer
    const mot = await db.collection('motoristas').doc(quem.uid).get();
    if (!mot.exists || mot.data().bloqueado) return res.status(403).json({ erro: 'Sem permissão.' });
    const nome = (mot.data().nome || 'Motorista').split(' ').slice(0, 2).join(' ');
    let msg = null;

    if (corpo.evento === 'novo_pedido' || corpo.evento === 'resposta') {
      const s = await db.collection('disponibilidades').doc(String(corpo.dispId || '')).get();
      if (!s.exists || s.data().motoristaId !== quem.uid) return res.status(403).json({ erro: 'Pedido não é deste motorista.' });
      const d = s.data();
      if (Date.now() - (d.atualizadoEm || 0) > 5 * 60 * 1000) return res.status(200).json({ enviadas: 0, motivo: 'antigo' });
      const lugar = (d.cidade ? d.cidade + '/' : '') + (d.uf || '');
      const v = d.veiculo || {};
      if (corpo.evento === 'novo_pedido') {
        msg = { titulo: 'Novo motorista na fila', corpo: nome + ' · ' + (lugar || 'local no áudio') + ' · ' + [v.tipo, v.carroceria].filter(Boolean).join(' ') + ((d.destinos || []).length ? ' · quer ' + d.destinos.join(', ') : '') };
      } else if (d.status === 'aguardando_aprovacao' && d.respostaMotorista && d.respostaMotorista.aceita) {
        msg = { titulo: nome + ' aceitou a proposta', corpo: (d.proposta ? moeda(d.proposta.valorParceiro) + ' · ' : '') + 'Confira os documentos e feche a carga.' };
      } else if (d.status === 'contraproposta' && d.contraproposta) {
        msg = { titulo: nome + ' quer negociar', corpo: 'Pede ' + moeda(d.contraproposta.valor) + (d.contraproposta.mensagem ? ' · “' + d.contraproposta.mensagem + '”' : '') };
      } else if (d.respostaMotorista && !d.respostaMotorista.aceita) {
        msg = { titulo: nome + ' recusou a proposta', corpo: 'Motivo: ' + (d.respostaMotorista.motivo || 'não informado') + (d.respostaMotorista.obs ? ' · ' + d.respostaMotorista.obs : '') };
      }
      if (msg) msg.tag = 'pedido-' + s.id;
    } else if (corpo.evento === 'interesse') {
      const s = await db.collection('interesses').doc(String(corpo.interesseId || '')).get();
      if (!s.exists || s.data().motoristaId !== quem.uid) return res.status(403).json({ erro: 'Interesse não é deste motorista.' });
      const i = s.data();
      const c = await db.collection('cargas').doc(i.cargaId).get();
      const rota = c.exists ? (c.data().origemUF || '') + ' → ' + (c.data().destinoUF || '') : 'uma carga';
      msg = i.valorPedido
        ? { titulo: nome + ' quer negociar uma carga', corpo: rota + ' · pede ' + moeda(i.valorPedido) }
        : { titulo: nome + ' tem interesse em uma carga', corpo: rota + ' · chame no WhatsApp pelo painel.' };
      msg.tag = 'interesse-' + s.id;
    }

    if (!msg) return res.status(200).json({ enviadas: 0 });
    msg.link = '/painel';
    const n = await enviar(await tokensDaEquipe(db), msg);
    return res.status(200).json({ enviadas: n });
  } catch (e) {
    return res.status(400).json({ erro: e.message || 'Falha ao enviar.' });
  }
};
