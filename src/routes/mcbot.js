const express = require('express');
const router = express.Router();
const mcBotManager = require('../utils/mcBotManager');

// Kullanici giris kontrolu middleware
function requireAuth(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ success: false, message: 'Oturum açmanız gerekiyor.' });
    }
    next();
}

// Owner kontrolu middleware
function requireOwner(req, res, next) {
    if (!req.session || !req.session.user || !req.session.isOwner) {
        return res.status(403).json({ success: false, message: 'Yetkisiz erişim.' });
    }
    next();
}

// Bot Baslat
router.post('/spawn', requireAuth, (req, res) => {
    const { host, port, username } = req.body;
    if (!host) {
        return res.status(400).json({ success: false, message: 'Sunucu IP adresi gereklidir.' });
    }
    const result = mcBotManager.spawnBot(req.session.user.id, username, host, port);
    res.json(result);
});

// Bot Komutu Gonder
router.post('/command', requireAuth, (req, res) => {
    const { command } = req.body;
    if (!command) {
        return res.status(400).json({ success: false, message: 'Komut gereklidir.' });
    }
    const result = mcBotManager.handleCommand(req.session.user.id, command);
    res.json(result);
});

// Bot Durumu ve Konsol Loglari
router.get('/status', requireAuth, (req, res) => {
    const status = mcBotManager.getStatus(req.session.user.id);
    res.json({ success: true, ...status });
});

// Botu Durdur / Baglantiyi Kes
router.post('/stop', requireAuth, (req, res) => {
    const result = mcBotManager.killBot(req.session.user.id);
    res.json(result);
});

// === OWNER ROTLARI ===

// Tum Aktif Botlari Listele
router.get('/owner/all', requireOwner, (req, res) => {
    const bots = mcBotManager.getAllBots();
    res.json({ success: true, bots });
});

// Owner Tarafından Bot Kapatma
router.post('/owner/kill', requireOwner, (req, res) => {
    const { targetUserId } = req.body;
    if (!targetUserId) {
        return res.status(400).json({ success: false, message: 'Hedef kullanıcı ID gerekli.' });
    }
    const result = mcBotManager.killBot(targetUserId);
    res.json(result);
});

module.exports = router;
