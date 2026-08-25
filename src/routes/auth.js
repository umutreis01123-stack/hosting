const express = require('express');
const fs = require('fs');
const bcrypt = require('bcrypt');
const svgCaptcha = require('svg-captcha');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const USERS_FILE = 'data/users.json';

function getUsers() {
    if (!fs.existsSync(USERS_FILE)) return {};
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function saveUsers(data) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

router.get('/captcha', (req, res) => {
    const captcha = svgCaptcha.create({
        size: 5, ignoreChars: '0o1il', noise: 2, color: true, background: '#1e1e2e'
    });
    req.session.captcha = captcha.text.toLowerCase();
    res.type('svg');
    res.status(200).send(captcha.data);
});

router.post('/register', async (req, res) => {
    const { discordId, username, password, passwordConfirm, captcha } = req.body;
    
    if (!discordId || !username || !password || !passwordConfirm || !captcha) return res.status(400).json({ success: false, message: 'Tüm alanları doldurun.' });
    if (password !== passwordConfirm) return res.status(400).json({ success: false, message: 'Şifreler birbiriyle uyuşmuyor.' });
    if (username.length < 3 || username.length > 20) return res.status(400).json({ success: false, message: 'Kullanıcı adı 3-20 karakter olmalı.' });
    if (!req.session.captcha || req.session.captcha !== captcha.toLowerCase()) return res.status(400).json({ success: false, message: 'Güvenlik kodu hatalı!' });
    
    const users = getUsers();
    const usernameExists = Object.values(users).some(u => u.username.toLowerCase() === username.toLowerCase());
    if (usernameExists) return res.status(400).json({ success: false, message: 'Bu kullanıcı adı zaten alınmış.' });
    
    const discordIdExists = Object.values(users).some(u => u.discordId === discordId);
    if (discordIdExists) return res.status(400).json({ success: false, message: 'Bu Discord ID zaten kayıtlı.' });
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = uuidv4();
        
        users[userId] = {
            id: userId, discordId, username, password: hashedPassword,
            createdAt: new Date().toISOString(), banned: false,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random`
        };
        saveUsers(users);
        
        req.session.user = { id: userId, discordId, username, avatar: users[userId].avatar, loggedInAt: new Date().toISOString() };
        req.session.captcha = null;
        res.json({ success: true, message: 'Kayıt başarılı! Yönlendiriliyorsunuz...' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Sunucu hatası oluştu.' });
    }
});

router.post('/login', async (req, res) => {
    const { discordId, password, captcha } = req.body;
    
    if (!discordId || !password || !captcha) return res.status(400).json({ success: false, message: 'Tüm alanları doldurun.' });
    if (!req.session.captcha || req.session.captcha !== captcha.toLowerCase()) return res.status(400).json({ success: false, message: 'Güvenlik kodu hatalı!' });
    
    const users = getUsers();
    const user = Object.values(users).find(u => u.discordId === discordId);
    
    if (!user) return res.status(401).json({ success: false, message: 'Discord ID veya şifre hatalı.' });
    if (user.banned) return res.status(403).json({ success: false, message: 'Hesabınız yasaklanmıştır.' });
    
    try {
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ success: false, message: 'Kullanıcı adı veya şifre hatalı.' });
        
        req.session.user = { id: user.id, discordId: user.discordId, username: user.username, avatar: user.avatar, loggedInAt: new Date().toISOString() };
        req.session.captcha = null;
        
        const ownerDiscordId = process.env.OWNER_DISCORD_ID || '1403495996138323989';
        if (user.discordId === ownerDiscordId) {
            req.session.isOwner = false;
            req.session.ownerPending = true;
            return res.json({ success: true, message: 'Kurucu girişi tespit edildi.', isOwner: true });
        }
        res.json({ success: true, message: 'Giriş başarılı! Yönlendiriliyorsunuz...' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Sunucu hatası oluştu.' });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

router.get('/me', (req, res) => {
    if (!req.session.user) return res.json({ loggedIn: false });
    res.json({ loggedIn: true, user: req.session.user, isOwner: req.session.isOwner || false, ownerPending: req.session.ownerPending || false });
});

router.post('/owner/verify', (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false, message: 'Giriş yapmanız gerekiyor.' });
    if (req.session.user.username !== 'umutpapa123') return res.status(403).json({ success: false, message: 'Yetkisiz işlem.' });
    
    const { password } = req.body;
    if (password !== (process.env.OWNER_PASSWORD || 'umutbaba123u')) return res.status(401).json({ success: false, message: 'Yanlış şifre!' });
    
    req.session.isOwner = true;
    req.session.ownerPending = false;
    res.json({ success: true, message: 'Owner girişi başarılı!', redirect: '/owner' });
});

module.exports = router;
