/**
 * ============================================
 * APEX | Hosting â€” Process Manager
 * child_process ile bot/web projelerini yÃ¶netir
 * Her proje izole bir Node.js sÃ¼recinde Ã§alÄ±ÅŸÄ±r
 * ============================================
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');

// Ã‡alÄ±ÅŸan sÃ¼reÃ§lerin kaydÄ±
// { projectId: { process, logs, startTime, subscribers, restartCount } }
const runningProcesses = new Map();

// Log tamponu (her proje iÃ§in son 500 satÄ±r)
const LOG_BUFFER_SIZE = 500;

// WebSocket sunucusu referansÄ±
let wssInstance = null;

/**
 * WebSocket sunucusunu ayarla
 * @param {WebSocket.Server} wss
 */
function setWss(wss) {
    wssInstance = wss;
}

/**
 * Projeyi baÅŸlat
 * @param {string} projectId - Proje ID'si
 * @param {object} project - Proje verisi (type, path, mainFile)
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function startProject(projectId, project) {
    // Zaten Ã§alÄ±ÅŸÄ±yorsa durdur
    if (runningProcesses.has(projectId)) {
        await stopProject(projectId);
    }

    const projectPath = path.join(process.cwd(), 'projects', projectId);

    if (!fs.existsSync(projectPath)) {
        throw new Error('Proje dizini bulunamadÄ±');
    }

    // npm install Ã§alÄ±ÅŸtÄ±r (package.json varsa)
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
        await runNpmInstall(projectPath);
    }

    // BaÅŸlatma komutunu belirle
    const { cmd, args } = getStartCommand(project, projectPath);

    // SÃ¼reci baÅŸlat
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

    // stdout loglarÄ± yakala
    proc.stdout.on('data', (data) => {
        const line = `[STDOUT] ${data.toString().trim()}`;
        addLog(projectId, line);
    });

    // stderr loglarÄ± yakala
    proc.stderr.on('data', (data) => {
        const line = `[STDERR] ${data.toString().trim()}`;
        addLog(projectId, line);
    });

    // SÃ¼reÃ§ kapandÄ±ÄŸÄ±nda
    proc.on('close', (code) => {
        const exitLine = `[SYSTEM] SÃ¼reÃ§ kapandÄ± (kod: ${code}) â€” ${new Date().toLocaleString('tr-TR')}`;
        addLog(projectId, exitLine);
        
        // SÃ¼reÃ§ kaydÄ±nÄ± gÃ¼ncelle ama tamamen kaldÄ±rma (log'lar kalsÄ±n)
        if (runningProcesses.has(projectId)) {
            const data = runningProcesses.get(projectId);
            data.process = null; // SÃ¼reÃ§ artÄ±k Ã§alÄ±ÅŸmÄ±yor
        }
        
        // projects.json'da durumu gÃ¼ncelle
        updateProjectStatus(projectId, 'stopped');
    });

    proc.on('error', (err) => {
        const errLine = `[ERROR] ${err.message}`;
        addLog(projectId, errLine);
    });

    // projects.json'da durumu gÃ¼ncelle
    updateProjectStatus(projectId, 'running');

    return { success: true, message: 'Proje baÅŸarÄ±yla baÅŸlatÄ±ldÄ±' };
}

/**
 * Projeyi durdur
 * @param {string} projectId
 */
async function stopProject(projectId) {
    const data = runningProcesses.get(projectId);
    
    if (!data || !data.process) {
        updateProjectStatus(projectId, 'stopped');
        return { success: true, message: 'Proje zaten durmuÅŸ' };
    }

    return new Promise((resolve) => {
        const proc = data.process;
        
        proc.once('close', () => {
            runningProcesses.delete(projectId);
            updateProjectStatus(projectId, 'stopped');
            resolve({ success: true, message: 'Proje durduruldu' });
        });

        // Ã–nce nazikÃ§e kapat, 5 saniye sonra zorla kapat
        proc.kill('SIGTERM');
        setTimeout(() => {
            if (!proc.killed) proc.kill('SIGKILL');
        }, 5000);
    });
}

/**
 * Projeyi yeniden baÅŸlat
 * @param {string} projectId
 * @param {object} project
 */
async function restartProject(projectId, project) {
    await stopProject(projectId);
    // KÄ±sa bekleme
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const data = runningProcesses.get(projectId) || { restartCount: 0, logs: [] };
    const result = await startProject(projectId, project);
    
    if (runningProcesses.has(projectId)) {
        runningProcesses.get(projectId).restartCount = (data.restartCount || 0) + 1;
    }
    
    return result;
}

/**
 * Projenin Ã§alÄ±ÅŸma bilgilerini getir
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
        logs: data.logs.slice(-100), // Son 100 satÄ±r
        restartCount: data.restartCount || 0
    };
}

/**
 * Log ekle ve abonelere gÃ¶nder
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
    
    // Buffer boyutunu aÅŸ
    if (data.logs.length > LOG_BUFFER_SIZE) {
        data.logs = data.logs.slice(-LOG_BUFFER_SIZE);
    }

    // WebSocket abonelerine gÃ¶nder
    broadcastLog(projectId, logEntry);
}

/**
 * Log'u WebSocket abonelerine yayÄ±nla
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
 * Log akÄ±ÅŸÄ±na abone ol
 * @param {string} projectId
 * @param {WebSocket} ws
 */
function subscribeToLogs(projectId, ws) {
    if (!runningProcesses.has(projectId)) {
        runningProcesses.set(projectId, { logs: [], subscribers: new Set(), process: null, startTime: null });
    }
    
    const data = runningProcesses.get(projectId);
    data.subscribers.add(ws);

    // Ã–nceki loglarÄ± gÃ¶nder
    data.logs.slice(-100).forEach(line => {
        if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'log', projectId, line }));
        }
    });
}

/**
 * Log akÄ±ÅŸÄ± aboneliÄŸini iptal et
 * @param {string} projectId
 * @param {WebSocket} ws
 */
function unsubscribeFromLogs(projectId, ws) {
    const data = runningProcesses.get(projectId);
    if (data) data.subscribers.delete(ws);
}

/**
 * npm install Ã§alÄ±ÅŸtÄ±r
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
 * Proje tÃ¼rÃ¼ne gÃ¶re baÅŸlatma komutunu belirle
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
        
        // HTML/Static site â€” basit HTTP sunucu
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
 * Projede ana dosyayÄ± bul
 * @param {string} projectPath
 */
function findMainFile(projectPath) {
    // package.json main alanÄ±nÄ± kontrol et
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (pkg.main) return pkg.main;
    }
    
    // YaygÄ±n dosya isimlerini dene
    const candidates = ['index.js', 'app.js', 'main.js', 'bot.js', 'server.js', 'start.js'];
    for (const candidate of candidates) {
        if (fs.existsSync(path.join(projectPath, candidate))) {
            return candidate;
        }
    }
    
    return 'index.js'; // VarsayÄ±lan
}

/**
 * Proje iÃ§in port numarasÄ± ata (3001'den baÅŸlayarak)
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
 * projects.json'da proje durumunu gÃ¼ncelle
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
        console.error('[PROCESS MANAGER] Durum gÃ¼ncellenemedi:', err.message);
    }
}

/**
 * TÃ¼m projeleri durdur (sunucu kapanÄ±ÅŸÄ±nda)
 */
function stopAll() {
    console.log('[APEX] TÃ¼m projeler durduruluyor...');
    runningProcesses.forEach((data, projectId) => {
        if (data.process) {
            data.process.kill('SIGTERM');
        }
    });
    runningProcesses.clear();
}

/**
 * TÃ¼m Ã§alÄ±ÅŸan sÃ¼reÃ§lerin listesi
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

