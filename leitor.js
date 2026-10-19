/* Severo · leitor de carga
 * Transforma um texto (ditado por voz ou mensagem de WhatsApp colada) nos campos da carga.
 * Funciona sem internet e sem custo: regras em português, nada de inteligência artificial paga.
 */
(function (raiz) {
  'use strict';

  const UF_NOMES = {
    'acre': 'AC', 'alagoas': 'AL', 'amapa': 'AP', 'amazonas': 'AM', 'bahia': 'BA', 'ceara': 'CE', 'distrito federal': 'DF',
    'espirito santo': 'ES', 'goias': 'GO', 'maranhao': 'MA', 'mato grosso do sul': 'MS', 'mato grosso': 'MT', 'minas gerais': 'MG', 'minas': 'MG',
    'para': 'PA', 'paraiba': 'PB', 'parana': 'PR', 'pernambuco': 'PE', 'piaui': 'PI', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS',
    'rondonia': 'RO', 'roraima': 'RR', 'santa catarina': 'SC', 'sao paulo estado': 'SP', 'sergipe': 'SE', 'tocantins': 'TO'
  };
  const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
  // cidades frequentes: quando falam só a cidade, a UF vem daqui
  const CIDADES = {
    'rio de janeiro': ['Rio de Janeiro', 'RJ'], 'rio': ['Rio de Janeiro', 'RJ'], 'duque de caxias': ['Duque de Caxias', 'RJ'], 'nova iguacu': ['Nova Iguaçu', 'RJ'],
    'sao goncalo': ['São Gonçalo', 'RJ'], 'niteroi': ['Niterói', 'RJ'], 'volta redonda': ['Volta Redonda', 'RJ'], 'resende': ['Resende', 'RJ'], 'campos': ['Campos dos Goytacazes', 'RJ'],
    'macae': ['Macaé', 'RJ'], 'itaguai': ['Itaguaí', 'RJ'], 'petropolis': ['Petrópolis', 'RJ'], 'queimados': ['Queimados', 'RJ'], 'belford roxo': ['Belford Roxo', 'RJ'],
    'sao paulo': ['São Paulo', 'SP'], 'sampa': ['São Paulo', 'SP'], 'guarulhos': ['Guarulhos', 'SP'], 'campinas': ['Campinas', 'SP'], 'santos': ['Santos', 'SP'], 'osasco': ['Osasco', 'SP'],
    'barueri': ['Barueri', 'SP'], 'jundiai': ['Jundiaí', 'SP'], 'sorocaba': ['Sorocaba', 'SP'], 'ribeirao preto': ['Ribeirão Preto', 'SP'], 'sao jose dos campos': ['São José dos Campos', 'SP'],
    'cajamar': ['Cajamar', 'SP'], 'cotia': ['Cotia', 'SP'], 'itapevi': ['Itapevi', 'SP'], 'santana de parnaiba': ['Santana de Parnaíba', 'SP'], 'mogi das cruzes': ['Mogi das Cruzes', 'SP'], 'paulinia': ['Paulínia', 'SP'], 'hortolandia': ['Hortolândia', 'SP'], 'sumare': ['Sumaré', 'SP'], 'atibaia': ['Atibaia', 'SP'], 'paulista': ['Paulista', 'PE'], 'cabo de santo agostinho': ['Cabo de Santo Agostinho', 'PE'], 'jaboatao': ['Jaboatão dos Guararapes', 'PE'], 'jaboatao dos guararapes': ['Jaboatão dos Guararapes', 'PE'], 'cajamar sp': ['Cajamar', 'SP'], 'louveira': ['Louveira', 'SP'], 'embu': ['Embu das Artes', 'SP'],
    'belo horizonte': ['Belo Horizonte', 'MG'], 'bh': ['Belo Horizonte', 'MG'], 'contagem': ['Contagem', 'MG'], 'betim': ['Betim', 'MG'], 'juiz de fora': ['Juiz de Fora', 'MG'],
    'uberlandia': ['Uberlândia', 'MG'], 'uberaba': ['Uberaba', 'MG'], 'extrema': ['Extrema', 'MG'], 'pouso alegre': ['Pouso Alegre', 'MG'], 'sete lagoas': ['Sete Lagoas', 'MG'], 'ipatinga': ['Ipatinga', 'MG'],
    'vitoria': ['Vitória', 'ES'], 'serra': ['Serra', 'ES'], 'vila velha': ['Vila Velha', 'ES'], 'cariacica': ['Cariacica', 'ES'], 'linhares': ['Linhares', 'ES'],
    'curitiba': ['Curitiba', 'PR'], 'londrina': ['Londrina', 'PR'], 'maringa': ['Maringá', 'PR'], 'paranagua': ['Paranaguá', 'PR'], 'sao jose dos pinhais': ['São José dos Pinhais', 'PR'],
    'joinville': ['Joinville', 'SC'], 'jaragua do sul': ['Jaraguá do Sul', 'SC'], 'jaragua': ['Jaraguá do Sul', 'SC'], 'itajai': ['Itajaí', 'SC'], 'blumenau': ['Blumenau', 'SC'], 'florianopolis': ['Florianópolis', 'SC'], 'navegantes': ['Navegantes', 'SC'],
    'porto alegre': ['Porto Alegre', 'RS'], 'caxias do sul': ['Caxias do Sul', 'RS'], 'salvador': ['Salvador', 'BA'], 'feira de santana': ['Feira de Santana', 'BA'], 'camacari': ['Camaçari', 'BA'],
    'goiania': ['Goiânia', 'GO'], 'anapolis': ['Anápolis', 'GO'], 'brasilia': ['Brasília', 'DF'], 'recife': ['Recife', 'PE'], 'fortaleza': ['Fortaleza', 'CE'], 'campo grande': ['Campo Grande', 'MS'], 'cuiaba': ['Cuiabá', 'MT']
  };
  const VEICULOS = [['carreta ls', 'Carreta LS'], ['rodotrem', 'Rodotrem'], ['bitrem', 'Bitrem'], ['bitruck', 'Bitruck'], ['bi truck', 'Bitruck'], ['carreta', 'Carreta'], ['truck', 'Truck'], ['toco', 'Toco'], ['3/4', '3/4'], ['tres quartos', '3/4'], ['vuc', 'VUC']];
  const CARROCERIAS = [['bau', 'Baú'], ['sider', 'Sider'], ['slider', 'Sider'], ['graneleiro', 'Graneleiro'], ['grade baixa', 'Grade baixa'], ['refrigerad', 'Refrigerado'], ['frigorific', 'Refrigerado'], ['reefer', 'Refrigerado'], ['prancha', 'Prancha'], ['cacamba', 'Caçamba'], ['porta conteiner', 'Porta-contêiner'], ['porta container', 'Porta-contêiner'], ['tanque', 'Tanque']];
  const DIAS = { 'domingo': 0, 'segunda': 1, 'terca': 2, 'quarta': 3, 'quinta': 4, 'sexta': 5, 'sabado': 6 };
  const NOMES_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

  const semAcento = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const tirarEmoji = (s) => String(s || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, ' ');
  const titulo = (s) => String(s || '').toLowerCase().replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Dos|Das|E)\b/g, (w) => w.toLowerCase());

  /* números falados: "quatro mil e quinhentos" → 4500 */
  const UNID = { zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19 };
  const DEZ = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90 };
  const CEM = { cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, quatrocentos: 400, quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900 };
  function numerosFalados(txt) {
    const palavra = Object.keys(UNID).concat(Object.keys(DEZ), Object.keys(CEM), ['mil']).join('|');
    const re = new RegExp('\\b(?:' + palavra + '|\\d+)(?:\\s+(?:e\\s+)?(?:' + palavra + '|\\d+))*\\b', 'g');
    return txt.replace(re, (trecho) => {
      const ps = trecho.split(/\s+/).filter((p) => p !== 'e');
      if (ps.length === 1 && /^\d+$/.test(ps[0])) return trecho;
      if (!ps.some((p) => p === 'mil' || UNID[p] != null || DEZ[p] != null || CEM[p] != null)) return trecho;
      let total = 0, atual = 0;
      for (const p of ps) {
        if (/^\d+$/.test(p)) atual += +p;
        else if (UNID[p] != null) atual += UNID[p];
        else if (DEZ[p] != null) atual += DEZ[p];
        else if (CEM[p] != null) atual += CEM[p];
        else if (p === 'mil') { total += (atual || 1) * 1000; atual = 0; }
      }
      return String(total + atual);
    });
  }

  function local(trecho) {
    const r0 = local1(trecho);
    if (!r0 || r0.uf) return r0;
    const t0 = semAcento(trecho).toLowerCase().replace(/[^\w\/\- ]/g, ' ').replace(/\s+/g, ' ').trim();
    const re = /\s(?:de|do|da|dos|das|em)\s/g;
    let x;
    while ((x = re.exec(t0))) {
      const r = local1(t0.slice(x.index + x[0].length));
      if (r && r.uf) return r;
    }
    const ws = t0.split(' ');
    for (let n = Math.min(ws.length - 1, 4); n >= 1; n--) {
      const r = local1(ws.slice(0, n).join(' '));
      if (r && r.uf) return Object.assign(r, { sobra: ws.slice(n).join(' ') });
    }
    return r0;
  }
  function local1(trecho) {
    let t = semAcento(trecho).toLowerCase().replace(/[^\w\/\- ]/g, ' ').replace(/\s+/g, ' ').trim();
    let antes;
    do { antes = t; t = t.replace(/^(?:carga\s+(?:de|do|da)\s+[a-z]+|saindo|origem|destino|de|do|da|dos|das|para|pra|ate|em|com destino a)\s+/, '').trim(); } while (t !== antes);
    if (!t) return null;
    // "Contagem/MG", "Contagem - MG", "Contagem MG"
    const m = t.match(/^(.*?)[\s\/\-]+([a-z]{2})$/);
    if (m && UFS.includes(m[2].toUpperCase())) {
      const nome = m[1].trim();
      const conhecida = CIDADES[nome];
      return { cidade: conhecida ? conhecida[0] : titulo(nome), uf: m[2].toUpperCase() };
    }
    if (t.length === 2 && UFS.includes(t.toUpperCase())) {
      // só a UF: o Rio e São Paulo, ditos assim, quase sempre são a capital
      return { cidade: '', uf: t.toUpperCase() };
    }
    if (CIDADES[t]) return { cidade: CIDADES[t][0], uf: CIDADES[t][1] };
    // "Cotia São Paulo", "Itaguaí Rio de Janeiro": cidade seguida do nome do estado
    for (const [nome, uf] of [['sao paulo', 'SP'], ['rio de janeiro', 'RJ'], ['rio', 'RJ']]) {
      if (t.length > nome.length + 1 && t.endsWith(' ' + nome)) {
        const pre = t.slice(0, -nome.length - 1).trim();
        if (/\b(?:de|do|da|em|no|na|para|pra)$/.test(pre)) return { cidade: CIDADES[nome][0], uf: uf };
        const cid = pre;
        if (cid) return { cidade: CIDADES[cid] ? CIDADES[cid][0] : titulo(cid), uf: uf };
      }
    }
    for (const nome of Object.keys(UF_NOMES).sort((a, b) => b.length - a.length)) {
      const i = t.lastIndexOf(nome);
      if (i >= 0 && i + nome.length === t.length) {
        const cid = t.slice(0, i).replace(/\b(?:em|no|na|de)\s*$/, '').trim();
        return { cidade: cid ? (CIDADES[cid] ? CIDADES[cid][0] : titulo(cid)) : '', uf: UF_NOMES[nome] };
      }
    }
    return { cidade: titulo(t), uf: '' };
  }

  function proximaData(alvo, hoje) {
    const d = new Date(hoje); d.setHours(8, 0, 0, 0);
    const soma = (alvo - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + soma);
    return d.getTime();
  }
  function data(trecho, hoje, depoisDe) {
    if (!trecho) return null;
    const t = semAcento(trecho).toLowerCase();
    const d = new Date(hoje); d.setHours(8, 0, 0, 0);
    if (/depois de amanha/.test(t)) { d.setDate(d.getDate() + 2); return d.getTime(); }
    if (/amanha/.test(t)) { d.setDate(d.getDate() + 1); return d.getTime(); }
    if (/hoje|agora|imediato/.test(t)) return d.getTime();
    const dia = t.match(/\bdia\s+(\d{1,2})(?![\d\/])/);
    if (dia) {
      const r = new Date(hoje); r.setHours(8, 0, 0, 0); r.setDate(+dia[1]);
      if (r.getTime() < hoje - 86400000) r.setMonth(r.getMonth() + 1);
      return r.getTime();
    }
    const num = t.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?(?!\d)/);
    if (num && +num[2] >= 1 && +num[2] <= 12) {
      const r = new Date(hoje); r.setHours(8, 0, 0, 0);
      r.setMonth(+num[2] - 1, +num[1]);
      if (num[3]) r.setFullYear(num[3].length === 2 ? 2000 + +num[3] : +num[3]);
      else if (r.getTime() < hoje - 86400000) r.setFullYear(r.getFullYear() + 1);
      return r.getTime();
    }
    let melhor = null, pos = 1e9;
    for (const nome of Object.keys(DIAS)) { const i = t.indexOf(nome); if (i >= 0 && i < pos) { pos = i; melhor = nome; } }
    if (melhor) {
      let r = proximaData(DIAS[melhor], hoje);
      if (depoisDe && r < depoisDe) r += 7 * 86400000;
      return r;
    }
    return null;
  }

  /* ---------- mensagem em linhas ("Frete: R$ 2.300", "RJ X OSASCO", "DESCARGA: 20/10/2026") ---------- */
  const TEM_DATA = /\d{1,2}\/\d{1,2}|\bhoje\b|amanha|segunda|terca|quarta|quinta|sexta|sabado|domingo|\bdia \d/;
  function numero(v) {
    const x = String(v).match(/(\d[\d.]*(?:,\d{1,2})?)/);
    return x ? parseFloat(x[1].replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')) : null;
  }
  function pagamentoBonito(v) {
    return v.replace(/\b(\d{1,3})\s*\/\s*(\d{1,3})\s*%?/, '$1% + $2%').replace(/\s*(?:\+|\be\b|mais)\s*/g, ' + ').replace(/\bpgto\b/gi, '').replace(/\s+/g, ' ').replace(/^[\s:+-]+|[\s.;+-]+$/g, '');
  }
  function linhas(t, acentuado, hoje, achados, geral) {
    const r = {};
    const lt = t.split('\n'), la = acentuado.split('\n');
    lt.forEach((linha, i) => {
      const l = linha.trim(), a = (la[i] || '').trim();
      if (!l) return;
      const rot = l.match(/^([a-z][a-z +\/]{1,40}?)\s*:\s*(.+)$/);
      if (rot) {
        const k = rot[1].trim(), v = rot[2].trim();
        const va = a.slice(a.indexOf(':') + 1).trim();
        const ehData = TEM_DATA.test(v);
        if (/^(?:origem|saida|local de coleta|coleta)$/.test(k) && !ehData) { const o = local(v); if (o) { r.origemCidade = o.cidade; r.origemUF = o.uf; achados.rota = true; } }
        else if (/^(?:destino|local de entrega|entrega|descarga)$/.test(k) && !ehData) { const d = local(v); if (d) { r.destinoCidade = d.cidade; r.destinoUF = d.uf; } }
        else if (/^(?:produto|mercadoria|material|carga|tipo de carga)$/.test(k)) { r.produto = titulo(va.replace(/[—–-].*$/, '').trim()); achados.produto = true; }
        else if (/^(?:data de )?(?:carregamento|carrega|coleta|data coleta|data da coleta|retirada)$/.test(k) && ehData) { const d = data(v, hoje); if (d) { r.dataCarregamento = d; achados.carregamento = true; } }
        else if (/^(?:data de )?(?:descarga|descarregamento|descarrega|entrega|data entrega|previsao de entrega)$/.test(k) && ehData) { const d = data(v, hoje, r.dataCarregamento || geral.dataCarregamento); if (d) { r.dataDescarga = d; achados.descarga = true; } }
        else if (/^(?:pagamento|pgto|forma de pagamento|condicao de pagamento)$/.test(k)) { r.pagamento = pagamentoBonito(va); achados.pagamento = true; }
        else if (/^(?:valor|frete|valor do frete|valor frete|valor ao motorista)$/.test(k)) { const n = numero(v); if (n && n >= 100) { r.valorOferecido = n; achados.valor = true; } }
        else if (/^(?:operacao|cliente|embarcador)$/.test(k)) { r.cliente = titulo(va); }
        else if (/^(?:rota|trecho)$/.test(k)) { const x = v.split(/\s+x\s+/); if (x.length === 2) { const o = local(x[0]), d = local(x[1]); if (o && d) { Object.assign(r, { origemCidade: o.cidade, origemUF: o.uf, destinoCidade: d.cidade, destinoUF: d.uf }); achados.rota = true; } } }
        return;
      }
      const rr = l.split(/[,;]/)[0].trim().match(/^(.{2,40}?)\s+x\s+(.{2,80})$/);
      if (rr && rr[1].split(' ').length <= 5) {
        const o = local(rr[1]), d = local(rr[2]);
        if (o && d && (o.uf || o.cidade) && (d.uf || d.cidade)) {
          Object.assign(r, { origemCidade: o.cidade, origemUF: o.uf, destinoCidade: d.cidade, destinoUF: d.uf });
          achados.rota = true;
          if (d.sobra && !geral.produto) {
            const p = d.sobra.replace(/\b(?:media|med|aprox\w*|cerca de|de|ate|\d).*$/, '').trim();
            if (p.length >= 3) { r.produto = titulo(p); achados.produto = true; }
          }
          return;
        }
      }
      const pr = a.match(/^([a-zà-ú][a-zà-ú ]{2,30}?)\s*[—–-]\s*.*\d+\s*(?:t\b|ton)/);
      if (pr && !r.produto && !/carreta|truck|toco|bau|baú|sider/.test(pr[1])) { r.produto = titulo(pr[1].trim()); achados.produto = true; }
    });
    return r;
  }

  /**
   * ler(texto, hoje?) → { campos, achados, faltando, texto }
   * campos: produto, origemCidade, origemUF, destinoCidade, destinoUF, tipoVeiculo, carrocerias, anoMinimo,
   *         pesoKg, dataCarregamento, dataDescarga, valorOferecido, pedagioIncluso, pagamento, exigeRastreador, escolta
   */
  function ler(texto, hoje) {
    hoje = hoje || Date.now();
    const original = String(texto || '').trim();
    let base = tirarEmoji(original.replace(/\s*(?:[\u2192\u2794\u279C\u27A1\u21D2\u279D\u27F6]|->|=>)\s*/g, ' x ')).replace(/[*_~]/g, ' ');
    let t = numerosFalados(semAcento(base).toLowerCase().replace(/\s*por\s*cento/g, '%'))
      .replace(/(\d)\s+mil\b/g, '$1000')
      .replace(/\bpixi\b|\bpics\b/g, 'pix').replace(/\btoneladas?\b/g, 'toneladas')
      .replace(/[ \t]+/g, ' ');
    const c = {};
    const achados = {};

    // produto: "carga de medicamentos", "produto: bebidas"
    const acentuado = base.toLowerCase().replace(/[ \t]+/g, ' ');
    const PARA_PRODUTO = /^(?:\d|uma?\b|toneladas?|ton\b|quilos|carreta|truck|toco|bau|sider|saindo|origem|rio|sao|para|pra)/;
    let m = acentuado.match(/\b(?:produto|mercadoria)\s*:?\s*([a-zà-ú][a-zà-ú ]{2,30}?)(?=\s*(?:\n|[,.;!]|$|\s(?:saindo|origem|de|do|da|para|pra|com|carreta|truck|toco|\d)))/);
    if (!m) {
      const re = /\bcarga\s+(?:de|do|da|com)\s+([a-zà-ú][a-zà-ú ]{2,40}?)(?=\s*(?:\n|[,.;!]|$|\s(?:saindo|origem|de|do|da|para|pra|com|no|na|carreta|truck|toco|carreg|\d)))/g;
      let x;
      while ((x = re.exec(acentuado))) { if (!PARA_PRODUTO.test(semAcento(x[1]))) { m = x; break; } }
    }
    if (m) { c.produto = titulo(m[1].trim()); achados.produto = true; }

    // rota: vários jeitos de dizer
    const FIM = '(?=\\s*(?:\\n|[,.;!|]|$)|\\s+(?:carga|carreg|descarreg|descarga|entreg|coleta|saida|carreta|truck|toco|bitrem|rodotrem|bitruck|vuc|bau|sider|grade|graneleiro|refriger|prancha|ate \\d|\\d|valor|frete|r\\$|paga|pix|peso|ano|rastread|escolt|mais|com|no |na |e )|$)';
    const LUGAR = '([a-z][a-z\\/\\- ]{1,40}?)';
    const padroes = [
      new RegExp('origem\\s*:?\\s*' + LUGAR + '\\s*(?:[,.;\\n]|\\s)\\s*destino\\s*:?\\s*' + LUGAR + FIM),
      new RegExp('(?:saindo|saida|partindo|sai)\\s+(?:de |do |da |dos |das )?' + LUGAR + '\\s+(?:para|pra|com destino a|destino|ate|indo para|indo pra|x)\\s+' + LUGAR + FIM),
      new RegExp('\\b(?:de|do|da)\\s+' + LUGAR + '\\s+(?:para|pra|ate|x)\\s+' + LUGAR + FIM),
      new RegExp('(?:^|\\n|\\s)' + LUGAR + '\\s+(?:x|->|>|\\u2192)\\s+' + LUGAR + FIM)
    ];
    for (const re of padroes) {
      const r = t.match(re);
      if (!r) continue;
      const o = local(r[1]), d = local(r[2]);
      if (o && d && (o.uf || CIDADES[semAcento(o.cidade).toLowerCase()] || o.cidade.split(' ').length <= 4) && (d.uf || d.cidade.split(' ').length <= 4)) {
        c.origemCidade = o.cidade; c.origemUF = o.uf; c.destinoCidade = d.cidade; c.destinoUF = d.uf;
        achados.rota = true;
        break;
      }
    }

    for (const [k, v] of VEICULOS) if (new RegExp('\\b' + k.replace('/', '\\/') + '\\b').test(t)) { c.tipoVeiculo = v; achados.tipoVeiculo = true; break; }
    const carrs = [];
    for (const [k, v] of CARROCERIAS) if (new RegExp('\\b' + k).test(t) && !carrs.includes(v)) carrs.push(v);
    if (carrs.length) { c.carrocerias = carrs; achados.carrocerias = true; }

    m = t.match(/\bano\s*(?:minimo\s*)?(?:de\s*)?(\d{4})/) || t.match(/\b((?:19|20)\d{2})\s*(?:(?:ou|pra|para|em)\s*(?:superior|cima|mais|diante)|acima|\+|em diante|pra frente)/);
    if (m) { c.anoMinimo = +m[1]; achados.anoMinimo = true; }

    m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:t\b|ton\b|tons\b|tonelada)/);
    if (m) { c.pesoKg = Math.round(parseFloat(m[1].replace(',', '.')) * 1000); achados.peso = true; }
    else if ((m = t.match(/(\d{3,6})\s*(?:kg|quilos|kilos)/))) { c.pesoKg = +m[1]; achados.peso = true; }

    // valor: "R$ 4.500", "4500 reais", "frete de 4500"
    const valores = [/r\$\s*([\d.]+(?:,\d{1,2})?)/, /(\d[\d.]{2,}(?:,\d{1,2})?)\s*(?:\+|mais|com|sem|fora)\s*(?:o\s*|os\s*)?pedagio/, /(?:frete|valor|pagando|paga|pago)\s*(?:de|do|e|:|em)?\s*(?:r\$\s*)?(\d[\d.]*(?:,\d{1,2})?)/, /(\d[\d.]*(?:,\d{1,2})?)\s*(?:reais|conto|contos|pila)/];
    for (const re of valores) {
      const x = t.match(re);
      if (!x) continue;
      const v = parseFloat(x[1].replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
      if (v >= 300) { c.valorOferecido = v; achados.valor = true; break; }
    }
    if (/(?:com|incluso|incluindo|ja com)\s*(?:o\s*)?pedagio|pedagio[s]?\s*(?:incluso|incluido|ja incluso|ja incluido|ja esta)/.test(t)) { c.pedagioIncluso = true; achados.pedagio = true; }
    else if (/(?:\+|mais|fora|sem)\s*(?:o\s*|os\s*)?pedagio|pedagio[s]?\s*(?:a parte|por fora|separado|pago a parte|por conta|do motorista|nao incluso|fica por fora)|vale[- ]pedagio/.test(t)) { c.pedagioIncluso = false; achados.pedagio = true; }

    m = t.match(/(\d{1,3}\s*%\s*(?:\+|e|mais)\s*\d{1,3}\s*%)/) || t.match(/(?:pagamento|pgto)\s*:?\s*([^\n]{2,60})/);
    if (m) {
      c.pagamento = m[1].split(/\s(?:veiculo|rastread|escolt|valor|frete|ano\s|carreta|truck|toco|r\$|mais pedagio|pedagio|com pedagio|saindo|origem)/)[0].replace(/\s*(?:\+|\be\b|mais)\s*/g, ' + ').replace(/\s+/g, ' ').trim().replace(/[.;]$/, '');
      achados.pagamento = true;
    }

    const janela = (re, corte) => {
      const x = re.exec(t);
      if (!x) return null;
      let resto = t.slice(x.index + x[0].length, x.index + x[0].length + 45);
      if (corte) { const k = resto.search(corte); if (k >= 0) resto = resto.slice(0, k); }
      return resto;
    };
    const jc = janela(/\b(?:carreg\w*|coleta\w*|retirada)/, /descarreg|descarga|entreg/);
    if (jc) { c.dataCarregamento = data(jc, hoje); if (c.dataCarregamento) achados.carregamento = true; }
    const jd = janela(/\b(?:descarreg\w*|descarga|entreg\w*)/, /(?<!des)carreg|coleta|saida|saindo/);
    if (jd) { c.dataDescarga = data(jd, hoje, c.dataCarregamento); if (c.dataDescarga) achados.descarga = true; }

    if (!c.pagamento) {
      const pg = t.match(/\b([1-9]0)\s?([1-9]0)\b(?!\s*(?:reais|r\$|t\b|ton|kg))/);
      if (pg && +pg[1] + +pg[2] === 100) { c.pagamento = pg[1] + '% + ' + pg[2] + '%'; achados.pagamento = true; }
    }
    if (/rastread|rastreador|rastreio|rastreamento/.test(t)) { c.exigeRastreador = true; achados.rastreador = true; }
    if (/escolt/.test(t)) { c.escolta = true; achados.escolta = true; }

    Object.assign(c, linhas(t, acentuado, hoje, achados, c));
    const rotulos = { rota: 'origem e destino', tipoVeiculo: 'tipo de veículo', carrocerias: 'carroceria', peso: 'peso', valor: 'valor do frete', pedagio: 'pedágio incluso ou não', carregamento: 'data de carregamento', pagamento: 'pagamento' };
    const faltando = Object.keys(rotulos).filter((k) => !achados[k]).map((k) => rotulos[k]);
    if (achados.rota && (!c.origemUF || !c.destinoUF)) faltando.unshift('UF da ' + (!c.origemUF ? 'origem' : 'do destino'));
    return { campos: c, achados: achados, faltando: faltando, texto: original };
  }

  /** Resumo em uma linha para mostrar enquanto a pessoa fala. */
  function resumo(c) {
    const p = [];
    if (c.produto) p.push(c.produto);
    if (c.origemUF || c.destinoUF) p.push((c.origemCidade ? c.origemCidade + '/' : '') + (c.origemUF || '?') + ' → ' + (c.destinoCidade ? c.destinoCidade + '/' : '') + (c.destinoUF || '?'));
    if (c.tipoVeiculo || c.carrocerias) p.push([c.tipoVeiculo, (c.carrocerias || []).join('/')].filter(Boolean).join(' '));
    if (c.anoMinimo) p.push('ano ' + c.anoMinimo + '+');
    if (c.pesoKg) p.push((c.pesoKg / 1000).toLocaleString('pt-BR') + ' t');
    if (c.dataCarregamento) p.push('carrega ' + NOMES_DIA[new Date(c.dataCarregamento).getDay()] + ' ' + new Date(c.dataCarregamento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    if (c.dataDescarga) p.push('descarrega ' + NOMES_DIA[new Date(c.dataDescarga).getDay()] + ' ' + new Date(c.dataDescarga).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    if (c.valorOferecido) p.push('R$ ' + c.valorOferecido.toLocaleString('pt-BR') + (c.pedagioIncluso === false ? ' + pedágios' : c.pedagioIncluso ? ' com pedágio' : ''));
    if (c.pagamento) p.push('pagamento ' + c.pagamento);
    if (c.exigeRastreador) p.push('rastreado');
    if (c.escolta) p.push('escolta');
    return p;
  }

  raiz.LeitorCarga = { ler: ler, resumo: resumo };
})(typeof window !== 'undefined' ? window : globalThis);
