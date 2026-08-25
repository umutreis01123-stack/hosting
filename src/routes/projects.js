/**
 * ============================================
 * APEX | Hosting â€” Projects Routes
 * KullanÄ±cÄ±larÄ±n projelerini listeleme, durdurma/baÅŸlatma
 * ============================================
 */

const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { requireAuth, requireOwnership } = require('../middleware/auth.middleware');
const processManager = require('../utils/processManager');

const router = express.Router();
router.use(requireAuth);

/**
 * Sahiplik kontrolÃ¼ iÃ§in yardÄ±mcÄ± fonksiyon
 */
const getProjectOwner = async (req) => {
    const projects = JSON.parse(await fs.readFile('data/projects.json', 'utf8'));
    const project = projects[req.params.id];
    if (!project) throw new Error('Proje bulunamadÄ±');
    return project.owner;
};

/**
 * GET /api/projects
 * KullanÄ±cÄ±nÄ±n kendi projelerini listele
 */
router.get('/', async (req, res) => {
    try {
        const projects = JSON.parse(await fs.readFile('data/projects.json', 'utf8'));
        const userProjects = Object.values(projects).filter(p => p.owner === req.session.user.id);
        
        // Ã‡alÄ±ÅŸma durumlarÄ±nÄ± ekle
        const runningProjects = processManager.getRunningProjects();
        
        const enhancedProjects = userProjects.map(p => {
            const processInfo = runningProjects.find(rp => rp.projectId === p.id) || { running: false, uptime: 0 };
            return {
                ...p,
                running: processInfo.running,
                uptime: processInfo.uptime
            };
        });

        res.json({ success: true, projects: enhancedProjects });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Projeler alÄ±namadÄ±' });
    }
});

/**
 * GET /api/projects/:id/status
 * Projenin durumunu ve son loglarÄ±nÄ± getir
 */
router.get('/:id/status', requireOwnership(getProjectOwner), async (req, res) => {
    try {
        const info = processManager.getProcessInfo(req.params.id);
        res.json({ success: true, status: info });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/projects/:id/start
 * Projeyi baÅŸlat
 */
router.post('/:id/start', requireOwnership(getProjectOwner), async (req, res) => {
    try {
        const projects = JSON.parse(await fs.readFile('data/projects.json', 'utf8'));
        const project = projects[req.params.id];
        
        await processManager.startProject(req.params.id, project);
        res.json({ success: true, message: 'Proje baÅŸlatÄ±ldÄ±' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/projects/:id/stop
 * Projeyi durdur
 */
router.post('/:id/stop', requireOwnership(getProjectOwner), async (req, res) => {
    try {
        await processManager.stopProject(req.params.id);
        res.json({ success: true, message: 'Proje durduruldu' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/projects/:id/restart
 * Projeyi yeniden baÅŸlat
 */
router.post('/:id/restart', requireOwnership(getProjectOwner), async (req, res) => {
    try {
        const projects = JSON.parse(await fs.readFile('data/projects.json', 'utf8'));
        const project = projects[req.params.id];
        
        await processManager.restartProject(req.params.id, project);
        res.json({ success: true, message: 'Proje yeniden baÅŸlatÄ±ldÄ±' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * DELETE /api/projects/:id
 * Projeyi sil
 */
router.delete('/:id', requireOwnership(getProjectOwner), async (req, res) => {
    try {
        const projectId = req.params.id;
        
        // Ã–nce durdur
        await processManager.stopProject(projectId);
        
        // VeritabanÄ±ndan sil
        const projects = JSON.parse(await fs.readFile('data/projects.json', 'utf8'));
        delete projects[projectId];
        await fs.writeFile('data/projects.json', JSON.stringify(projects, null, 2));
        
        // DosyalarÄ± sil
        await fs.remove(path.join(process.cwd(), 'projects', projectId));
        
        res.json({ success: true, message: 'Proje baÅŸarÄ±yla silindi' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Proje silinirken hata oluÅŸtu' });
    }
});

/**
 * POST /api/projects/:id/status-config
 * Bot durumunu .env dosyasina yazar
 */
router.post('/:id/status-config', async (req, res) => {
    try {
        const { type, text } = req.body;
        const envPath = path.join(process.cwd(), 'projects', req.params.id, '.env');
        let envContent = '';
        if (await fs.pathExists(envPath)) {
            envContent = await fs.readFile(envPath, 'utf8');
        }
        
        // Eski durumlari temizle
        envContent = envContent.split('\n').filter(line => !line.startsWith('BOT_STATUS_TYPE=') && !line.startsWith('BOT_STATUS_TEXT=')).join('\n');
        
        // Yeni durumlari ekle
        envContent += \nBOT_STATUS_TYPE= + type;
        envContent += \nBOT_STATUS_TEXT=" + text + ";
        
        await fs.writeFile(envPath, envContent.trim());
        res.json({ success: true, message: 'Bot durumu .env dosyasina kaydedildi. Yeniden baslatildiginda aktif olur.' });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Durum kaydedilemedi' });
    }
});

/**
 * GET /api/projects/:id/dns
 * Projeye ait DNS kayitlarini getir
 */
router.get('/:id/dns', async (req, res) => {
    try {
        const dnsPath = path.join(process.cwd(), 'data', 'dns.json');
        if (!await fs.pathExists(dnsPath)) await fs.writeFile(dnsPath, JSON.stringify({}));
        const dnsData = JSON.parse(await fs.readFile(dnsPath, 'utf8'));
        res.json({ success: true, records: dnsData[req.params.id] || [] });
    } catch (e) {
        res.status(500).json({ success: false, records: [] });
    }
});

/**
 * POST /api/projects/:id/dns
 * Projeye yeni DNS kaydi ekle
 */
router.post('/:id/dns', async (req, res) => {
    try {
        const { type, name, value } = req.body;
        const dnsPath = path.join(process.cwd(), 'data', 'dns.json');
        if (!await fs.pathExists(dnsPath)) await fs.writeFile(dnsPath, JSON.stringify({}));
        const dnsData = JSON.parse(await fs.readFile(dnsPath, 'utf8'));
        
        if (!dnsData[req.params.id]) dnsData[req.params.id] = [];
        dnsData[req.params.id].push({ type, name, value, date: new Date().toISOString() });
        
        await fs.writeFile(dnsPath, JSON.stringify(dnsData, null, 2));
        res.json({ success: true, message: 'DNS kaydi eklendi' });
    } catch (e) {
        res.status(500).json({ success: false, message: 'DNS kaydedilemedi' });
    }
});

module.exports = router;

