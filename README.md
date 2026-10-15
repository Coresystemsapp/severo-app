# Severo · Seu próximo frete

Web app (PWA) para agregados e freteiros avisarem que estão vazios, e painel da central da Severo Transportes para encontrar carga, negociar e fechar.

- `/` — app do motorista (instalável na tela inicial, funciona com sinal fraco)
- `/painel` — central de atendimento (operador, gestão, financeiro)

## Estrutura

Todos os arquivos ficam na raiz do repositório (facilita o upload pelo site do GitHub).

```
index.html  painel.html          app do motorista e central
severo.css                       visual
config.js                        Firebase e parâmetros
dados.js                         camada de dados (demo e Firebase)
motorista.js  painel.js  icones.js
sw.js  manifest.webmanifest      funcionamento offline e instalação
logo-severo.png  icon-192.png  icon-512.png
firestore.rules  storage.rules  vercel.json
```

## Testar agora (modo demonstração)

Com `apiKey` vazio em `config.js`, tudo roda no navegador:

```bash
npx serve .        # ou: python3 -m http.server 8080
```

1. Abra `http://localhost:3000/painel`, entre com um nome e função **Gestão**, clique em **Gerar dados de exemplo**.
2. Em outra aba, abra `http://localhost:3000/` (de preferência no modo celular do DevTools), faça o cadastro e toque em **Estou vazio**.
3. O pedido aparece no painel na hora. Assuma, envie proposta e veja o celular atualizar sozinho.

Para testar a fila sem sinal: DevTools > Network > Offline, envie um pedido, volte para Online.

## Ligar no Firebase

1. Crie o projeto no console do Firebase (plano Blaze recomendado para Storage).
2. **Authentication**: ative *Anônimo* (motoristas, piloto) e *E-mail/senha* (equipe).
3. **Firestore** e **Storage**: crie e publique `firestore.rules` e `storage.rules`.
4. Crie os usuários da equipe em Authentication e, para cada um, um documento `usuarios/{uid}`:
   `{ "nome": "Fulano", "papel": "gestao" }` — papéis: `operador`, `gestao`, `financeiro`.
5. Cole o `firebaseConfig` em `config.js`.
   *Storage é opcional:* com `usarStorage: false` (padrão) os áudios vão para o Firestore e tudo roda no plano gratuito, com áudio de até 1 minuto. Ao contratar o Blaze, ative o Storage, publique `storage.rules` e troque para `true`.
6. Authentication > Configurações > Domínios autorizados: adicione o domínio do Vercel.

## Publicar (GitHub + Vercel)

```bash
git init && git add . && git commit -m "Severo v0.1"
git remote add origin git@github.com:SEU_USUARIO/severo-app.git
git push -u origin main
```

No Vercel: *Add New Project* > importe o repositório > Framework: **Other** > Deploy. Cada `git push` publica uma versão nova; os motoristas recebem na próxima abertura.

## Pendências conhecidas (próximas etapas)

- Verificação do telefone por SMS (Firebase Phone Auth) no lugar do login anônimo.
- Notificações push (Firebase Cloud Messaging + Cloud Function ao mudar a situação).
- Vencimento automático no servidor (Cloud Function agendada); hoje o vencimento é calculado na tela.
- Cadastro de documentos com upload e validade; aprovação do cadastro do motorista.
- Distância aproximada (geocodificar cidades das cargas).
- Transcrição de áudio (etapa com preço separado).
- Logo em alta resolução / SVG.
- Geocodificação reversa usa o Nominatim (OpenStreetMap), com limite de uso; trocar por serviço pago se o volume crescer.
