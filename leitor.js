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
    'cajamar': ['Cajamar', 'SP'], 'louveira': ['Louveira', 'SP'], 'embu': ['Embu das Artes', 'SP'],
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
    const re = new RegExp('\\b(?:' + palavra + '|\\d+)(?:\\s+(?:e\\s+)?(?:' + palavra + '))*\\b', 'g');
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

  /**
   * ler(texto, hoje?) → { campos, achados, faltando, texto }
   * campos: produto, origemCidade, origemUF, destinoCidade, destinoUF, tipoVeiculo, carrocerias, anoMinimo,
   *         pesoKg, dataCarregamento, dataDescarga, valorOferecido, pedagioIncluso, pagamento, exigeRastreador, escolta
   */
  function ler(texto, hoje) {
    hoje = hoje || Date.now();
    const original = String(texto || '').trim();
    let base = tirarEmoji(original).replace(/[*_~]/g, ' ');
    let t = numerosFalados(semAcento(base).toLowerCase().replace(/\s*por\s*cento/g, '%'))
      .replace(/(\d)\s+mil\b/g, '$1000')
      .replace(/[ \t]+/g, ' ');
    const c = {};
    const achados = {};

    // produto: "carga de medicamentos"
    const acentuado = base.toLowerCase().replace(/[ \t]+/g, ' ');
    let m = acentuado.match(/\bcarga\s+(?:de|do|da|com)\s+([a-zà-ú ]{3,40}?)(?=\s*(?:\n|[,.;!]|$|\s(?:saindo|origem|de|do|da|para|pra|rj|sp|mg|com|no|na|carreta|truck|toco)\b))/);
    if (m) { c.produto = titulo(m[1].trim()); achados.produto = true; }

    // rota: "RJ x Contagem/MG", "do Rio para Contagem", "origem ... destino ..."
    const fimLocal = '(?=\\s*(?:\\n|[,.;!]|$|\\s(?:carreta|truck|toco|bitrem|rodotrem|bitruck|vuc|bau|sider|ate|carrega|descarrega|valor|r\\$|paga|pagamento|com|no|na|peso|\\d|ano|frete)\\b))';
    const nomeLocal = '([a-z][a-z\\/\\- ]{1,40}?)';
    const padroes = [
      new RegExp('origem\\s*:?\\s*' + nomeLocal + '\\s*[,.;\\n]?\\s*destino\\s*:?\\s*' + nomeLocal + fimLocal),
      new RegExp('(?:saindo\\s+d[eoa]\\s+|^|\\n|\\s)' + nomeLocal + '\\s+(?:x|para|pra|ate|destino|->|>|com destino a)\\s+' + nomeLocal + fimLocal)
    ];
    for (const re of padroes) {
      const r = t.match(re);
      if (!r) continue;
      const o = local(r[1].replace(/^(?:carga\s+(?:de|do|da)\s+[a-z]+\s+)/, '')), d = local(r[2]);
      if (o && d && (o.uf || o.cidade) && (d.uf || d.cidade)) {
        c.origemCidade = o.cidade; c.origemUF = o.uf; c.destinoCidade = d.cidade; c.destinoUF = d.uf;
        achados.rota = true;
        break;
      }
    }

    for (const [k, v] of VEICULOS) if (new RegExp('\\b' + k.replace('/', '\\/') + '\\b').test(t)) { c.tipoVeiculo = v; achados.tipoVeiculo = true; break; }
    const carrs = [];
    for (const [k, v] of CARROCERIAS) if (new RegExp('\\b' + k).test(t) && !carrs.includes(v)) carrs.push(v);
    if (carrs.length) { c.carrocerias = carrs; achados.carrocerias = true; }

    m = t.match(/\bano\s*(?:minimo\s*)?(?:de\s*)?(\d{4})/) || t.match(/\b((?:19|20)\d{2})\s*(?:ou|pra|para|em)\s*(?:superior|cima|mais|diante)/);
    if (m) { c.anoMinimo = +m[1]; achados.anoMinimo = true; }

    m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:t\b|ton\b|tons\b|tonelada)/);
    if (m) { c.pesoKg = Math.round(parseFloat(m[1].replace(',', '.')) * 1000); achados.peso = true; }
    else if ((m = t.match(/(\d{3,6})\s*(?:kg|quilos|kilos)/))) { c.pesoKg = +m[1]; achados.peso = true; }

    // valor: "R$ 4.500", "4500 reais", "frete de 4500"
    m = t.match(/r\$\s*([\d.]+(?:,\d{1,2})?)/) || t.match(/(\d[\d.]*(?:,\d{1,2})?)\s*reais/) || t.match(/(?:frete|valor|paga|pagando)\s*(?:de|e|:)?\s*(\d[\d.]{2,}(?:,\d{1,2})?)/);
    if (m) {
      const v = parseFloat(m[1].replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
      if (v >= 100) { c.valorOferecido = v; achados.valor = true; }
    }
    if (/(?:\+|mais|fora|sem)\s*(?:os\s*)?pedagio|pedagio[s]?\s*(?:a parte|por fora|separado|pago a parte)|vale[- ]pedagio/.test(t)) { c.pedagioIncluso = false; achados.pedagio = true; }
    else if (/(?:com|incluso|incluindo|ja com)\s*(?:o\s*)?pedagio|pedagio[s]?\s*incluso/.test(t)) { c.pedagioIncluso = true; achados.pedagio = true; }

    m = t.match(/(\d{1,3}\s*%\s*(?:\+|e|mais)\s*\d{1,3}\s*%)/) || t.match(/pagamento\s*:?\s*([^\n]{2,60})/);
    if (m) {
      c.pagamento = m[1].split(/\s(?:veiculo|rastread|escolt|carga|carrega|descarrega|valor|frete|ano)\b/)[0].replace(/\s*(?:\+|\be\b|mais)\s*/g, ' + ').replace(/\s+/g, ' ').trim().replace(/[.;]$/, '');
      achados.pagamento = true;
    }

    m = t.match(/\b(?<!des)carreg\w*\s*(?:no|na|em|para|pra|:)?\s*([^\n|,.;]{2,25}?)(?=\s*(?:descarreg|entreg|valor|r\$|frete|pagamento|\n|[|,.;]|$))/);
    if (m) { c.dataCarregamento = data(m[1], hoje); if (c.dataCarregamento) achados.carregamento = true; }
    m = t.match(/\bdescarreg\w*\s*(?:no|na|dia|em|para|pra|:)?\s*([^\n|,.;]{2,25})/) || t.match(/\bentrega\w*\s*(?:no|na|dia|em|para|pra|:)?\s*([^\n|,.;]{2,25})/);
    if (m) { c.dataDescarga = data(m[1], hoje, c.dataCarregamento); if (c.dataDescarga) achados.descarga = true; }

    if (/rastread|rastreador|rastreio|rastreamento/.test(t)) { c.exigeRastreador = true; achados.rastreador = true; }
    if (/escolt/.test(t)) { c.escolta = true; achados.escolta = true; }

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
