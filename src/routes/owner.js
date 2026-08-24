/**
 * ============================================
 * APEX | Hosting — Owner API Routes
 * Sadece Owner'ın erişebileceği yetkili işlemler
 * ============================================
 */

const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { requireOwner } = require('../middleware/owner.middleware');
const { getSystemStats } = require('../utils/systemStats');
const processManager = require('../utils/processManager');

const router = express.Router();

// Tüm rotalarda Owner kontrolü yap
router.use(requireOwner);

/**
 * GET /api/owner/stats
 * Sunucu RAM, CPU ve Uptime bilgilerini getir
 */
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

/**
 * GET /api/owner/users
 * Tüm kullanıcıları ve projelerini listele
 */
router.get('/users', (req, res) => {
    const users = getJsonData('data/users.json');
    const projects = getJsonData('data/projects.json');
    const runningProjects = processManager.getRunningProjects();

    const result = Object.values(users).map(user => {
        // Kullanıcının projelerini bul
        const userProjects = Object.entries(projects)
            .filter(([_, p]) => p.owner === user.discordId)
            .map(([id, p]) => {
                const processInfo = runningProjects.find(rp => rp.projectId === id) || { running: false, uptime: 0 };
                return {
                    id,
                    name: p.name,
                    type: p.type,
                    status: processInfo.running ? 'running' : 'stopped',
                    uptime: processInfo.uptime
                };
            });

        return {
            id: user.discordId,
            username: user.username,
            avatar: user.avatar,
            banned: user.banned || false,
            createdAt: user.createdAt,
            projects: userProjects
        };
    });

    res.json({ success: true, users: result });
});

/**
 * POST /api/owner/ban/:userId
 * Kullanıcıyı banla veya banını aç
 */
router.post('/ban/:userId', (req, res) => {
    const { userId } = req.params;
    const { banned } = req.body;
    
    // Owner kendini banlayamaz
    if (userId === req.session.user.id) {
        return res.status(400).json({ success: false, message: 'Kendinizi banlayamazsınız!' });
    }

    try {
        const users = getJsonData('data/users.json');
        if (!users[userId]) {
            return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
        }

        users[userId].banned = !!banned;
        saveJsonData('data/users.json', users);

        // Eğer banlandıysa ve projeleri çalışıyorsa, durdur
        if (users[userId].banned) {
            const projects = getJsonData('data/projects.json');
            Object.keys(projects).forEach(projectId => {
                if (projects[projectId].owner === userId) {
                    processManager.stopProject(projectId);
                }
            });
        }

        res.json({ success: true, message: banned ? 'Kullanıcı yasaklandı' : 'Kullanıcının yasağı kaldırıldı' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'İşlem başarısız oldu' });
    }
});

/**
 * POST /api/owner/project/:id/:action
 * Herhangi bir müşterinin projesine müdahale et
 */
router.post('/project/:id/:action', async (req, res) => {
    const { id, action } = req.params;
    const projects = getJsonData('data/projects.json');
    const project = projects[id];

    if (!project) return res.status(404).json({ success: false, message: 'Proje bulunamadı' });

    try {
        if (action === 'start') {
            await processManager.startProject(id, project);
            res.json({ success: true, message: 'Proje başlatıldı' });
        } else if (action === 'stop') {
            await processManager.stopProject(id);
            res.json({ success: true, message: 'Proje durduruldu' });
        } else if (action === 'restart') {
            await processManager.restartProject(id, project);
            res.json({ success: true, message: 'Proje yeniden başlatıldı' });
        } else {
            res.status(400).json({ success: false, message: 'Geçersiz işlem' });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * DELETE /api/owner/project/:id
 * Herhangi bir müşterinin projesini tamamen sil
 */
router.delete('/project/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        await processManager.stopProject(id);
        
        const projects = getJsonData('data/projects.json');
        delete projects[id];
        saveJsonData('data/projects.json', projects);
        
        fs.removeSync(path.join(process.cwd(), 'projects', id));
        
        res.json({ success: true, message: 'Proje kalıcı olarak silindi' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Proje silinirken hata oluştu' });
    }
});

/**
 * POST /api/owner/announce
 * Sistem genelinde duyuru yayınla
 */
router.post('/announce', (req, res) => {
    const { title, message, type = 'info' } = req.body;
    
    if (!title || !message) {
        return res.status(400).json({ success: false, message: 'Başlık ve mesaj zorunludur' });
    }

    const announcements = getJsonData('data/announcements.json') || [];
    announcements.unshift({
        id: Date.now().toString(),
        title,
        message,
        type, // info, warning, success
        date: new Date().toISOString(),
        author: req.session.user.username
    });

    // En fazla son 10 duyuruyu tut
    saveJsonData('data/announcements.json', announcements.slice(0, 10));

    res.json({ success: true, message: 'Duyuru yayınlandı' });
});

// Yardımcı fonksiyonlar
function getJsonData(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        return filePath.includes('[]') ? [] : {};
    }
}

function saveJsonData(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

module.exports = router;
