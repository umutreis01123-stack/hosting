const fs = require('fs');
const path = require('path');
const processManager = require('./processManager');

const USERS_FILE = path.join(__dirname, '../../data/users.json');
const PROJECTS_FILE = path.join(__dirname, '../../data/projects.json');

// 1 Gün = 100 Kredi
// 1 Dakika = ~0.0694 Kredi
const CREDITS_PER_MINUTE = 0.069444; 

function startCron() {
    console.log('[SİSTEM] Kredi yöneticisi (Cron) başlatıldı.');
    
    setInterval(() => {
        try {
            if (!fs.existsSync(USERS_FILE) || !fs.existsSync(PROJECTS_FILE)) return;

            let users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
            let projects = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
            
            let running = processManager.getRunningProjects().filter(p => p.running);
            if (running.length === 0) return;

            let updated = false;
            let usersWithRunningProjects = new Set();

            running.forEach(r => {
                if (projects[r.projectId]) {
                    usersWithRunningProjects.add(projects[r.projectId].userId);
                }
            });

            usersWithRunningProjects.forEach(userId => {
                if (users[userId]) {
                    if (users[userId].credits === undefined) users[userId].credits = 0;

                    if (users[userId].credits > 0) {
                        users[userId].credits -= CREDITS_PER_MINUTE;
                        updated = true;
                    }

                    if (users[userId].credits <= 0) {
                        users[userId].credits = 0;
                        updated = true;
                        
                        running.forEach(r => {
                            if (projects[r.projectId] && projects[r.projectId].userId === userId) {
                                processManager.stopProject(r.projectId);
                                processManager.addLog(r.projectId, "\n[SİSTEM-UYARI] KREDİNİZ BİTTİĞİ İÇİN PROJENİZ OTOMATİK OLARAK DURDURULDU!");
                                processManager.addLog(r.projectId, "[SİSTEM-UYARI] Lütfen yetkililerle iletişime geçerek kredi yükleyin.\n");
                            }
                        });
                    }
                }
            });

            if (updated) {
                fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
            }

        } catch(e) {
            console.error("[CREDIT_MANAGER] Hata:", e.message);
        }
    }, 60000); // Her 1 dakikada
}

function addCredits(userId, amount) {
    if (!fs.existsSync(USERS_FILE)) return false;
    let users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    if (!users[userId]) return false;
    if (users[userId].credits === undefined) users[userId].credits = 0;
    users[userId].credits += Number(amount);
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    return true;
}

function setCredits(userId, amount) {
    if (!fs.existsSync(USERS_FILE)) return false;
    let users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    if (!users[userId]) return false;
    users[userId].credits = Number(amount);
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    return true;
}

function getCredits(userId) {
    if (!fs.existsSync(USERS_FILE)) return 0;
    let users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    if (!users[userId]) return 0;
    return users[userId].credits || 0;
}

module.exports = { startCron, addCredits, setCredits, getCredits };
