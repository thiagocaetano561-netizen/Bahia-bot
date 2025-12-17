// index.js
require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits, AttachmentBuilder } = require("discord.js");
const sqlite3 = require("sqlite3").verbose();
const Canvas = require("@napi-rs/canvas");
const db = new sqlite3.Database("./bahialt.db");

const TOKEN = process.env.DISCORD_TOKEN;
const CANAL_NOTAS = process.env.CANAL_NOTAS;
const CANAL_APROVACAO = process.env.CANAL_APROVACAO;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
});

// Função para inicializar/atualizar banco de dados
function inicializarBanco() {
    db.get("PRAGMA table_info(viagens)", (err, info) => {
        if (!err && info) {
            db.get("SELECT motorista_id FROM viagens LIMIT 1", (checkErr) => {
                if (checkErr) {
                    console.log("⚠️ Migrando banco de dados antigo...");
                    db.run("ALTER TABLE viagens RENAME TO viagens_old");
                    db.run("ALTER TABLE ranking RENAME TO ranking_old");
                    criarTabelas();
                } else {
                    console.log("✅ Banco de dados atualizado!");
                }
            });
        } else {
            criarTabelas();
        }
    });
}

function criarTabelas() {
    db.run(`
        CREATE TABLE IF NOT EXISTS viagens_pendentes(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            motorista TEXT,
            motorista_id TEXT,
            origem TEXT,
            destino TEXT,
            carga TEXT,
            distancia INTEGER,
            valor REAL,
            data TEXT DEFAULT (datetime('now','localtime')),
            status TEXT DEFAULT 'pendente'
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS viagens(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            motorista TEXT,
            motorista_id TEXT,
            origem TEXT,
            destino TEXT,
            carga TEXT,
            distancia INTEGER,
            valor REAL,
            data TEXT,
            aprovado_por TEXT,
            data_aprovacao TEXT DEFAULT (datetime('now','localtime'))
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS ranking(
            motorista TEXT,
            motorista_id TEXT PRIMARY KEY,
            viagens INTEGER DEFAULT 0,
            ganhos REAL DEFAULT 0
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS logs(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            acao TEXT,
            motorista TEXT,
            admin TEXT,
            detalhes TEXT,
            data TEXT DEFAULT (datetime('now','localtime'))
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS motoristas_pendentes(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id TEXT,
            usuario_nome TEXT,
            nome_completo TEXT,
            cpf TEXT,
            cnh TEXT,
            telefone TEXT,
            cidade TEXT,
            veiculo_placa TEXT,
            veiculo_modelo TEXT,
            data_solicitacao TEXT DEFAULT (datetime('now','localtime')),
            status TEXT DEFAULT 'pendente'
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS motoristas_aprovados(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id TEXT UNIQUE,
            usuario_nome TEXT,
            nome_completo TEXT,
            cpf TEXT,
            cnh TEXT,
            telefone TEXT,
            cidade TEXT,
            veiculo_placa TEXT,
            veiculo_modelo TEXT,
            aprovado_por TEXT,
            data_aprovacao TEXT DEFAULT (datetime('now','localtime')),
            data_registro TEXT,
            status TEXT DEFAULT 'ativo'
        )
    `, () => {
        console.log("✅ Tabelas criadas/atualizadas com sucesso!");
    });
}

inicializarBanco();

client.on("ready", () => {
    console.log(`Bot ligado como ${client.user.tag}`);
});

client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return;
    if (!msg.content.startsWith("!")) return;
    
    const args = msg.content.slice(1).trim().split(/\s+/);
    const cmd = args.shift().toLowerCase();

    if (cmd === "registrar") {
        const usuarioId = msg.author.id;
        const usuarioNome = msg.author.username;

        db.get(`SELECT * FROM motoristas_aprovados WHERE usuario_id = ?`, [usuarioId], (err, aprovado) => {
            if (aprovado) {
                return msg.reply("❌ Você já está registrado como motorista!");
            }

            db.get(`SELECT * FROM motoristas_pendentes WHERE usuario_id = ? AND status = 'pendente'`, [usuarioId], (err, pendente) => {
                if (pendente) {
                    return msg.reply("⏳ Você já tem uma solicitação de registro pendente! Aguarde a aprovação de um administrador.");
                }

                msg.reply(`📋 **FORMULÁRIO DE REGISTRO DE MOTORISTA**

Por favor, envie suas informações no seguinte formato:

\`\`\`
Nome Completo: Seu Nome Aqui
CPF: 000.000.000-00
CNH: 00000000000
Telefone: (00) 00000-0000
Cidade: Sua Cidade
Placa do Veículo: ABC1D23
Modelo do Veículo: Scania R450
\`\`\`

Você tem **5 minutos** para enviar as informações.`);

                const filter = m => m.author.id === usuarioId;
                const collector = msg.channel.createMessageCollector({ filter, time: 300000, max: 1 });

                collector.on('collect', async m => {
                    const conteudo = m.content;
                    const nomeMatch = conteudo.match(/Nome Completo:\s*(.+)/i);
                    const cpfMatch = conteudo.match(/CPF:\s*(.+)/i);
                    const cnhMatch = conteudo.match(/CNH:\s*(.+)/i);
                    const telefoneMatch = conteudo.match(/Telefone:\s*(.+)/i);
                    const cidadeMatch = conteudo.match(/Cidade:\s*(.+)/i);
                    const placaMatch = conteudo.match(/Placa.*?:\s*(.+)/i);
                    const modeloMatch = conteudo.match(/Modelo.*?:\s*(.+)/i);

                    if (!nomeMatch || !cpfMatch || !cnhMatch || !telefoneMatch || !cidadeMatch || !placaMatch || !modeloMatch) {
                        return m.reply("❌ Formato inválido! Use o formato exato mostrado no exemplo.");
                    }

                    const dados = {
                        nomeCompleto: nomeMatch[1].trim(),
                        cpf: cpfMatch[1].trim(),
                        cnh: cnhMatch[1].trim(),
                        telefone: telefoneMatch[1].trim(),
                        cidade: cidadeMatch[1].trim(),
                        placa: placaMatch[1].trim().toUpperCase(),
                        modelo: modeloMatch[1].trim()
                    };

                    db.run(
                        `INSERT INTO motoristas_pendentes(usuario_id, usuario_nome, nome_completo, cpf, cnh, telefone, cidade, veiculo_placa, veiculo_modelo)
                         VALUES (?,?,?,?,?,?,?,?,?)`,
                        [usuarioId, usuarioNome, dados.nomeCompleto, dados.cpf, dados.cnh, dados.telefone, dados.cidade, dados.placa, dados.modelo],
                        function(err) {
                            if (err) {
                                console.error(err);
                                return m.reply("❌ Erro ao processar registro.");
                            }

                            const registroId = this.lastID;
                            const canalAprovacao = msg.guild.channels.cache.get(CANAL_APROVACAO);
                            if (canalAprovacao) {
                                const embed = new EmbedBuilder()
                                    .setTitle("🆕 SOLICITAÇÃO DE REGISTRO DE MOTORISTA")
                                    .setColor("Orange")
                                    .setDescription(`**ID:** #${registroId}\n📋 Aguardando aprovação de administrador`)
                                    .addFields(
                                        { name: "👤 Usuário Discord", value: `<@${usuarioId}> (${usuarioNome})`, inline: false },
                                        { name: "📛 Nome Completo", value: dados.nomeCompleto, inline: true },
                                        { name: "🆔 CPF", value: dados.cpf, inline: true },
                                        { name: "🪪 CNH", value: dados.cnh, inline: true },
                                        { name: "📱 Telefone", value: dados.telefone, inline: true },
                                        { name: "🏙️ Cidade", value: dados.cidade, inline: true },
                                        { name: "🚚 Veículo", value: `${dados.modelo}\n**Placa:** ${dados.placa}`, inline: false }
                                    )
                                    .setTimestamp();

                                const aprovar = new ButtonBuilder()
                                    .setCustomId(`aprovar_registro_${registroId}`)
                                    .setLabel("✅ Aprovar Motorista")
                                    .setStyle(ButtonStyle.Success);

                                const reprovar = new ButtonBuilder()
                                    .setCustomId(`reprovar_registro_${registroId}`)
                                    .setLabel("❌ Reprovar")
                                    .setStyle(ButtonStyle.Danger);

                                const row = new ActionRowBuilder().addComponents(aprovar, reprovar);
                                canalAprovacao.send({ embeds: [embed], components: [row] });
                            }

                            m.reply(`✅ **Solicitação de registro enviada com sucesso!**\n\n**ID:** #${registroId}\n⏳ Aguarde a aprovação de um administrador.`);
                        }
                    );
                });

                collector.on('end', collected => {
                    if (collected.size === 0) {
                        msg.reply("⏰ Tempo esgotado! Use `!registrar` novamente para tentar.");
                    }
                });
            });
        });
    }

    if (cmd === "cracha" || cmd === "crachá") {
        const usuarioId = msg.author.id;

        db.get(`SELECT * FROM motoristas_aprovados WHERE usuario_id = ?`, [usuarioId], async (err, motorista) => {
            if (!motorista) {
                return msg.reply("❌ Você não está registrado como motorista! Use `!registrar` para se cadastrar.");
            }

            if (motorista.status !== 'ativo') {
                return msg.reply("❌ Seu registro está inativo. Contate um administrador.");
            }

            await msg.reply("🎨 Gerando seu crachá virtual...");

            try {
                const cracha = await gerarCracha(motorista, msg.author);
                const attachment = new AttachmentBuilder(cracha, { name: 'cracha.png' });

                const embed = new EmbedBuilder()
                    .setTitle("🎫 SEU CRACHÁ VIRTUAL - BAHIA LT")
                    .setColor("Green")
                    .setDescription(`**${motorista.nome_completo}**\nMotorista Credenciado`)
                    .setImage('attachment://cracha.png')
                    .addFields(
                        { name: "📛 Matrícula", value: `#${motorista.id.toString().padStart(5, '0')}`, inline: true },
                        { name: "🏙️ Cidade", value: motorista.cidade, inline: true },
                        { name: "🚚 Veículo", value: motorista.veiculo_placa, inline: true }
                    )
                    .setFooter({ text: `Registrado em ${new Date(motorista.data_registro).toLocaleDateString('pt-BR')}` })
                    .setTimestamp();

                msg.reply({ embeds: [embed], files: [attachment] });
            } catch (error) {
                console.error("Erro ao gerar crachá:", error);
                msg.reply("❌ Erro ao gerar crachá. Tente novamente.");
            }
        });
    }

    if (cmd === "registros-pendentes" || cmd === "regpendentes") {
        if (!msg.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return msg.reply("❌ Apenas administradores podem ver registros pendentes.");
        }

        db.all(`SELECT * FROM motoristas_pendentes WHERE status = 'pendente' ORDER BY id DESC`, (err, rows) => {
            if (err || !rows || rows.length === 0) {
                return msg.reply("✅ Não há registros pendentes no momento.");
            }

            let texto = "";
            rows.forEach(r => {
                texto += `**#${r.id}** - ${r.nome_completo} | CPF: ${r.cpf} | ${r.cidade} | ${r.veiculo_modelo} (${r.veiculo_placa})\n`;
            });

            const embed = new EmbedBuilder()
                .setTitle("⏳ REGISTROS DE MOTORISTAS PENDENTES")
                .setColor("Orange")
                .setDescription(texto || "Nenhum registro pendente.")
                .setTimestamp();

            msg.reply({ embeds: [embed] });
        });
    }

    if (cmd === "motoristas") {
        if (!msg.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return msg.reply("❌ Apenas administradores podem ver a lista de motoristas.");
        }

        db.all(`SELECT * FROM motoristas_aprovados WHERE status = 'ativo' ORDER BY id ASC`, (err, rows) => {
            if (err || !rows || rows.length === 0) {
                return msg.reply("📋 Nenhum motorista registrado ainda.");
            }

            let texto = "";
            rows.forEach(r => {
                texto += `**#${r.id.toString().padStart(5, '0')}** - ${r.nome_completo} | ${r.cidade} | ${r.veiculo_modelo} (${r.veiculo_placa})\n`;
            });

            const embed = new EmbedBuilder()
                .setTitle("🚚 MOTORISTAS CADASTRADOS - BAHIA LT")
                .setColor("Blue")
                .setDescription(texto)
                .setFooter({ text: `Total: ${rows.length} motoristas ativos` })
                .setTimestamp();

            msg.reply({ embeds: [embed] });
        });
    }

    if (cmd === "desativar-motorista") {
        if (!msg.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return msg.reply("❌ Apenas administradores podem desativar motoristas.");
        }

        const motoristaId = args[0];
        if (!motoristaId) {
            return msg.reply("❌ Use: `!desativar-motorista ID`");
        }

        db.run(`UPDATE motoristas_aprovados SET status = 'inativo' WHERE id = ?`, [motoristaId], function(err) {
            if (err || this.changes === 0) {
                return msg.reply("❌ Motorista não encontrado.");
            }

            msg.reply(`✅ Motorista #${motoristaId} desativado com sucesso!`);
        });
    }

    if (cmd === "nf") {
        const motorista = msg.author.username;
        const motoristaId = msg.author.id;
        const origem = args[0];
        const destino = args[1];
        const carga = args[2];
        const distancia = Number(args[3]);
        const valor = Number(args[4]);

        if (!origem || !destino || !carga || !distancia || !valor) {
            return msg.reply("❌ **Uso correto:** `!nf ORIGEM DESTINO CARGA KM VALOR`\n**Exemplo:** `!nf Salvador Recife Madeira 850 1500`");
        }

        if (isNaN(distancia) || isNaN(valor) || distancia <= 0 || valor <= 0) {
            return msg.reply("❌ Distância e valor devem ser números positivos!");
        }

        db.run(
            `INSERT INTO viagens_pendentes(motorista, motorista_id, origem, destino, carga, distancia, valor)
             VALUES (?,?,?,?,?,?,?)`,
            [motorista, motoristaId, origem, destino, carga, distancia, valor],
            function(err) {
                if (err) {
                    console.error(err);
                    return msg.reply("❌ Erro ao registrar nota fiscal.");
                }

                const notaId = this.lastID;
                const canalAprovacao = msg.guild.channels.cache.get(CANAL_APROVACAO);
                if (canalAprovacao) {
                    const embed = new EmbedBuilder()
                        .setTitle("⏳ NOTA FISCAL PENDENTE — BAHIA LT")
                        .setColor("Orange")
                        .setDescription(`**ID da Nota:** #${notaId}\n\n📋 Aguardando aprovação de administrador`)
                        .addFields(
                            { name: "👤 Motorista", value: motorista, inline: true },
                            { name: "📍 Origem", value: origem, inline: true },
                            { name: "📍 Destino", value: destino, inline: true },
                            { name: "📦 Carga", value: carga, inline: true },
                            { name: "🛣️ Distância", value: `${distancia} km`, inline: true },
                            { name: "💵 Valor", value: `R$ ${valor.toFixed(2)}`, inline: true }
                        )
                        .setTimestamp();

                    const aprovar = new ButtonBuilder()
                        .setCustomId(`aprovar_nf_${notaId}`)
                        .setLabel("✅ Aprovar")
                        .setStyle(ButtonStyle.Success);

                    const reprovar = new ButtonBuilder()
                        .setCustomId(`reprovar_nf_${notaId}`)
                        .setLabel("❌ Reprovar")
                        .setStyle(ButtonStyle.Danger);

                    const row = new ActionRowBuilder().addComponents(aprovar, reprovar);
                    canalAprovacao.send({ embeds: [embed], components: [row] });
                }

                msg.reply(`✅ Nota fiscal #${notaId} enviada para aprovação! Aguarde um administrador validar.`);
            }
        );
    }

    if (cmd === "pendentes") {
        if (!msg.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return msg.reply("❌ Apenas administradores podem ver notas pendentes.");
        }

        db.all(`SELECT * FROM viagens_pendentes WHERE status = 'pendente' ORDER BY id DESC`, (err, rows) => {
            if (err || !rows || rows.length === 0) {
                return msg.reply("✅ Não há notas pendentes no momento.");
            }

            let texto = "";
            rows.forEach(r => {
                texto += `**#${r.id}** - ${r.motorista} | ${r.origem} → ${r.destino} | ${r.carga} | ${r.distancia}km | R$ ${r.valor.toFixed(2)}\n`;
            });

            const embed = new EmbedBuilder()
                .setTitle("⏳ NOTAS FISCAIS PENDENTES")
                .setColor("Orange")
                .setDescription(texto || "Nenhuma nota pendente.")
                .setTimestamp();

            msg.reply({ embeds: [embed] });
        });
    }

    if (cmd === "ranking") {
        db.all(`SELECT * FROM ranking ORDER BY ganhos DESC LIMIT 10`, (err, rows) => {
            if (err || !rows || rows.length === 0) {
                return msg.reply("📊 Nenhum registro encontrado no ranking ainda.");
            }

            let texto = "";
            let pos = 1;
            const medals = ["🥇", "🥈", "🥉"];
            rows.forEach(r => {
                const medal = pos <= 3 ? medals[pos - 1] : `**${pos}º**`;
                texto += `${medal} **${r.motorista}** | 🚚 ${r.viagens} viagens | 💰 R$ ${r.ganhos.toFixed(2)}\n`;
                pos++;
            });

            const embed = new EmbedBuilder()
                .setTitle("🏆 RANKING DE MOTORISTAS — BAHIA LT")
                .setColor("Gold")
                .setDescription(texto)
                .setFooter({ text: "Top 10 motoristas por ganhos totais" })
                .setTimestamp();

            msg.reply({ embeds: [embed] });
        });
    }

    if (cmd === "minhas") {
        const motoristaId = msg.author.id;
        
        db.all(
            `SELECT * FROM viagens WHERE motorista_id = ? ORDER BY data_aprovacao DESC LIMIT 10`,
            [motoristaId],
            (err, rows) => {
                if (err || !rows || rows.length === 0) {
                    return msg.reply("📋 Você ainda não tem viagens aprovadas.");
                }

                let texto = "";
                let totalViagens = 0;
                let totalGanhos = 0;

                rows.forEach(r => {
                    texto += `**#${r.id}** | ${r.origem} → ${r.destino} | R$ ${r.valor.toFixed(2)}\n`;
                    totalViagens++;
                    totalGanhos += r.valor;
                });

                const embed = new EmbedBuilder()
                    .setTitle("🚚 MINHAS VIAGENS — BAHIA LT")
                    .setColor("Green")
                    .setDescription(texto)
                    .addFields(
                        { name: "Total de Viagens", value: `${totalViagens}`, inline: true },
                        { name: "Total de Ganhos", value: `R$ ${totalGanhos.toFixed(2)}`, inline: true }
                    )
                    .setTimestamp();

                msg.reply({ embeds: [embed] });
            }
        );
    }

    if (cmd === "ajuda" || cmd === "help") {
        const embed = new EmbedBuilder()
            .setTitle("📖 COMANDOS DO BOT — BAHIA LT")
            .setColor("Blue")
            .setDescription("Sistema de gerenciamento de notas fiscais e motoristas")
            .addFields(
                { name: "👤 Registro de Motorista", value: "`!registrar` - Cadastrar-se como motorista\n`!cracha` - Gerar seu crachá virtual" },
                { name: "🧾 Notas Fiscais", value: "`!nf ORIGEM DESTINO CARGA KM VALOR` - Enviar nota fiscal\n`!minhas` - Ver suas viagens aprovadas\n`!ranking` - Ver ranking de motoristas" },
                { name: "⚙️ Admin", value: "`!pendentes` - Ver notas pendentes\n`!registros-pendentes` - Ver registros pendentes\n`!motoristas` - Listar motoristas ativos\n`!desativar-motorista ID` - Desativar motorista" }
            )
            .setFooter({ text: "Todas as ações precisam ser aprovadas por administradores" });

        msg.reply({ embeds: [embed] });
    }
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: "❌ Apenas administradores podem aprovar/reprovar.", ephemeral: true });
    }

    const [acao, tipo, id] = interaction.customId.split("_");

    if (tipo === "registro") {
        db.get(`SELECT * FROM motoristas_pendentes WHERE id = ? AND status = 'pendente'`, [id], async (err, registro) => {
            if (err || !registro) {
                return interaction.reply({ content: "❌ Registro não encontrado ou já foi processado.", ephemeral: true });
            }

            if (acao === "aprovar") {
                db.run(
                    `INSERT INTO motoristas_aprovados(usuario_id, usuario_nome, nome_completo, cpf, cnh, telefone, cidade, veiculo_placa, veiculo_modelo, aprovado_por, data_registro)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
                    [registro.usuario_id, registro.usuario_nome, registro.nome_completo, registro.cpf, registro.cnh, registro.telefone, registro.cidade, registro.veiculo_placa, registro.veiculo_modelo, interaction.user.username, registro.data_solicitacao],
                    async function(err) {
                        if (err) {
                            console.error(err);
                            return interaction.reply({ content: "❌ Erro ao aprovar motorista.", ephemeral: true });
                        }

                        const motoristaId = this.lastID;
                        db.run(`UPDATE motoristas_pendentes SET status = 'aprovado' WHERE id = ?`, [id]);

                        // Adicionar cargo de motorista (com tratamento de erro)
                        try {
                            const cargoMotorista = interaction.guild.roles.cache.find(role => role.name === "Motorista");
                            const membro = await interaction.guild.members.fetch(registro.usuario_id);
                            
                            if (cargoMotorista && membro) {
                                await membro.roles.add(cargoMotorista);
                                console.log(`✅ Cargo "Motorista" adicionado para ${registro.nome_completo}`);
                            } else if (!cargoMotorista) {
                                console.log("⚠️ Cargo 'Motorista' não encontrado no servidor");
                            }
                        } catch (erroRole) {
                            console.error("⚠️ Erro ao adicionar cargo (verifique hierarquia):", erroRole.message);
                            // Continua mesmo sem conseguir adicionar o cargo
                        }

                        try {
                            const usuario = await client.users.fetch(registro.usuario_id);
                            await usuario.send(`🎉 **PARABÉNS!**

Seu registro como motorista da **BAHIA LT** foi **APROVADO**!

**Matrícula:** #${motoristaId.toString().padStart(5, '0')}
**Nome:** ${registro.nome_completo}
**Aprovado por:** ${interaction.user.username}

Você já pode:
✅ Enviar notas fiscais com \`!nf\`
✅ Gerar seu crachá virtual com \`!cracha\`
✅ Ver seu ranking com \`!ranking\`

Bem-vindo à equipe! 🚚`);
                        } catch (e) {
                            console.log("Não foi possível enviar DM");
                        }

                        db.run(`INSERT INTO logs(acao, motorista, admin, detalhes) VALUES (?,?,?,?)`,
                            ['REGISTRO_APROVADO', registro.nome_completo, interaction.user.username, `Registro #${id} aprovado - Matrícula #${motoristaId}`]);

                        interaction.update({
                            embeds: [
                                EmbedBuilder.from(interaction.message.embeds[0])
                                    .setColor("Green")
                                    .setTitle("✅ MOTORISTA APROVADO - BAHIA LT")
                                    .setDescription(`**Matrícula:** #${motoristaId.toString().padStart(5, '0')}\n\n✅ Aprovado por ${interaction.user.username}`)
                            ],
                            components: []
                        });
                    }
                );

            } else if (acao === "reprovar") {
                db.run(`UPDATE motoristas_pendentes SET status = 'reprovado' WHERE id = ?`, [id]);

                try {
                    const usuario = await client.users.fetch(registro.usuario_id);
                    await usuario.send(`❌ **REGISTRO NÃO APROVADO**

Infelizmente seu registro como motorista da **BAHIA LT** não foi aprovado.

**Motivo:** Entre em contato com a administração para mais informações.

Você pode tentar novamente usando \`!registrar\` após corrigir as informações.`);
                } catch (e) {
                    console.log("Não foi possível enviar DM");
                }

                db.run(`INSERT INTO logs(acao, motorista, admin, detalhes) VALUES (?,?,?,?)`,
                    ['REGISTRO_REPROVADO', registro.nome_completo, interaction.user.username, `Registro #${id} reprovado`]);

                interaction.update({
                    embeds: [
                        EmbedBuilder.from(interaction.message.embeds[0])
                            .setColor("Red")
                            .setTitle("❌ REGISTRO REPROVADO - BAHIA LT")
                            .setDescription(`**ID:** #${id}\n\n❌ Reprovado por ${interaction.user.username}`)
                    ],
                    components: []
                });
            }
        });
    }

    if (tipo === "nf") {
        db.get(`SELECT * FROM viagens_pendentes WHERE id = ? AND status = 'pendente'`, [id], (err, nota) => {
            if (err || !nota) {
                return interaction.reply({ content: "❌ Nota não encontrada ou já foi processada.", ephemeral: true });
            }

            if (acao === "aprovar") {
                db.run(
                    `INSERT INTO viagens(motorista, motorista_id, origem, destino, carga, distancia, valor, data, aprovado_por)
                     VALUES (?,?,?,?,?,?,?,?,?)`,
                    [nota.motorista, nota.motorista_id, nota.origem, nota.destino, nota.carga, nota.distancia, nota.valor, nota.data, interaction.user.username]
                );

                db.run(`
                    INSERT INTO ranking(motorista, motorista_id, viagens, ganhos)
                    VALUES (?,?,1,?)
                    ON CONFLICT(motorista_id)
                    DO UPDATE SET viagens = viagens + 1, ganhos = ganhos + excluded.ganhos
                `, [nota.motorista, nota.motorista_id, nota.valor]);

                db.run(`UPDATE viagens_pendentes SET status = 'aprovada' WHERE id = ?`, [id]);

                db.run(`INSERT INTO logs(acao, motorista, admin, detalhes) VALUES (?,?,?,?)`,
                    ['APROVACAO', nota.motorista, interaction.user.username, `Nota #${id} aprovada`]);

                const canalNotas = interaction.guild.channels.cache.get(CANAL_NOTAS);
                if (canalNotas) {
                    const embed = new EmbedBuilder()
                        .setTitle("✅ NOTA FISCAL APROVADA — BAHIA LT")
                        .setColor("Green")
                        .setDescription(`**ID da Nota:** #${id}\n✅ Aprovada por ${interaction.user.username}`)
                        .addFields(
                            { name: "👤 Motorista", value: nota.motorista, inline: true },
                            { name: "📍 Origem", value: nota.origem, inline: true },
                            { name: "📍 Destino", value: nota.destino, inline: true },
                            { name: "📦 Carga", value: nota.carga, inline: true },
                            { name: "🛣️ Distância", value: `${nota.distancia} km`, inline: true },
                            { name: "💵 Valor", value: `R$ ${nota.valor.toFixed(2)}`, inline: true }
                        )
                        .setTimestamp();

                    canalNotas.send({ embeds: [embed] });
                }

                interaction.update({
                    embeds: [
                        EmbedBuilder.from(interaction.message.embeds[0])
                            .setColor("Green")
                            .setTitle("✅ NOTA FISCAL APROVADA — BAHIA LT")
                            .setDescription(`**ID da Nota:** #${id}\n\n✅ Aprovada por ${interaction.user.username}`)
                    ],
                    components: []
                });

            } else if (acao === "reprovar") {
                db.run(`UPDATE viagens_pendentes SET status = 'reprovada' WHERE id = ?`, [id]);

                db.run(`INSERT INTO logs(acao, motorista, admin, detalhes) VALUES (?,?,?,?)`,
                    ['REPROVACAO', nota.motorista, interaction.user.username, `Nota #${id} reprovada`]);

                interaction.update({
                    embeds: [
                        EmbedBuilder.from(interaction.message.embeds[0])
                            .setColor("Red")
                            .setTitle("❌ NOTA FISCAL REPROVADA — BAHIA LT")
                            .setDescription(`**ID da Nota:** #${id}\n\n❌ Reprovada por ${interaction.user.username}`)
                    ],
                    components: []
                });
            }
        });
    }
});

async function gerarCracha(motorista, usuario) {
    const canvas = Canvas.createCanvas(800, 500);
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, 0, 500);
    gradient.addColorStop(0, '#1e3a8a');
    gradient.addColorStop(1, '#3b82f6');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 500);

    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 8;
    ctx.strokeRect(20, 20, 760, 460);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('BAHIA LT', 400, 80);

    ctx.font = '24px Arial';
    ctx.fillText('CRACHÁ DE MOTORISTA', 400, 115);

    try {
        const avatarURL = usuario.displayAvatarURL({ extension: 'png', size: 256 });
        const response = await fetch(avatarURL);
        const buffer = await response.arrayBuffer();
        const image = await Canvas.loadImage(Buffer.from(buffer));
        
        ctx.save();
        ctx.beginPath();
        ctx.arc(400, 220, 80, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(image, 320, 140, 160, 160);
        ctx.restore();

        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(400, 220, 80, 0, Math.PI * 2);
        ctx.stroke();
    } catch (e) {
        console.error("Erro ao carregar avatar:", e);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(motorista.nome_completo.toUpperCase(), 400, 340);

    ctx.font = '20px Arial';
    ctx.fillText(`Matrícula: #${motorista.id.toString().padStart(5, '0')}`, 400, 375);

    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(150, 395);
    ctx.lineTo(650, 395);
    ctx.stroke();

    ctx.font = '18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`🏙️ Cidade: ${motorista.cidade}`, 150, 430);
    ctx.fillText(`🚚 Veículo: ${motorista.veiculo_modelo}`, 150, 455);
    
    ctx.textAlign = 'right';
    ctx.fillText(`📱 ${motorista.telefone}`, 650, 430);
    ctx.fillText(`🚗 Placa: ${motorista.veiculo_placa}`, 650, 455);

    return canvas.toBuffer('image/png');
}

client.login(TOKEN);