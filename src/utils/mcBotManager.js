const mineflayer = require('mineflayer');
let pathfinderPkg;
try {
    pathfinderPkg = require('mineflayer-pathfinder');
} catch (e) {
    pathfinderPkg = null;
}

const TURKISH_BLOCKS = {
    'tas': ['stone', 'cobblestone', 'deepslate'],
    'taş': ['stone', 'cobblestone', 'deepslate'],
    'toprak': ['dirt', 'grass_block'],
    'cim': ['grass_block'],
    'çim': ['grass_block'],
    'kum': ['sand', 'red_sand'],
    'cakil': ['gravel'],
    'çakıl': ['gravel'],
    'odun': ['oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log', 'log'],
    'agac': ['oak_log', 'birch_log', 'spruce_log', 'log'],
    'ağaç': ['oak_log', 'birch_log', 'spruce_log', 'log'],
    'demir': ['iron_ore', 'deepslate_iron_ore'],
    'komur': ['coal_ore', 'deepslate_coal_ore'],
    'kömür': ['coal_ore', 'deepslate_coal_ore'],
    'altin': ['gold_ore', 'deepslate_gold_ore'],
    'altın': ['gold_ore', 'deepslate_gold_ore'],
    'elmas': ['diamond_ore', 'deepslate_diamond_ore'],
    'bakir': ['copper_ore', 'deepslate_copper_ore'],
    'bakır': ['copper_ore', 'deepslate_copper_ore'],
    'zumrut': ['emerald_ore', 'deepslate_emerald_ore'],
    'zümrüt': ['emerald_ore', 'deepslate_emerald_ore'],
    'kiziltas': ['redstone_ore', 'deepslate_redstone_ore'],
    'kızıltaş': ['redstone_ore', 'deepslate_redstone_ore'],
    'obsidyen': ['obsidian']
};

class MCBotManager {
    constructor() {
        this.bots = new Map();
    }

    addLog(userId, message) {
        const botData = this.bots.get(userId);
        if (!botData) return;
        const time = new Date().toLocaleTimeString('tr-TR');
        const logLine = `[${time}] ${message}`;
        botData.logs.push(logLine);
        if (botData.logs.length > 200) botData.logs.shift();
    }

    spawnBot(userId, username, host, port) {
        if (this.bots.has(userId)) {
            const current = this.bots.get(userId);
            if (current.connected) {
                return { success: false, message: 'Zaten aktif bir botunuz var! Önce bağlantısını kesin.' };
            }
            this.killBot(userId);
        }

        const botUsername = (username && username.trim()) ? username.trim() : `Apex_${Math.floor(1000 + Math.random() * 9000)}`;
        const parsedPort = parseInt(port, 10) || 25565;

        const botData = {
            userId,
            username: botUsername,
            host,
            port: parsedPort,
            connected: false,
            logs: [],
            action: 'Yok',
            bot: null,
            wanderInterval: null
        };
        this.bots.set(userId, botData);

        this.addLog(userId, `Sunucuya bağlanılıyor: ${host}:${parsedPort} (Kullanıcı: ${botUsername})...`);

        try {
            const bot = mineflayer.createBot({
                host: host,
                port: parsedPort,
                username: botUsername,
                checkTimeoutInterval: 60000
            });

            botData.bot = bot;

            if (pathfinderPkg) {
                bot.loadPlugin(pathfinderPkg.pathfinder);
            }

            bot.once('spawn', () => {
                botData.connected = true;
                this.addLog(userId, `✅ Sunucuya başarıyla girildi! (Sürüm: ${bot.version || 'Otomatik'})`);
                this.addLog(userId, `💡 Komut listesi için konsola "yardım" yazabilirsiniz.`);

                if (pathfinderPkg && bot.pathfinder) {
                    const defaultMove = new pathfinderPkg.Movements(bot);
                    bot.pathfinder.setMovements(defaultMove);
                }
            });

            bot.on('chat', (sender, message) => {
                if (sender === bot.username) return;
                this.addLog(userId, `[CHAT] <${sender}>: ${message}`);
            });

            bot.on('messagestr', (message) => {
                if (!message || message.trim() === '') return;
                this.addLog(userId, `[SUNUCU]: ${message}`);
            });

            bot.on('kicked', (reason) => {
                let parsedReason = reason;
                try {
                    parsedReason = typeof reason === 'string' ? reason : JSON.stringify(reason);
                } catch (e) {}
                this.addLog(userId, `❌ Sunucudan atıldı: ${parsedReason}`);
                botData.connected = false;
                this.stopCurrentAction(userId);
            });

            bot.on('error', (err) => {
                this.addLog(userId, `⚠️ Hata: ${err.message || err}`);
            });

            bot.on('end', (reason) => {
                this.addLog(userId, `🔌 Bağlantı sonlandı: ${reason || 'Bilinmiyor'}`);
                botData.connected = false;
                this.stopCurrentAction(userId);
            });

            return { success: true, message: 'Bot başlatıldı, sunucuya bağlanıyor...', username: botUsername };
        } catch (error) {
            this.addLog(userId, `❌ Başlatma hatası: ${error.message}`);
            return { success: false, message: error.message };
        }
    }

    stopCurrentAction(userId) {
        const botData = this.bots.get(userId);
        if (!botData) return;
        if (botData.wanderInterval) {
            clearInterval(botData.wanderInterval);
            botData.wanderInterval = null;
        }
        if (botData.bot && botData.bot.pathfinder) {
            botData.bot.pathfinder.setGoal(null);
        }
        if (botData.bot) {
            botData.bot.clearControlStates();
        }
        botData.action = 'Yok';
    }

    handleCommand(userId, rawCommand) {
        const botData = this.bots.get(userId);
        if (!botData) {
            return { success: false, message: 'Aktif botunuz bulunmuyor.' };
        }

        const cmd = rawCommand.trim();
        this.addLog(userId, `> ${cmd}`);

        if (!botData.connected || !botData.bot) {
            this.addLog(userId, '⚠️ Bot henüz sunucuya bağlı değil.');
            return { success: false, message: 'Bot bağlı değil.' };
        }

        const bot = botData.bot;
        const lower = cmd.toLowerCase();

        // 1. yardım
        if (lower === 'yardım' || lower === 'yardim' || lower === 'help') {
            this.addLog(userId, '══════════ KOMUT LİSTESİ ══════════');
            this.addLog(userId, '• yardım               : Bu menüyü gösterir.');
            this.addLog(userId, '• gez                  : Bot etrafta rastgele dolaşır.');
            this.addLog(userId, '• kaz <blok_ismi>      : Belirtilen bloğu arar ve kazar (Örn: kaz taş, kaz odun, kaz demir).');
            this.addLog(userId, '• takip et [oyuncu]    : Belirtilen veya en yakın oyuncuyu takip eder.');
            this.addLog(userId, '• mesaj yaz <mesaj>    : Sunucu sohbetine mesaj gönderir.');
            this.addLog(userId, '• dur                  : Gezme, kazma veya takibi durdurur.');
            this.addLog(userId, '═══════════════════════════════════');
            return { success: true };
        }

        // 2. dur
        if (lower === 'dur' || lower === 'stop') {
            this.stopCurrentAction(userId);
            this.addLog(userId, '🛑 Tüm eylemler durduruldu.');
            return { success: true };
        }

        // 3. gez
        if (lower === 'gez' || lower === 'wander') {
            this.stopCurrentAction(userId);
            botData.action = 'Geziniyor';
            this.addLog(userId, '🚶 Bot etrafta gezmeye başladı.');

            const wanderStep = () => {
                if (!botData.connected || botData.action !== 'Geziniyor' || !bot.entity) return;
                const rx = (Math.random() - 0.5) * 20;
                const rz = (Math.random() - 0.5) * 20;
                const targetPos = bot.entity.position.offset(rx, 0, rz);

                if (pathfinderPkg && bot.pathfinder) {
                    bot.pathfinder.setGoal(new pathfinderPkg.goals.GoalNear(targetPos.x, targetPos.y, targetPos.z, 1));
                } else {
                    bot.lookAt(targetPos);
                    bot.setControlState('forward', true);
                    setTimeout(() => bot.setControlState('forward', false), 2000);
                }
            };

            wanderStep();
            botData.wanderInterval = setInterval(wanderStep, 5000);
            return { success: true };
        }

        // 4. kaz <blok_ismi>
        if (lower.startsWith('kaz ') || lower.startsWith('mine ')) {
            const blockInput = lower.replace(/^(kaz|mine)\s+/, '').trim();
            if (!blockInput) {
                this.addLog(userId, '⚠️ Lütfen kazılacak blok adını belirtin. Örnek: kaz taş');
                return { success: false, message: 'Blok adı gerekli' };
            }

            this.stopCurrentAction(userId);
            botData.action = `Kazıyor: ${blockInput}`;

            const possibleNames = TURKISH_BLOCKS[blockInput] || [blockInput];
            this.addLog(userId, `🔍 "${blockInput}" bloğu aranıyor...`);

            const block = bot.findBlock({
                matching: (b) => possibleNames.some(name => b.name.includes(name)),
                maxDistance: 32
            });

            if (!block) {
                this.addLog(userId, `❌ Yakında "${blockInput}" bloğu bulunamadı (32 blok menzil).`);
                botData.action = 'Yok';
                return { success: false, message: 'Blok bulunamadı.' };
            }

            this.addLog(userId, `⛏️ Blok bulundu (${block.name} @ ${block.position}), kazmaya gidiliyor...`);

            if (pathfinderPkg && bot.pathfinder) {
                bot.pathfinder.setGoal(new pathfinderPkg.goals.GoalBlock(block.position.x, block.position.y, block.position.z));
                const checkArrival = setInterval(() => {
                    if (botData.action !== `Kazıyor: ${blockInput}`) {
                        clearInterval(checkArrival);
                        return;
                    }
                    if (bot.entity.position.distanceTo(block.position) <= 4.5) {
                        clearInterval(checkArrival);
                        bot.pathfinder.setGoal(null);
                        bot.dig(block, (err) => {
                            if (err) {
                                this.addLog(userId, `⚠️ Kazma hatası: ${err.message}`);
                            } else {
                                this.addLog(userId, '✅ Blok başarıyla kazıldı!');
                            }
                            botData.action = 'Yok';
                        });
                    }
                }, 500);
            } else {
                bot.lookAt(block.position);
                bot.dig(block, (err) => {
                    if (err) this.addLog(userId, `⚠️ Kazma hatası: ${err.message}`);
                    else this.addLog(userId, '✅ Blok kazıldı!');
                    botData.action = 'Yok';
                });
            }
            return { success: true };
        }

        // 5. takip et [oyuncu]
        if (lower.startsWith('takip et') || lower.startsWith('follow')) {
            const targetPlayerName = cmd.replace(/^(takip et|follow)\s*/i, '').trim();
            this.stopCurrentAction(userId);

            let targetEntity = null;
            if (targetPlayerName) {
                const p = bot.players[targetPlayerName];
                targetEntity = p ? p.entity : null;
            } else {
                let closest = null;
                let minDist = 9999;
                for (const name in bot.players) {
                    if (name === bot.username) continue;
                    const p = bot.players[name];
                    if (p && p.entity) {
                        const dist = bot.entity.position.distanceTo(p.entity.position);
                        if (dist < minDist) {
                            minDist = dist;
                            closest = p.entity;
                        }
                    }
                }
                targetEntity = closest;
            }

            if (!targetEntity) {
                this.addLog(userId, '❌ Takip edilecek oyuncu menzilde veya sunucuda bulunamadı.');
                return { success: false, message: 'Oyuncu bulunamadı.' };
            }

            const targetName = targetEntity.username || 'Oyuncu';
            botData.action = `Takip ediyor: ${targetName}`;
            this.addLog(userId, `🏃 ${targetName} takip ediliyor...`);

            if (pathfinderPkg && bot.pathfinder) {
                bot.pathfinder.setGoal(new pathfinderPkg.goals.GoalFollow(targetEntity, 2), true);
            }
            return { success: true };
        }

        // 6. mesaj yaz <mesaj>
        if (lower.startsWith('mesaj yaz ') || lower.startsWith('chat ') || lower.startsWith('say ')) {
            const msg = cmd.replace(/^(mesaj yaz|chat|say)\s+/i, '').trim();
            if (!msg) {
                this.addLog(userId, '⚠️ Gönderilecek mesajı yazın.');
                return { success: false };
            }
            try {
                bot.chat(msg);
                this.addLog(userId, `💬 Mesaj gönderildi: "${msg}"`);
                return { success: true };
            } catch (e) {
                this.addLog(userId, `⚠️ Mesaj hatası: ${e.message}`);
                return { success: false, message: e.message };
            }
        }

        this.addLog(userId, `❓ Bilinmeyen komut: "${cmd}". Seçenekler için "yardım" yazın.`);
        return { success: false, message: 'Bilinmeyen komut' };
    }

    killBot(userId) {
        const botData = this.bots.get(userId);
        if (!botData) return { success: false, message: 'Bot bulunamadı.' };

        this.stopCurrentAction(userId);
        if (botData.bot) {
            try {
                botData.bot.quit('Panel üzerinden bağlantı kesildi.');
            } catch (e) {}
        }
        botData.connected = false;
        this.addLog(userId, '🛑 Bot sunucudan çıkarıldı.');
        return { success: true, message: 'Bot bağlantısı kesildi.' };
    }

    getStatus(userId) {
        const botData = this.bots.get(userId);
        if (!botData) {
            return {
                exists: false,
                connected: false,
                logs: []
            };
        }
        return {
            exists: true,
            connected: botData.connected,
            username: botData.username,
            host: botData.host,
            port: botData.port,
            action: botData.action,
            logs: botData.logs
        };
    }

    getAllBots() {
        const list = [];
        for (const [userId, botData] of this.bots.entries()) {
            list.push({
                userId,
                username: botData.username,
                host: botData.host,
                port: botData.port,
                connected: botData.connected,
                action: botData.action
            });
        }
        return list;
    }
}

module.exports = new MCBotManager();
