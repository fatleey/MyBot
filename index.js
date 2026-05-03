require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const mongoose = require('mongoose');

console.log("🚀 Bot başlatılıyor...");

// --- MONGODB BAĞLANTISI VE ŞEMA ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("🍃 MongoDB Bağlantısı Başarılı!"))
    .catch(err => console.error("❌ MongoDB Bağlantı Hatası:", err));

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 0 },
    voiceTime: { type: Number, default: 0 }
});

const User = mongoose.model('User', userSchema);

// --- CLIENT TANIMLAMA ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const resetConfirmation = new Set();
const voiceData = new Map();

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
client.on('voiceStateUpdate', async (oldState, newState) => {
    const userId = newState.id;
    if (!oldState.channelId && newState.channelId) {
        voiceData.set(userId, Date.now());
    } else if (oldState.channelId && !newState.channelId) {
        const joinTime = voiceData.get(userId);
        if (joinTime) {
            const timeSpent = Math.floor((Date.now() - joinTime) / 1000);
            await User.findOneAndUpdate(
                { userId },
                { $inc: { voiceTime: timeSpent } },
                { upsert: true }
            );
            voiceData.delete(userId);
        }
    }
});

// --- MESAJLAR VE KOMUTLAR ---
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    const userId = message.author.id;
    const prefix = "!";

    // XP KAZANMA SİSTEMİ (MongoDB)
    let userData = await User.findOne({ userId });
    if (!userData) {
        userData = new User({ userId });
    }

    userData.xp += 1;
    if (userData.xp >= getXpForLevel(userData.level + 1)) {
        userData.level += 1;
        const chan = message.guild.channels.cache.find(c => c.name === "✨∖「seviye」");
        if (chan) chan.send(`🆙 <@${userId}> seviye **${userData.level}** oldu!`);
    }
    await userData.save();

    // 1. PROFİL
    if (message.content === `${prefix}fatiprofil`) {
        const profileEmbed = new EmbedBuilder()
            .setAuthor({ name: `${message.author.username} Profili`, iconURL: message.author.displayAvatarURL() })
            .setThumbnail(message.author.displayAvatarURL({ size: 256 }))
            .setColor("#ffffff")
            .addFields(
                { name: "📊 Seviye", value: `**${userData.level}**`, inline: true },
                { name: "✨ Toplam XP", value: `\`${userData.xp} XP\``, inline: true },
                { name: "🎙️ Ses Süresi", value: `\`${formatVoiceTime(userData.voiceTime)}\``, inline: false }
            );
        return message.channel.send({ embeds: [profileEmbed] });
    }

    // 2. BOARD (SIRALAMA)
    if (message.content === `${prefix}fatiboard`) {
        const topUsers = await User.find().sort({ xp: -1 }).limit(10);
        const embed = new EmbedBuilder()
            .setTitle("🏆 FatiBoard Sıralaması")
            .setColor("#ffffff")
            .setDescription(topUsers.map((user, i) => `**${i + 1}.** <@${user.userId}> - Lvl: ${user.level} (\`${user.xp} XP\`)`).join("\n") || "Veri yok.");
        return message.channel.send({ embeds: [embed] });
    }

    // 3. YARDIM, YAZITURA VB. (DEĞİŞMEDİ)
    if (message.content === `${prefix}fatisahip`) return message.channel.send("👑 Sahibim **@fatleey**'dir!");
    
    if (message.content === `${prefix}fatiyazıtura`) {
        const msg = await message.channel.send("🪙 Yazı tura hesaplanıyor...");
        setTimeout(() => { msg.edit(`🪙 Sonuç: **${Math.random() < 0.5 ? "YAZI" : "TURA"}**`); }, 2000);
        return;
    // 5. YARDIM KOMUTU
    if (message.content === `${prefix}fatiyardım` || message.content === `${prefix}fatiyardim`) {
        const helpEmbed = new EmbedBuilder()
            .setTitle("❓ FatiBot Tüm Komutlar")
            .setColor("#ffffff")
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                { name: "👤 Kullanıcı Komutları", value: 
                    "**!fatiprofil**: Profilini, seviyeni ve ses süreni gösterir.\n" +
                    "**!fatiboard**: En yüksek XP'li 10 kişiyi listeler.\n" +
                    "**!fatixplvl**: Seviye XP tablosunu gösterir." 
                },
                { name: "🎮 Eğlence & Bilgi", value: 
                    "**!fatiyazıtura**: Yazı tura atar.\n" +
                    "**!fatisahip**: Botun sahibini gösterir." 
                },
                { name: "🛡️ Yönetici Komutları", value: 
                    "**!fatimsil [sayı]**: Mesajları toplu siler.\n" +
                    "**!fatisıfırla**: Verileri sıfırlamak için onay ister." 
                }
            )
            .setFooter({ text: "FatiBot • Her mesaj 1 XP kazandırır!" })
            .setTimestamp();

        return message.channel.send({ embeds: [helpEmbed] });
    }
    }

    // MESAJ SİLME
    if (message.content.startsWith(`${prefix}fatimsil`)) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return;
        const args = message.content.split(" ");
        const miktar = parseInt(args[1]);
        if (isNaN(miktar) || miktar < 1 || miktar > 100) return message.reply("1-100 arası sayı gir.");
        
        await message.delete();
        return message.channel.bulkDelete(miktar, true);
    }
});

client.once('ready', () => {
    console.log(`✅ Giriş başarılı: ${client.user.tag}`);
});

client.login(process.env.TOKEN);
