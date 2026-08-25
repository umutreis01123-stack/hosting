/**
 * ============================================
 * APEX | Hosting — Discord OAuth2 Auth Routes
 * GET /auth/discord          → OAuth2 başlat
 * GET /auth/discord/callback → OAuth2 callback
 * GET /auth/logout           → Çıkış
 * GET /auth/me               → Oturum bilgisi
 * ============================================
 */

const express = require('express');
const axios = require('axios');
const fs = require('fs');
const router = express.Router();

// Discord OAuth2 Ayarları
const DISCORD_API = 'https://discord.com/api/v10';
const SCOPES = 'identify email';

/**
 * GET /auth/discord
 * Kullanıcıyı Discord OAuth2 sayfasına yönlendir
 */
router.get('/discord', (req, res) => {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const redirectUri = encodeURIComponent(process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/auth/discord/callback');
    
    if (!clientId) {
        return res.redirect('/?error=missing_discord_config');
    }

    const authUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${encodeURIComponent(SCOPES)}`;
    res.redirect(authUrl);
});

/**
 * GET /auth/discord/callback
 * Discord'dan gelen authorization code ile token al
 */
router.get('/discord/callback', async (req, res) => {
    const { code, error } = req.query;

    if (error || !code) {
        return res.redirect('/?error=discord_auth_denied');
    }

    try {
        // Authorization code ile access token al
        const tokenResponse = await axios.post(`${DISCORD_API}/oauth2/token`,
            new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/auth/discord/callback'
            }),
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            }
        );

        const { access_token, token_type } = tokenResponse.data;

        // Access token ile kullanıcı bilgilerini al
        const userResponse = await axios.get(`${DISCORD_API}/users/@me`, {
            headers: { Authorization: `${token_type} ${access_token}` }
        });

        const discordUser = userResponse.data;

        // Session'a kaydet
        req.session.user = {
            id: discordUser.id,
            username: discordUser.username,
            discriminator: discordUser.discriminator || '0',
            avatar: discordUser.avatar
                ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
                : `https://cdn.discordapp.com/embed/avatars/${parseInt(discordUser.id) % 5}.png`,
            email: discordUser.email,
            loggedInAt: new Date().toISOString()
        };

        // Kullanıcıyı veritabanına kaydet/güncelle
        saveUser(discordUser);

        // Owner kontrolü
        const ownerDiscordId = process.env.OWNER_DISCORD_ID || '1403495996138323989';
        if (discordUser.id === ownerDiscordId) {
            // Owner tespit edildi — şifre ekranına yönlendir
            req.session.isOwner = false; // Henüz şifre girilmedi
            req.session.ownerPending = true;
            return res.redirect('/dashboard?ownerLogin=1');
        }

        res.redirect('/dashboard');
    } catch (err) {
        console.error('[AUTH] Discord OAuth2 hatası:', err.response?.data || err.message);
        res.redirect('/?error=auth_failed');
    }
});

/**
 * GET /auth/logout
 * Oturumu kapat
 */
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error('[AUTH] Session destroy hatası:', err);
        res.redirect('/');
    });
});

/**
 * GET /auth/me
 * Mevcut oturum bilgisini döndür
 */
router.get('/me', (req, res) => {
    if (!req.session.user) {
        return res.json({ loggedIn: false });
    }

    // Kullanicinin kredi bilgisini oku
    let credits = 0;
    try {
        if (fs.existsSync('data/users.json')) {
            const users = JSON.parse(fs.readFileSync('data/users.json', 'utf8'));
            if (users[req.session.user.id]) {
                credits = users[req.session.user.id].credits || 0;
            }
        }
    } catch(e) {}

    res.json({
        loggedIn: true,
        user: req.session.user,
        credits: Math.floor(credits),
        isOwner: req.session.isOwner || false,
        ownerPending: req.session.ownerPending || false
    });
});

/**
 * POST /auth/owner/verify
 * Owner şifresini doğrula
 */
router.post('/owner/verify', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Giriş yapmanız gerekiyor' });
    }

    const ownerDiscordId = process.env.OWNER_DISCORD_ID || '1403495996138323989';
    if (req.session.user.id !== ownerDiscordId) {
        return res.status(403).json({ success: false, message: 'Bu hesap owner değil' });
    }

    const { password } = req.body;
    const ownerPassword = process.env.OWNER_PASSWORD || 'umutbaba123u';

    if (password !== ownerPassword) {
        return res.status(401).json({ success: false, message: 'Yanlış şifre! Tekrar deneyin.' });
    }

    // Owner oturumunu onayla
    req.session.isOwner = true;
    req.session.ownerPending = false;

    res.json({
        success: true,
        message: 'Owner girişi başarılı! Hoş geldiniz, Kurucu.',
        redirect: '/owner'
    });
});

/**
 * Kullanıcıyı veritabanına kaydet/güncelle
 * @param {object} discordUser
 */
function saveUser(discordUser) {
    try {
        let usersData = {};
        if (fs.existsSync('data/users.json')) {
            usersData = JSON.parse(fs.readFileSync('data/users.json', 'utf8'));
        }

        const isNew = !usersData[discordUser.id];
        usersData[discordUser.id] = {
            ...usersData[discordUser.id], // Mevcut veriyi koru (banned vb.)
            discordId: discordUser.id,
            username: discordUser.username,
            discriminator: discordUser.discriminator || '0',
            avatar: discordUser.avatar
                ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
                : null,
            email: discordUser.email,
            lastLogin: new Date().toISOString(),
            ...(isNew && { createdAt: new Date().toISOString(), banned: false, credits: 0 })
        };

        fs.writeFileSync('data/users.json', JSON.stringify(usersData, null, 2));
    } catch (err) {
        console.error('[AUTH] Kullanıcı kaydedilemedi:', err.message);
    }
}

module.exports = router;
