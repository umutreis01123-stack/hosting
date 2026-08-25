/**
 * ============================================
 * APEX | Hosting â€” Ana Sunucu (server.js)
 * Express.js + WebSocket + Discord OAuth2
 * ============================================
 */

const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');

// YardÄ±mcÄ± modÃ¼ller
const processManager = require('./src/utils/processManager');
const creditManager = require('./src/utils/creditManager');

// Route'lar
const authRoutes = require('./src/routes/auth');
const uploadRoutes = require('./src/routes/upload');
const projectRoutes = require('./src/routes/projects');
const editorRoutes = require('./src/routes/editor');
const ownerRoutes = require('./src/routes/owner');
const supportRoutes = require('./src/routes/support');

// Ortam deÄŸiÅŸkenlerini yÃ¼kle
require('fs').existsSync('.env') && require('fs').readFileSync('.env', 'utf8').split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && !key.startsWith('#') && val.length) {
        process.env[key.trim()] = val.join('=').trim();
    }
});

const app = express();
app.set('trust proxy', 1); // Railway (Reverse Proxy) HTTPS trafiÄŸini doÄŸru algÄ±lamasÄ± iÃ§in gerekli
const server = http.createServer(app);

// â”€â”€â”€ WebSocket Sunucusu (CanlÄ± Log AkÄ±ÅŸÄ±) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
    // URL'den projectId al: /ws?projectId=xxx
    const params = new URLSearchParams(req.url.replace('/ws?', ''));
    const projectId = params.get('projectId');
    
    if (!projectId) {
        ws.close(1008, 'projectId gerekli');
        return;
    }

    // Log akÄ±ÅŸÄ±na kaydol
    processManager.subscribeToLogs(projectId, ws);

    ws.on('close', () => {
        processManager.unsubscribeFromLogs(projectId, ws);
    });
});

// TÃ¼m istemcilere log broadcast iÃ§in processManager'a wss'i ver
processManager.setWss(wss);

// â”€â”€â”€ Middleware â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use(helmet({
    contentSecurityPolicy: false, // CDN kaynaklarÄ±na izin ver
    crossOriginEmbedderPolicy: false
}));

app.use(cors({
    origin: process.env.APP_URL || 'http://localhost:3000',
    credentials: true
}));

app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

const FileStore = require('session-file-store')(session);

// Session yapÄ±landÄ±rmasÄ±
app.use(session({
    store: new FileStore({ path: './data/sessions', logFn: function(){} }),
    secret: process.env.SESSION_SECRET || 'apex_default_secret_123',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production' && process.env.APP_URL?.startsWith('https'),
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 gÃ¼n
    }
}));

// â”€â”€â”€ Statik Dosyalar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use(express.static(path.join(__dirname, 'public')));

// â”€â”€â”€ Gerekli KlasÃ¶rleri OluÅŸtur â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const requiredDirs = ['uploads', 'projects', 'data'];
requiredDirs.forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Veri dosyalarÄ±nÄ± baÅŸlat
const dataFiles = {
    'data/users.json': '{}',
    'data/projects.json': '{}',
    'data/announcements.json': '[]'
};
Object.entries(dataFiles).forEach(([file, defaultContent]) => {
    if (!fs.existsSync(file)) fs.writeFileSync(file, defaultContent);
});

// â”€â”€â”€ API Route'larÄ± â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use('/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/editor', editorRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api', supportRoutes);

// â”€â”€â”€ SaÄŸlÄ±k KontrolÃ¼ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'APEX | Hosting',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// â”€â”€â”€ Sayfa YÃ¶nlendirmeleri â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Ana sayfa
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Dashboard (giriÅŸ kontrolÃ¼ middleware ile yapÄ±lÄ±r)
app.get('/dashboard', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/?error=login_required');
    }
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Owner paneli
app.get('/owner', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/?error=login_required');
    }
    if (!req.session.isOwner) {
        return res.redirect('/dashboard?error=unauthorized');
    }
    res.sendFile(path.join(__dirname, 'public', 'owner.html'));
});

// â”€â”€â”€ Hata YÃ¶netimi â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use((err, req, res, next) => {
    console.error('[APEX ERROR]', err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Sunucu hatasÄ± oluÅŸtu',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// 404
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// â”€â”€â”€ Sunucuyu BaÅŸlat â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`
â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
â•‘          APEX | Hosting Platform          â•‘
â• â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•£
â•‘  Sunucu: http://localhost:${PORT}           â•‘
â•‘  Ortam : ${(process.env.NODE_ENV || 'development').padEnd(33)}â•‘
â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    `);
});

// KapanÄ±ÅŸ sinyallerini yakala - tÃ¼m sÃ¼reÃ§leri temiz kapat
process.on('SIGTERM', () => {
    console.log('[APEX] SIGTERM alÄ±ndÄ±, kapatÄ±lÄ±yor...');
    processManager.stopAll();
    server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
    console.log('[APEX] SIGINT alÄ±ndÄ±, kapatÄ±lÄ±yor...');
    processManager.stopAll();
    server.close(() => process.exit(0));
});

module.exports = { app, server };

