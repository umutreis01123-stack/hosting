/**
 * ============================================
 * APEX | Hosting — Ana Sunucu (server.js)
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

// Yardımcı modüller
const processManager = require('./src/utils/processManager');

// Route'lar
const authRoutes = require('./src/routes/auth');
const uploadRoutes = require('./src/routes/upload');
const projectRoutes = require('./src/routes/projects');
const editorRoutes = require('./src/routes/editor');
const ownerRoutes = require('./src/routes/owner');

// Ortam değişkenlerini yükle
require('fs').existsSync('.env') && require('fs').readFileSync('.env', 'utf8').split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && !key.startsWith('#') && val.length) {
        process.env[key.trim()] = val.join('=').trim();
    }
});

const app = express();
app.set('trust proxy', 1); // Railway (Reverse Proxy) HTTPS trafiğini doğru algılaması için gerekli
const server = http.createServer(app);

// ─── WebSocket Sunucusu (Canlı Log Akışı) ───────────────────────────────────
const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
    // URL'den projectId al: /ws?projectId=xxx
    const params = new URLSearchParams(req.url.replace('/ws?', ''));
    const projectId = params.get('projectId');
    
    if (!projectId) {
        ws.close(1008, 'projectId gerekli');
        return;
    }

    // Log akışına kaydol
    processManager.subscribeToLogs(projectId, ws);

    ws.on('close', () => {
        processManager.unsubscribeFromLogs(projectId, ws);
    });
});

// Tüm istemcilere log broadcast için processManager'a wss'i ver
processManager.setWss(wss);

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: false, // CDN kaynaklarına izin ver
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

// Session yapılandırması
app.use(session({
    secret: process.env.SESSION_SECRET || 'apex_default_secret_123',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production' && process.env.APP_URL?.startsWith('https'),
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 gün
    }
}));

// ─── Statik Dosyalar ─────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Gerekli Klasörleri Oluştur ──────────────────────────────────────────────
const requiredDirs = ['uploads', 'projects', 'data'];
requiredDirs.forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Veri dosyalarını başlat
const dataFiles = {
    'data/users.json': '{}',
    'data/projects.json': '{}',
    'data/announcements.json': '[]'
};
Object.entries(dataFiles).forEach(([file, defaultContent]) => {
    if (!fs.existsSync(file)) fs.writeFileSync(file, defaultContent);
});

// ─── API Route'ları ──────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/editor', editorRoutes);
app.use('/api/owner', ownerRoutes);

// ─── Sağlık Kontrolü ─────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'APEX | Hosting',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// ─── Sayfa Yönlendirmeleri ────────────────────────────────────────────────────
// Ana sayfa
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Dashboard (giriş kontrolü middleware ile yapılır)
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

// ─── Hata Yönetimi ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('[APEX ERROR]', err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Sunucu hatası oluştu',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// 404
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Sunucuyu Başlat ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════╗
║          APEX | Hosting Platform          ║
╠═══════════════════════════════════════════╣
║  Sunucu: http://localhost:${PORT}           ║
║  Ortam : ${(process.env.NODE_ENV || 'development').padEnd(33)}║
╚═══════════════════════════════════════════╝
    `);
});

// Kapanış sinyallerini yakala - tüm süreçleri temiz kapat
process.on('SIGTERM', () => {
    console.log('[APEX] SIGTERM alındı, kapatılıyor...');
    processManager.stopAll();
    server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
    console.log('[APEX] SIGINT alındı, kapatılıyor...');
    processManager.stopAll();
    server.close(() => process.exit(0));
});

module.exports = { app, server };
