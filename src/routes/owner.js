const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { requireOwner } = require('../middleware/owner.middleware');
const { getSystemStats } = require('../utils/systemStats');
const processManager = require('../utils/processManager');
const creditManager = require('../utils/creditManager');

const router = express.Router();
router.use(requireOwner);

router.get('/stats', async (req, res) => {
    try {
        const stats = await getSystemStats();
        const runningProjects = processManager.getRunningProjects();
        res.json({
            success: true,
            stats,
            activeProjectsCount: runningProjects.filter(p => p.running).length,
            totalProjectsCount: Object.keys(getJsonData('data/projects.json')).length,
            totalUsersCount: Object.keys(getJsonData('data/users.json')).length
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'İstatistikler alınamadı' });
    }
});

router.get('/users', (req, res) => {
    const users = getJsonData('data/users.json');
    const projects = getJsonData('data/projects.json');
    const runningProjects = processManager.getRunningProjects();

    const result = Object.values(users).map(user => {
        const userProjects = Object.entries(projects)
            .filter(([_, p]) => p.userId === user.id || p.owner === user.discordId)
            .map(([id, p]) => {
                const processInfo = runningProjects.find(rp => rp.projectId === id) || { running: false, uptime: 0 };
                return { id, name: p.name, type: p.type, status: processInfo.running ? 'running' : 'stopped', uptime: processInfo.uptime };
            });

        return {
            id: user.id || user.discordId,
            username: user.username,
            avatar: user.avatar,
            banned: user.banned || false,
            createdAt: user.createdAt,
            credits: user.credits || 0,
            projects: userProjects
        };
    });
    res.json({ success: true, users: result });
});

router.post('/credits/:userId', (req, res) => {
    const { userId } = req.params;
    const { amount, action } = req.body; // action: 'set' or 'add'
    
    if (action === 'add') {
        const success = creditManager.addCredits(userId, amount);
        if (success) res.json({ success: true, message: amount + ' kredi eklendi.' });
        else res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
    } else {
        const success = creditManager.setCredits(userId, amount);
        if (success) res.json({ success: true, message: 'Kredi guncellendi.' });
        else res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
    }
});

router.post('/ban/:userId', (req, res) => {
    const { userId } = req.params;
    const { banned } = req.body;
    if (userId === req.session.user.id) return res.status(400).json({ success: false, message: 'Kendinizi banlayamazsınız!' });

    try {
        const users = getJsonData('data/users.json');
        if (!users[userId]) return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
        users[userId].banned = !!banned;
        saveJsonData('data/users.json', users);

        if (users[userId].banned) {
            const projects = getJsonData('data/projects.json');
            Object.keys(projects).forEach(projectId => {
                if (projects[projectId].userId === userId || projects[projectId].owner === users[userId].discordId) {
                    processManager.stopProject(projectId);
                }
            });
        }
        res.json({ success: true, message: banned ? 'Kullanıcı yasaklandı' : 'Kullanıcının yasağı kaldırıldı' });
    } catch (err) { res.status(500).json({ success: false, message: 'İşlem başarısız oldu' }); }
});

router.post('/project/:id/:action', async (req, res) => {
    const { id, action } = req.params;
    const projects = getJsonData('data/projects.json');
    const project = projects[id];
    if (!project) return res.status(404).json({ success: false, message: 'Proje bulunamadı' });
    try {
        if (action === 'start') { await processManager.startProject(id, project); res.json({ success: true, message: 'Proje başlatıldı' }); }
        else if (action === 'stop') { await processManager.stopProject(id); res.json({ success: true, message: 'Proje durduruldu' }); }
        else if (action === 'restart') { await processManager.restartProject(id, project); res.json({ success: true, message: 'Proje yeniden başlatıldı' }); }
        else res.status(400).json({ success: false, message: 'Geçersiz işlem' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/project/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await processManager.stopProject(id);
        const projects = getJsonData('data/projects.json');
        delete projects[id];
        saveJsonData('data/projects.json', projects);
        fs.removeSync(path.join(process.cwd(), 'projects', id));
        res.json({ success: true, message: 'Proje kalıcı olarak silindi' });
    } catch (err) { res.status(500).json({ success: false, message: 'Proje silinirken hata oluştu' }); }
});

router.post('/announce', (req, res) => {
    const { title, message, type = 'info' } = req.body;
    if (!title || !message) return res.status(400).json({ success: false, message: 'Başlık ve mesaj zorunludur' });
    const announcements = getJsonData('data/announcements.json') || [];
    announcements.unshift({ id: Date.now().toString(), title, message, type, date: new Date().toISOString(), author: req.session.user.username });
    saveJsonData('data/announcements.json', announcements.slice(0, 10));
    res.json({ success: true, message: 'Duyuru yayınlandı' });
});

function getJsonData(filePath) { try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (e) { return filePath.includes('[]') ? [] : {}; } }
function saveJsonData(filePath, data) { fs.writeFileSync(filePath, JSON.stringify(data, null, 2)); }

/**
 * POST /api/owner/maintenance
 * Tum aktif projeleri durdurur (Bakim Modu)
 */
router.post('/maintenance', async (req, res) => {
    try {
        const processManager = require('../utils/processManager');
        const running = processManager.getRunningProjects();
        let killedCount = 0;
        for (const rp of running) {
            await processManager.stopProject(rp.projectId);
            killedCount++;
        }
        res.json({ success: true, message: Bakim Modu aktif! Toplam  proje basariyla durduruldu. });
    } catch(err) {
        res.status(500).json({ success: false, message: 'Durdurma islemi başarisiz oldu.' });
    }
});

module.exports = router;

