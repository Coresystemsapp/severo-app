/*
 * Severo · Seu próximo frete — configuração
 *
 * Enquanto "apiKey" estiver vazio, o sistema roda em MODO DEMONSTRAÇÃO:
 * tudo fica salvo no próprio navegador e o app do motorista conversa com o
 * painel em tempo real (abra os dois em abas do mesmo navegador).
 *
 * Para ligar no Firebase: Console do Firebase > Configurações do projeto >
 * Seus apps > Web > copie o objeto firebaseConfig para cá.
 */
window.SEVERO_CONFIG = {
  firebase: {
    apiKey: "AIzaSyBsDfa-FRapO4-cYFYzdE20HLhoOBJ5ewQ",
    authDomain: "severo-app-2074f.firebaseapp.com",
    projectId: "severo-app-2074f",
    storageBucket: "severo-app-2074f.firebasestorage.app",
    messagingSenderId: "990494820207",
    appId: "1:990494820207:web:5e974197f7513bf85c0a9a"
  },

  // Áudios no Firebase Storage (exige plano Blaze).
  // false = áudio salvo no próprio Firestore (plano gratuito, até ~1 min por áudio).
  usarStorage: false,

  // Validade do aviso "estou vazio" (proposta: 12 h, ajustável no piloto)
  validadeHoras: 12,

  // Meta de primeiro contato, em minutos (proposta: 15 min)
  metaPrimeiroContatoMin: 15,

  // Central de atendimento
  centralWhatsApp: "5521979890475",
  centralTelefone: "5521979890475",
  centralHorario: "Seg a sex, das 7h às 19h"
};
