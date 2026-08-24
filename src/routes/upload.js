/**
 * ============================================
 * APEX | Hosting — Upload Routes
 * .zip dosyası yükleme, çıkartma ve projeyi kaydetme
 * ============================================
 */

const express = require('express');
const multer = require('multer');
const AdmZip = require('adm-zip');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/auth.middleware');
const processManager = require('../utils/processManager');

const router = express.Router();
router.use(requireAuth);

// Multer yapılandırması (Belleğe veya geçici klasöre yükleme)
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
            cb(null, true);
        } else {
            cb(new Error('Sadece .zip dosyaları yüklenebilir!'));
        }
    }
});

/**
 * POST /api/upload
 * Müşteri .zip yükler, çıkartılır, proje oluşturulur ve otomatik başlatılır
 */
router.post('/', upload.single('projectFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Lütfen bir .zip dosyası seçin' });
    }

    const { projectName, projectType, mainFile = 'index.js' } = req.body;
    
    if (!projectName || !projectType) {
        fs.removeSync(req.file.path);
        return res.status(400).json({ success: false, message: 'Proje adı ve tipi zorunludur' });
    }

    const projectId = uuidv4();
    const projectDir = path.join(process.cwd(), 'projects', projectId);

    try {
        // Klasörü oluştur
        await fs.ensureDir(projectDir);

        // Zip'i çıkart
        const zip = new AdmZip(req.file.path);
        zip.extractAllTo(projectDir, true);

        // Geçici zip dosyasını sil
        await fs.remove(req.file.path);

        // İç içe klasör kontrolü (Eğer zip içindeki tek şey bir klasörse, içeriğini bir üst dizine taşı)
        const items = await fs.readdir(projectDir);
        if (items.length === 1 && (await fs.stat(path.join(projectDir, items[0]))).isDirectory()) {
            const subDir = path.join(projectDir, items[0]);
            const subItems = await fs.readdir(subDir);
            for (const item of subItems) {
                await fs.move(path.join(subDir, item), path.join(projectDir, item));
            }
            await fs.remove(subDir);
        }

        // Projeyi veritabanına kaydet
        const projectsData = JSON.parse(await fs.readFile('data/projects.json', 'utf8'));
        
        const newProject = {
            id: projectId,
            name: projectName,
            type: projectType, // 'bot' veya 'website'
            mainFile: mainFile,
            owner: req.session.user.id,
            createdAt: new Date().toISOString(),
            status: 'stopped'
        };

        projectsData[projectId] = newProject;
        await fs.writeFile('data/projects.json', JSON.stringify(projectsData, null, 2));

        // Projeyi otomatik olarak BAŞLAT! (npm install processManager içinde yapılacak)
        await processManager.startProject(projectId, newProject);

        res.json({ 
            success: true, 
            message: 'Proje başarıyla yüklendi ve başlatılıyor!',
            projectId 
        });

    } catch (err) {
        console.error('[UPLOAD ERROR]', err);
        // Hata durumunda oluşturulan klasörü ve dosyayı temizle
        if (req.file) await fs.remove(req.file.path).catch(() => {});
        await fs.remove(projectDir).catch(() => {});
        
        res.status(500).json({ 
            success: false, 
            message: 'Dosya işlenirken bir hata oluştu: ' + err.message 
        });
    }
});

module.exports = router;
