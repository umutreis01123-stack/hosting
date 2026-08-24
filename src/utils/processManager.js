/**
 * ============================================
 * APEX | Hosting — Process Manager
 * child_process ile bot/web projelerini yönetir
 * Her proje izole bir Node.js sürecinde çalışır
 * ============================================
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');

// Çalışan süreçlerin kaydı
// { projectId: { process, logs, startTime, subscribers, restartCount } }
const runningProcesses = new Map();

// Log tamponu (her proje için son 500 satır)
const LOG_BUFFER_SIZE = 500;

// WebSocket sunucusu referansı
let wssInstance = null;

/**
 * WebSocket sunucusunu ayarla
 * @param {WebSocket.Server} wss
 */
function setWss(wss) {
    wssInstance = wss;
}

/**
 * Projeyi başlat
 * @param {string} projectId - Proje ID'si
 * @param {object} project - Proje verisi (type, path, mainFile)
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function startProject(projectId, project) {
    // Zaten çalışıyorsa durdur
    if (runningProcesses.has(projectId)) {
        await stopProject(projectId);
    }

    const projectPath = path.join(process.cwd(), 'projects', projectId);

    if (!fs.existsSync(projectPath)) {
        throw new Error('Proje dizini bulunamadı');
    }

    // npm install çalıştır (package.json varsa)
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
        await runNpmInstall(projectPath);
    }

    // Başlatma komutunu belirle
    const { cmd, args } = getStartCommand(project, projectPath);

    // Süreci başlat
    const proc = spawn(cmd, args, {
        cwd: projectPath,
        env: { ...process.env, PORT: getProjectPort(projectId) },
        shell: true
    });

    const processData = {
        process: proc,
        logs: [],
        startTime: Date.now(),
        restartCount: 0,
        subscribers: new Set()
    };

    runningProcesses.set(projectId, processData);

    // stdout logları yakala
    proc.stdout.on('data', (data) => {
        const line = `[STDOUT] ${data.toString().trim()}`;
        addLog(projectId, line);
    });

    // stderr logları yakala
    proc.stderr.on('data', (data) => {
        const line = `[STDERR] ${data.toString().trim()}`;
        addLog(projectId, line);
    });

    // Süreç kapandığında
    proc.on('close', (code) => {
        const exitLine = `[SYSTEM] Süreç kapandı (kod: ${code}) — ${new Date().toLocaleString('tr-TR')}`;
        addLog(projectId, exitLine);
        
        // Süreç kaydını güncelle ama tamamen kaldırma (log'lar kalsın)
        if (runningProcesses.has(projectId)) {
            const data = runningProcesses.get(projectId);
            data.process = null; // Süreç artık çalışmıyor
        }
        
        // projects.json'da durumu güncelle
        updateProjectStatus(projectId, 'stopped');
    });

    proc.on('error', (err) => {
        const errLine = `[ERROR] ${err.message}`;
        addLog(projectId, errLine);
    });

    // projects.json'da durumu güncelle
    updateProjectStatus(projectId, 'running');

    return { success: true, message: 'Proje başarıyla başlatıldı' };
}

/**
 * Projeyi durdur
 * @param {string} projectId
 */
async function stopProject(projectId) {
    const data = runningProcesses.get(projectId);
    
    if (!data || !data.process) {
        updateProjectStatus(projectId, 'stopped');
        return { success: true, message: 'Proje zaten durmuş' };
    }

    return new Promise((resolve) => {
        const proc = data.process;
        
        proc.once('close', () => {
            runningProcesses.delete(projectId);
            updateProjectStatus(projectId, 'stopped');
            resolve({ success: true, message: 'Proje durduruldu' });
        });

        // Önce nazikçe kapat, 5 saniye sonra zorla kapat
        proc.kill('SIGTERM');
        setTimeout(() => {
            if (!proc.killed) proc.kill('SIGKILL');
        }, 5000);
    });
}

/**
 * Projeyi yeniden başlat
 * @param {string} projectId
 * @param {object} project
 */
async function restartProject(projectId, project) {
    await stopProject(projectId);
    // Kısa bekleme
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const data = runningProcesses.get(projectId) || { restartCount: 0, logs: [] };
    const result = await startProject(projectId, project);
    
    if (runningProcesses.has(projectId)) {
        runningProcesses.get(projectId).restartCount = (data.restartCount || 0) + 1;
    }
    
    return result;
}

/**
 * Projenin çalışma bilgilerini getir
 * @param {string} projectId
 */
function getProcessInfo(projectId) {
    const data = runningProcesses.get(projectId);
    
    if (!data) {
        return { running: false, uptime: 0, logs: [] };
    }

    return {
        running: data.process !== null && !data.process.killed,
        uptime: data.startTime ? Date.now() - data.startTime : 0,
        logs: data.logs.slice(-100), // Son 100 satır
        restartCount: data.restartCount || 0
    };
}

/**
 * Log ekle ve abonelere gönder
 * @param {string} projectId
 * @param {string} line
 */
function addLog(projectId, line) {
    const timestamp = new Date().toLocaleTimeString('tr-TR');
    const logEntry = `[${timestamp}] ${line}`;
    
    if (!runningProcesses.has(projectId)) {
        runningProcesses.set(projectId, { logs: [], subscribers: new Set(), process: null, startTime: null });
    }
    
    const data = runningProcesses.get(projectId);
    data.logs.push(logEntry);
    
    // Buffer boyutunu aş
    if (data.logs.length > LOG_BUFFER_SIZE) {
        data.logs = data.logs.slice(-LOG_BUFFER_SIZE);
    }

    // WebSocket abonelerine gönder
    broadcastLog(projectId, logEntry);
}

/**
 * Log'u WebSocket abonelerine yayınla
 * @param {string} projectId
 * @param {string} logLine
 */
function broadcastLog(projectId, logLine) {
    const data = runningProcesses.get(projectId);
    if (!data) return;

    const message = JSON.stringify({ type: 'log', projectId, line: logLine });
    
    data.subscribers.forEach(ws => {
        if (ws.readyState === 1) { // OPEN
            ws.send(message);
        }
    });
}

/**
 * Log akışına abone ol
 * @param {string} projectId
 * @param {WebSocket} ws
 */
function subscribeToLogs(projectId, ws) {
    if (!runningProcesses.has(projectId)) {
        runningProcesses.set(projectId, { logs: [], subscribers: new Set(), process: null, startTime: null });
    }
    
    const data = runningProcesses.get(projectId);
    data.subscribers.add(ws);

    // Önceki logları gönder
    data.logs.slice(-100).forEach(line => {
        if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'log', projectId, line }));
        }
    });
}

/**
 * Log akışı aboneliğini iptal et
 * @param {string} projectId
 * @param {WebSocket} ws
 */
function unsubscribeFromLogs(projectId, ws) {
    const data = runningProcesses.get(projectId);
    if (data) data.subscribers.delete(ws);
}

/**
 * npm install çalıştır
 * @param {string} projectPath
 */
function runNpmInstall(projectPath) {
    return new Promise((resolve, reject) => {
        exec('npm install --production', { cwd: projectPath }, (error, stdout, stderr) => {
            if (error) {
                console.error('[NPM INSTALL ERROR]', error.message);
                // Hata olsa bile devam et
                resolve();
            } else {
                resolve();
            }
        });
    });
}

/**
 * Proje türüne göre başlatma komutunu belirle
 * @param {object} project
 * @param {string} projectPath
 */
function getStartCommand(project, projectPath) {
    if (project.type === 'website') {
        // package.json start scripti varsa onu kullan
        const packageJsonPath = path.join(projectPath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            if (pkg.scripts && pkg.scripts.start) {
                return { cmd: 'npm', args: ['start'] };
            }
        }
        
        // HTML/Static site — basit HTTP sunucu
        const indexHtml = path.join(projectPath, 'index.html');
        if (fs.existsSync(indexHtml)) {
            // npx serve kullan
            return { cmd: 'npx', args: ['serve', '-s', '.', '-l', getProjectPort(null)] };
        }
    }
    
    // Discord Bot veya Node.js projesi
    const mainFile = project.mainFile || findMainFile(projectPath);
    return { cmd: 'node', args: [mainFile] };
}

/**
 * Projede ana dosyayı bul
 * @param {string} projectPath
 */
function findMainFile(projectPath) {
    // package.json main alanını kontrol et
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (pkg.main) return pkg.main;
    }
    
    // Yaygın dosya isimlerini dene
    const candidates = ['index.js', 'app.js', 'main.js', 'bot.js', 'server.js', 'start.js'];
    for (const candidate of candidates) {
        if (fs.existsSync(path.join(projectPath, candidate))) {
            return candidate;
        }
    }
    
    return 'index.js'; // Varsayılan
}

/**
 * Proje için port numarası ata (3001'den başlayarak)
 * @param {string} projectId
 */
function getProjectPort(projectId) {
    if (!projectId) return 3001;
    
    let portMap = {};
    if (fs.existsSync('data/ports.json')) {
        portMap = JSON.parse(fs.readFileSync('data/ports.json', 'utf8'));
    }
    
    if (!portMap[projectId]) {
        const usedPorts = Object.values(portMap);
        let port = 3001;
        while (usedPorts.includes(port)) port++;
        portMap[projectId] = port;
        fs.writeFileSync('data/ports.json', JSON.stringify(portMap, null, 2));
    }
    
    return portMap[projectId];
}

/**
 * projects.json'da proje durumunu güncelle
 * @param {string} projectId
 * @param {string} status
 */
function updateProjectStatus(projectId, status) {
    try {
        const projectsData = JSON.parse(fs.readFileSync('data/projects.json', 'utf8'));
        if (projectsData[projectId]) {
            projectsData[projectId].status = status;
            if (status === 'running') {
                projectsData[projectId].startedAt = new Date().toISOString();
            }
            fs.writeFileSync('data/projects.json', JSON.stringify(projectsData, null, 2));
        }
    } catch (err) {
        console.error('[PROCESS MANAGER] Durum güncellenemedi:', err.message);
    }
}

/**
 * Tüm projeleri durdur (sunucu kapanışında)
 */
function stopAll() {
    console.log('[APEX] Tüm projeler durduruluyor...');
    runningProcesses.forEach((data, projectId) => {
        if (data.process) {
            data.process.kill('SIGTERM');
        }
    });
    runningProcesses.clear();
}

/**
 * Tüm çalışan süreçlerin listesi
 */
function getRunningProjects() {
    const result = [];
    runningProcesses.forEach((data, projectId) => {
        result.push({
            projectId,
            running: data.process !== null && !data.process?.killed,
            uptime: data.startTime ? Date.now() - data.startTime : 0,
            restartCount: data.restartCount || 0
        });
    });
    return result;
}

module.exports = {
    setWss,
    startProject,
    stopProject,
    restartProject,
    getProcessInfo,
    getRunningProjects,
    subscribeToLogs,
    unsubscribeFromLogs,
    addLog,
    stopAll
};
