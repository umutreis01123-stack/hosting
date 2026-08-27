/**
 * ============================================
 * APEX | Hosting Ã¢â‚¬â€ Projects Routes
 * KullanÃ„Â±cÃ„Â±larÃ„Â±n projelerini listeleme, durdurma/baÃ…Å¸latma
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
 * Sahiplik kontrolÃƒÂ¼ iÃƒÂ§in yardÃ„Â±mcÃ„Â± fonksiyon
 */
const getProjectOwner = async (req) => {
    const projects = JSON.parse(await fs.readFile('data/projects.json', 'utf8'));
    const project = projects[req.params.id];
    if (!project) throw new Error('Proje bulunamadÃ„Â±');
    return project.owner;
};

/**
 * GET /api/projects
 * KullanÃ„Â±cÃ„Â±nÃ„Â±n kendi projelerini listele
 */
router.get('/', async (req, res) => {
    try {
        const projects = JSON.parse(await fs.readFile('data/projects.json', 'utf8'));
        const userProjects = Object.values(projects).filter(p => p.owner === req.session.user.id);
        
        // Ãƒâ€¡alÃ„Â±Ã…Å¸ma durumlarÃ„Â±nÃ„Â± ekle
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
        res.status(500).json({ success: false, message: 'Projeler alÃ„Â±namadÃ„Â±' });
    }
});

/**
 * GET /api/projects/:id/status
 * Projenin durumunu ve son loglarÃ„Â±nÃ„Â± getir
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
 * Projeyi baÃ…Å¸lat
 */
router.post('/:id/start', requireOwnership(getProjectOwner), async (req, res) => {
    try {
        const projects = JSON.parse(await fs.readFile('data/projects.json', 'utf8'));
        const project = projects[req.params.id];
        
        await processManager.startProject(req.params.id, project);
        res.json({ success: true, message: 'Proje baÃ…Å¸latÃ„Â±ldÃ„Â±' });
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
 * Projeyi yeniden baÃ…Å¸lat
 */
router.post('/:id/restart', requireOwnership(getProjectOwner), async (req, res) => {
    try {
        const projects = JSON.parse(await fs.readFile('data/projects.json', 'utf8'));
        const project = projects[req.params.id];
        
        await processManager.restartProject(req.params.id, project);
        res.json({ success: true, message: 'Proje yeniden baÃ…Å¸latÃ„Â±ldÃ„Â±' });
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
        
        // Ãƒâ€“nce durdur
        await processManager.stopProject(projectId);
        
        // VeritabanÃ„Â±ndan sil
        const projects = JSON.parse(await fs.readFile('data/projects.json', 'utf8'));
        delete projects[projectId];
        await fs.writeFile('data/projects.json', JSON.stringify(projects, null, 2));
        
        // DosyalarÃ„Â± sil
        await fs.remove(path.join(process.cwd(), 'projects', projectId));
        
        res.json({ success: true, message: 'Proje baÃ…Å¸arÃ„Â±yla silindi' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Proje silinirken hata oluÃ…Å¸tu' });
    }
});

/**
 * POST /api/projects/:id/status-config
 * Bot durumunu .env dosyasina yazar
 */
router.post('/:id/status-config', async (req, res) => {
    try {
        const { type, text } = req.body;
        const projectDir = path.join(process.cwd(), 'projects', req.params.id);
        await fs.ensureDir(projectDir);
        const envPath = path.join(projectDir, '.env');
        let envContent = '';
        if (await fs.pathExists(envPath)) {
            envContent = await fs.readFile(envPath, 'utf8');
        }
        
        // Eski durumlari temizle
        var lines = envContent.split('\n');
        var filtered = [];
        for (var i = 0; i < lines.length; i++) {
            if (!lines[i].startsWith('BOT_STATUS_TYPE=') && !lines[i].startsWith('BOT_STATUS_TEXT=')) {
                filtered.push(lines[i]);
            }
        }
        filtered.push('BOT_STATUS_TYPE=' + type);
        filtered.push('BOT_STATUS_TEXT=' + text);
        
        await fs.writeFile(envPath, filtered.join('\n').trim());
        res.json({ success: true, message: 'Bot durumu kaydedildi! Projeyi yeniden baslatinca aktif olur.' });
    } catch (e) {
        console.error('[STATUS] Hata:', e.message);
        res.status(500).json({ success: false, message: 'Durum kaydedilemedi: ' + e.message });
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


