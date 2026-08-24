/**
 * ============================================
 * APEX | Hosting — Projects Routes
 * Kullanıcıların projelerini listeleme, durdurma/başlatma
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
 * Sahiplik kontrolü için yardımcı fonksiyon
 */
const getProjectOwner = async (req) => {
    const projects = JSON.parse(await fs.readFile('data/projects.json', 'utf8'));
    const project = projects[req.params.id];
    if (!project) throw new Error('Proje bulunamadı');
    return project.owner;
};

/**
 * GET /api/projects
 * Kullanıcının kendi projelerini listele
 */
router.get('/', async (req, res) => {
    try {
        const projects = JSON.parse(await fs.readFile('data/projects.json', 'utf8'));
        const userProjects = Object.values(projects).filter(p => p.owner === req.session.user.id);
        
        // Çalışma durumlarını ekle
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
        res.status(500).json({ success: false, message: 'Projeler alınamadı' });
    }
});

/**
 * GET /api/projects/:id/status
 * Projenin durumunu ve son loglarını getir
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
 * Projeyi başlat
 */
router.post('/:id/start', requireOwnership(getProjectOwner), async (req, res) => {
    try {
        const projects = JSON.parse(await fs.readFile('data/projects.json', 'utf8'));
        const project = projects[req.params.id];
        
        await processManager.startProject(req.params.id, project);
        res.json({ success: true, message: 'Proje başlatıldı' });
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
 * Projeyi yeniden başlat
 */
router.post('/:id/restart', requireOwnership(getProjectOwner), async (req, res) => {
    try {
        const projects = JSON.parse(await fs.readFile('data/projects.json', 'utf8'));
        const project = projects[req.params.id];
        
        await processManager.restartProject(req.params.id, project);
        res.json({ success: true, message: 'Proje yeniden başlatıldı' });
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
        
        // Önce durdur
        await processManager.stopProject(projectId);
        
        // Veritabanından sil
        const projects = JSON.parse(await fs.readFile('data/projects.json', 'utf8'));
        delete projects[projectId];
        await fs.writeFile('data/projects.json', JSON.stringify(projects, null, 2));
        
        // Dosyaları sil
        await fs.remove(path.join(process.cwd(), 'projects', projectId));
        
        res.json({ success: true, message: 'Proje başarıyla silindi' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Proje silinirken hata oluştu' });
    }
});

module.exports = router;
