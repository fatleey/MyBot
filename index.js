require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
console.log("🚀 Bot başlatılıyor...");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// --- AYARLAR ---
const levelRoles = {
    10: "1500546541230887052",
    20: "1500546573422034954",
    30: "1500546651654455315",
    40: "1500546687599378463",
    50: "1500546720671596676"
};

function getXpForLevel(level) {
    if (level <= 0) return 0;
    if (level <= 10) return level * 10;
    if (level <= 20) return 100 + (level - 10) * (level - 10) * 14; 
    return 1500 + (level - 20) * 250;
}

function formatVoiceTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h} saat, ${m} dakika`;
}

// --- SES TAKİBİ ---
client.on('voiceStateUpdate', (oldState, newState) => {
    const userId = newState.id;
    if (!oldState.channelId && newState.channelId) {
        voiceData.set(userId, Date.now());
    } else if (oldState.channelId && !newState.channelId) {
        const joinTime = voiceData.get(userId);
        if (joinTime) {
            const timeSpent = Math.floor((Date.now() - joinTime) / 1000);
            db.run("UPDATE users SET voiceTime = voiceTime + ? WHERE userId = ?", [timeSpent, userId]);
            voiceData.delete(userId);
        }
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    const userId = message.author.id;
    const prefix = "!";

    // 1. PROFİL
    if (message.content === `${prefix}fatiprofil`) {
        db.get("SELECT * FROM users WHERE userId = ?", [userId], (err, row) => {
            const profileEmbed = new EmbedBuilder()
                .setAuthor({ name: `${message.author.username} Profili`, iconURL: message.author.displayAvatarURL() })
                .setThumbnail(message.author.displayAvatarURL({ size: 256 }))
                .setColor("#ffffff")
                .addFields(
                    { name: "📊 Seviye", value: `**${row?.level || 0}**`, inline: true },
                    { name: "✨ Toplam XP", value: `\`${row?.xp || 0} XP\``, inline: true },
                    { name: "🎙️ Ses Süresi", value: `\`${formatVoiceTime(row?.voiceTime || 0)}\``, inline: false }
                );
            message.channel.send({ embeds: [profileEmbed] });
        });
        return;
    }

    // 2. BOARD (SIRALAMA)
    if (message.content === `${prefix}fatiboard`) {
        db.all("SELECT userId, xp, level FROM users ORDER BY xp DESC LIMIT 10", [], (err, rows) => {
            const embed = new EmbedBuilder()
                .setTitle("🏆 FatiBoard Sıralaması")
                .setColor("#ffffff")
                .setDescription(rows.map((row, i) => `**${i + 1}.** <@${row.userId}> - Lvl: ${row.level} (\`${row.xp} XP\`)`).join("\n") || "Veri yok.");
            message.channel.send({ embeds: [embed] });
        });
        return;
    }

    // 3. XP LİSTESİ (SAYFALI)
    if (message.content === `${prefix}fatixplvl`) {
        const generateEmbed = (start) => {
            let desc = "";
            for (let i = start; i < start + 10; i++) desc += `**Lvl ${i}:** \`${getXpForLevel(i)} XP\`\n`;
            return new EmbedBuilder().setTitle("📊 Seviye Tablosu").setDescription(desc).setColor("#ffffff");
        };
        let currentStart = 1;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('prev').setLabel('◀️').setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('next').setLabel('▶️').setStyle(ButtonStyle.Secondary)
        );
        const msg = await message.channel.send({ embeds: [generateEmbed(1)], components: [row] });
        const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });
        collector.on('collect', async i => {
            if (i.user.id !== message.author.id) return;
            if (i.customId === 'next') currentStart += 10; else currentStart -= 10;
            const newRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('prev').setLabel('◀️').setStyle(ButtonStyle.Secondary).setDisabled(currentStart === 1),
                new ButtonBuilder().setCustomId('next').setLabel('▶️').setStyle(ButtonStyle.Secondary).setDisabled(currentStart === 41)
            );
            await i.update({ embeds: [generateEmbed(currentStart)], components: [newRow] });
        });
        return;
    }

    // 4. EĞLENCE & BİLGİ
    if (message.content === `${prefix}fatisahip`) return message.channel.send("👑 Sahibim **@fatleey**'dir!");
    if (message.content === `${prefix}fatiyazıtura`) {
        const msg = await message.channel.send("🪙 Yazı tura hesaplanıyor...");
        setTimeout(() => { msg.edit(`🪙 Sonuç: **${Math.random() < 0.5 ? "YAZI" : "TURA"}**`); }, 2000);
        return;
    }

    // 5. YARDIM (GÜNCELLENDİ)
    if (message.content === `${prefix}fatiyardım` || message.content === `${prefix}fatiyardim`) {
        const helpEmbed = new EmbedBuilder()
            .setTitle("❓ FatiBot Tüm Komutlar")
            .setColor("#ffffff")
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                { name: "👤 Kullanıcı Komutları", value: 
                    "**!fatiprofil**: Profil kartını, seviyeni ve toplam ses süreni gösterir.\n" +
                    "**!fatiboard**: Sunucudaki en yüksek XP'li 10 kişiyi listeler.\n" +
                    "**!fatixplvl**: Seviye atlamak için gereken XP tablosunu gösterir (Sayfalı)." 
                },
                { name: "🎮 Eğlence & Bilgi", value: 
                    "**!fatiyazıtura**: Şansını dene, yazı mı tura mı?\n" +
                    "**!fatisahip**: Botun gerçek sahibini (fatleey) gösterir." 
                },
                { name: "🛡️ Yönetici Komutları", value: 
                    "**!fatimsil [sayı]**: Belirtilen sayıda mesajı kanaldan siler.\n" +
                    "**!fatiekle @üye [miktar]**: Belirtilen kişiye manuel XP ekler.\n" +
                    "**!fatisıfırla**: Tüm sıralamayı ve seviyeleri temizlemek için onay ister." 
                }
            )
            .setFooter({ text: "FatiBot • Her mesaj 1 XP kazandırır!" })
            .setTimestamp();

        return message.channel.send({ embeds: [helpEmbed] });
    }

    // 6. ADMIN (EKLE, SIFIRLA & SİL)
    if (message.content.startsWith(`${prefix}fatiekle`)) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const args = message.content.split(" ");
        const target = message.mentions.members.first();
        const amount = parseInt(args[2]);
        if (!target || isNaN(amount)) return;
        db.get("SELECT * FROM users WHERE userId = ?", [target.id], (err, row) => {
            let newXp = (row?.xp || 0) + amount;
            let newLevel = 0; while (getXpForLevel(newLevel + 1) <= newXp) newLevel++;
            db.run("INSERT OR REPLACE INTO users (userId, xp, level, voiceTime) VALUES (?, ?, ?, COALESCE((SELECT voiceTime FROM users WHERE userId = ?), 0))", [target.id, newXp, newLevel, target.id]);
            message.channel.send(`✅ ${target} kullanıcısına **${amount} XP** eklendi!`);
        });
        return;
    }

    if (message.content === `${prefix}fatisıfırla`) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        resetConfirmation.add(userId);
        return message.reply("⚠️ Sıralama sıfırlansın mı? **!evet** yaz.");
    }

    if (message.content === `${prefix}evet` && resetConfirmation.has(userId)) {
        db.run("DELETE FROM users", () => { resetConfirmation.delete(userId); message.channel.send("🧹 Sıfırlandı!"); });
        return;
    }

    // YENİ: MESAJ SİLME KOMUTU
    if (message.content.startsWith(`${prefix}fatimsil`)) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return;
        const args = message.content.split(" ");
        const miktar = parseInt(args[1]);

        if (isNaN(miktar) || miktar < 1 || miktar > 100) {
            return message.reply("⚠️ Lütfen silmek istediğin mesaj sayısını gir (1-100 arası). Örnek: `!fatimsil 15`").then(msg => setTimeout(() => msg.delete(), 5000));
        }

        await message.delete(); // Komutun kendisini sil
        message.channel.bulkDelete(miktar, true).then(silinenler => {
            message.channel.send(`🧹 **${silinenler.size}** mesaj başarıyla silindi!`).then(msg => setTimeout(() => msg.delete(), 3000));
        }).catch(err => {
            console.error(err);
            message.channel.send("❌ Mesajlar silinirken bir hata oluştu (14 günden eski mesajlar silinemez).");
        });
        return;
    }

    // --- MESAJ XP ---
    db.get("SELECT * FROM users WHERE userId = ?", [userId], (err, row) => {
        let nXp = (row?.xp || 0) + 1;
        let nLvl = row?.level || 0;
        if (nXp >= getXpForLevel(nLvl + 1)) {
            nLvl++;
            const chan = message.guild.channels.cache.find(c => c.name === "✨∖「seviye」");
            if (chan) chan.send(`🆙 <@${userId}> seviye **${nLvl}** oldu!`);
        }
        db.run("INSERT OR REPLACE INTO users (userId, xp, level, voiceTime) VALUES (?, ?, ?, COALESCE((SELECT voiceTime FROM users WHERE userId = ?), 0))", [userId, nXp, nLvl, userId]);
    });
});

client.once('ready', () => {
    console.log(`✅ Giriş başarılı: ${client.user.tag}`);
});

client.login(process.env.TOKEN);
