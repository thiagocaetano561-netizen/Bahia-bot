# BAHIA LT - Bot Discord

Bot de gerenciamento de notas fiscais e motoristas para servidores Discord.

## Funcionalidades

- Sistema de registro de motoristas com aprovação administrativa
- Geração de crachás virtuais personalizados
- Envio e aprovação de notas fiscais
- Ranking de motoristas por ganhos
- Sistema de logs de ações

## Comandos Disponíveis

### Para Motoristas
- `!registrar` - Cadastrar-se como motorista
- `!cracha` ou `!crachá` - Gerar crachá virtual
- `!nf ORIGEM DESTINO CARGA KM VALOR` - Enviar nota fiscal
- `!minhas` - Ver suas viagens aprovadas
- `!ranking` - Ver ranking de motoristas
- `!ajuda` - Ver lista completa de comandos

### Para Administradores
- `!pendentes` - Ver notas fiscais pendentes
- `!registros-pendentes` - Ver registros de motoristas pendentes
- `!motoristas` - Listar motoristas ativos
- `!desativar-motorista ID` - Desativar motorista

## Instalação Local

1. Clone o repositório:
```bash
git clone <URL_DO_SEU_REPOSITORIO>
cd bahialt-bot
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
   - Copie o arquivo `.env.example` para `.env`
   - Preencha com suas credenciais:
```env
DISCORD_TOKEN=seu_token_do_bot
CANAL_NOTAS=id_do_canal_de_notas
CANAL_APROVACAO=id_do_canal_de_aprovacao
```

4. Execute o bot:
```bash
npm start
```

## Como obter o Token do Discord

1. Acesse [Discord Developer Portal](https://discord.com/developers/applications)
2. Crie uma nova aplicação (ou selecione uma existente)
3. Vá em "Bot" no menu lateral
4. Copie o Token (ou clique em "Reset Token")
5. Em "Privileged Gateway Intents", ative:
   - Message Content Intent
   - Server Members Intent

## Como obter IDs dos Canais

1. Ative o Modo Desenvolvedor no Discord (Configurações > Avançado > Modo Desenvolvedor)
2. Clique com botão direito no canal desejado
3. Selecione "Copiar ID"

## Deploy em Hosting 24/7

### Opção 1: Shard Cloud (Recomendado para Discord Bots)

1. Acesse [shardcloud.app](https://shardcloud.app) e crie uma conta
2. Faça o upload do projeto ou conecte via GitHub:
   - **Via Upload Manual:**
     - Compacte a pasta do projeto (sem node_modules)
     - Faça upload do arquivo .zip no painel do Shard Cloud

   - **Via GitHub:**
     - Conecte sua conta GitHub
     - Selecione o repositório `bahialt-bot`

3. Configure as variáveis de ambiente no painel:
   - `DISCORD_TOKEN` = seu_token_do_bot
   - `CANAL_NOTAS` = id_do_canal_de_notas
   - `CANAL_APROVACAO` = id_do_canal_de_aprovacao

4. Configure o comando de inicialização:
   - Start Command: `npm start`
   - ou: `node index.js`

5. Inicie o bot e ele ficará online 24/7!

**Notas importantes para Shard Cloud:**
- O banco de dados SQLite será mantido automaticamente
- Os dados persistem entre restarts
- Monitoramento automático de uptime

### Opção 2: Railway.app

1. Acesse [Railway.app](https://railway.app)
2. Conecte sua conta GitHub
3. Crie um novo projeto a partir do repositório
4. Adicione as variáveis de ambiente no painel do Railway:
   - `DISCORD_TOKEN`
   - `CANAL_NOTAS`
   - `CANAL_APROVACAO`
5. O deploy será automático!

### Opção 3: Render.com

1. Acesse [Render.com](https://render.com)
2. Conecte sua conta GitHub
3. Crie um novo Web Service
4. Selecione o repositório
5. Configure:
   - Build Command: `npm install`
   - Start Command: `npm start`
6. Adicione as variáveis de ambiente
7. Deploy!

### Opção 4: Heroku

1. Instale o [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
2. Faça login:
```bash
heroku login
```

3. Crie um app:
```bash
heroku create nome-do-seu-bot
```

4. Configure as variáveis de ambiente:
```bash
heroku config:set DISCORD_TOKEN=seu_token
heroku config:set CANAL_NOTAS=id_canal
heroku config:set CANAL_APROVACAO=id_canal
```

5. Faça deploy:
```bash
git push heroku main
```

## Estrutura do Banco de Dados

O bot utiliza SQLite com as seguintes tabelas:
- `motoristas_pendentes` - Solicitações de registro aguardando aprovação
- `motoristas_aprovados` - Motoristas credenciados
- `viagens_pendentes` - Notas fiscais aguardando aprovação
- `viagens` - Viagens aprovadas
- `ranking` - Estatísticas dos motoristas
- `logs` - Registro de ações administrativas

## Tecnologias Utilizadas

- [Discord.js v14](https://discord.js.org/) - Biblioteca para Discord
- [SQLite3](https://github.com/TryGhost/node-sqlite3) - Banco de dados
- [Canvas](https://github.com/Automattic/node-canvas) - Geração de imagens para crachás
- [dotenv](https://github.com/motdotla/dotenv) - Gerenciamento de variáveis de ambiente

## Licença

ISC

## Autor

Thiago3402

## Suporte

Para dúvidas ou problemas, abra uma issue no GitHub.
