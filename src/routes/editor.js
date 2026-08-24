/**
 * ============================================
 * APEX | Hosting — Editor Routes (File Manager)
 * Kod düzenleme, dosya okuma ve kaydetme
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
 * Sahiplik kontrolü
 */
const getProjectOwner = async (req) => {
    const projects = JSON.parse(await fs.readFile('data/projects.json', 'utf8'));
    const project = projects[req.params.id];
    if (!project) throw new Error('Proje bulunamadı');
    return project.owner;
};

// Güvenli dosya yolu kontrolü (Path traversal önlemi)
const getSafePath = (projectId, reqPath) => {
    const baseDir = path.join(process.cwd(), 'projects', projectId);
    const targetPath = path.join(baseDir, reqPath || '');
    
    if (!targetPath.startsWith(baseDir)) {
        throw new Error('Geçersiz dosya yolu!');
    }
    return { targetPath, baseDir };
};

/**
 * GET /api/editor/:id/files
 * Projedeki klasör ağacını getirir
 */
router.get('/:id/files', requireOwnership(getProjectOwner), async (req, res) => {
    try {
        const { targetPath } = getSafePath(req.params.id, '');
        
        const buildTree = async (dir, rootDir) => {
            const items = await fs.readdir(dir);
            const tree = [];
            
            for (const item of items) {
                // node_modules ve gizli dosyaları gizle (isteğe bağlı, şimdilik sadece node_modules gizleniyor)
                if (item === 'node_modules' || item === '.git') continue;
                
                const itemPath = path.join(dir, item);
                const stat = await fs.stat(itemPath);
                
                const relativePath = path.relative(rootDir, itemPath).replace(/\\/g, '/');
                
                if (stat.isDirectory()) {
                    tree.push({
                        type: 'directory',
                        name: item,
                        path: relativePath,
                        children: await buildTree(itemPath, rootDir)
                    });
                } else {
                    tree.push({
                        type: 'file',
                        name: item,
                        path: relativePath,
                        size: stat.size
                    });
                }
            }
            
            // Klasörler üstte, dosyalar altta
            return tree.sort((a, b) => {
                if (a.type === b.type) return a.name.localeCompare(b.name);
                return a.type === 'directory' ? -1 : 1;
            });
        };

        const fileTree = await buildTree(targetPath, targetPath);
        res.json({ success: true, files: fileTree });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/editor/:id/file?filePath=...
 * Dosya içeriğini okur
 */
router.get('/:id/file', requireOwnership(getProjectOwner), async (req, res) => {
    try {
        const { filePath } = req.query;
        if (!filePath) return res.status(400).json({ success: false, message: 'Dosya yolu gerekli' });
        
        const { targetPath } = getSafePath(req.params.id, filePath);
        
        if (!fs.existsSync(targetPath)) {
            return res.status(404).json({ success: false, message: 'Dosya bulunamadı' });
        }
        
        const stat = await fs.stat(targetPath);
        if (stat.size > 5 * 1024 * 1024) { // 5MB'dan büyük dosyaları tarayıcıda açma
            return res.status(400).json({ success: false, message: 'Dosya düzenlemek için çok büyük' });
        }

        const content = await fs.readFile(targetPath, 'utf8');
        res.json({ success: true, content });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/editor/:id/file
 * Dosyayı kaydeder ve PROJEYİ OTOMATİK YENİDEN BAŞLATIR
 */
router.post('/:id/file', requireOwnership(getProjectOwner), async (req, res) => {
    try {
        const { filePath, content } = req.body;
        if (!filePath) return res.status(400).json({ success: false, message: 'Dosya yolu gerekli' });
        
        const { targetPath } = getSafePath(req.params.id, filePath);
        
        // Dosyayı kaydet
        await fs.writeFile(targetPath, content, 'utf8');
        
        // Dosya kaydedildikten sonra projeyi OTOMATİK yeniden başlat (Auto-Restart)
        const projects = JSON.parse(await fs.readFile('data/projects.json', 'utf8'));
        const project = projects[req.params.id];
        
        // Sadece proje o an çalışıyorsa yeniden başlat, çalışmıyorsa sadece dosyayı kaydet
        const processInfo = processManager.getProcessInfo(req.params.id);
        if (processInfo.running) {
            await processManager.restartProject(req.params.id, project);
            return res.json({ success: true, message: 'Dosya kaydedildi ve proje yeniden başlatıldı (Auto-Restart)!' });
        }
        
        res.json({ success: true, message: 'Dosya başarıyla kaydedildi.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
