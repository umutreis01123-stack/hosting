// State
let currentUser = null;
let currentProject = null;
let editor = null;
let ws = null;
let currentFilePath = null;

// DOM Elements
const appLayout = document.getElementById('app-layout');
const ownerModal = document.getElementById('owner-modal');
const views = document.querySelectorAll('.view');
const menuLinks = document.querySelectorAll('.menu a');
const terminal = document.getElementById('terminal-output');

// Init CodeMirror
document.addEventListener('DOMContentLoaded', () => {
    editor = CodeMirror.fromTextArea(document.getElementById("code-editor"), {
        lineNumbers: true,
        theme: "monokai",
        mode: "javascript",
        matchBrackets: true,
        autoCloseBrackets: true
    });
    editor.setSize("100%", "100%");

    // Editörde değişiklik olduğunda kaydet butonunu aktif et
    editor.on("change", () => {
        if (currentFilePath) {
            document.getElementById('btn-save-file').disabled = false;
        }
    });

    checkAuth();
});

// Auth Check
async function checkAuth() {
    try {
        const res = await fetch('/auth/me');
        const data = await res.json();
        
        if (!data.loggedIn) {
            window.location.href = '/?error=login_required';
            return;
        }

        currentUser = data.user;
        document.getElementById('user-name').textContent = currentUser.username;
        document.getElementById('user-avatar').src = currentUser.avatar;

        // Owner kontrolü - Modal göster veya sidebar linkini aç
        const urlParams = new URLSearchParams(window.location.search);
        if (data.ownerPending || urlParams.get('ownerLogin') === '1') {
            ownerModal.style.display = 'flex';
        } else {
            appLayout.style.display = 'flex';
            loadProjects();
            // Eğer owner ise sidebar'daki Kurucu Paneli butonunu göster
            if (data.isOwner) {
                const ownerNavLink = document.getElementById('nav-owner-link');
                if (ownerNavLink) ownerNavLink.style.display = 'flex';
            }
        }
    } catch (err) {
        console.error('Auth check error', err);
    }
}

// Owner Verify
document.getElementById('btn-owner-verify')?.addEventListener('click', async () => {
    const password = document.getElementById('owner-password').value;
    const errorDiv = document.getElementById('owner-error');
    
    try {
        const res = await fetch('/auth/owner/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        
        const data = await res.json();
        if (data.success) {
            window.location.href = data.redirect; // Owner paneline git
        } else {
            errorDiv.textContent = data.message;
        }
    } catch (err) {
        errorDiv.textContent = 'Bağlantı hatası.';
    }
});

// View Switcher
function switchView(viewId) {
    views.forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${viewId}`).classList.add('active');
    
    menuLinks.forEach(l => l.classList.remove('active'));
    const link = document.querySelector(`.menu a[data-view="${viewId}"]`);
    if(link) link.classList.add('active');

    if (viewId === 'projects') loadProjects();
    if (viewId === 'project-detail' && currentProject) {
        setTimeout(() => editor.refresh(), 100);
    }
}

menuLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = e.currentTarget.getAttribute('data-view');
        if(view) switchView(view);
    });
});

// ─── Projeler ─────────────────────────────────────────────────────────────

async function loadProjects() {
    try {
        const res = await fetch('/api/projects');
        const data = await res.json();
        
        const list = document.getElementById('projects-list');
        if (!data.success || data.projects.length === 0) {
            list.innerHTML = `
                <div style="grid-column: 1/-1; text-align:center; padding: 3rem; background: var(--bg-card); border-radius:10px;">
                    <i class="fa-solid fa-folder-open" style="font-size: 3rem; color:var(--text-muted); margin-bottom:1rem;"></i>
                    <h3>Henüz projeniz yok</h3>
                    <p style="color:var(--text-muted); margin-bottom:1rem;">Hemen bir .zip yükleyerek botunuzu veya sitenizi başlatın.</p>
                    <button class="btn-primary" onclick="switchView('upload')">Yeni Yükle</button>
                </div>
            `;
            return;
        }

        list.innerHTML = data.projects.map(p => `
            <div class="project-card" onclick="openProject('${p.id}', '${p.name}', ${p.running})">
                <div class="project-card-header">
                    <div>
                        <h3>${p.name}</h3>
                        <span class="project-type">${p.type === 'bot' ? 'Discord Bot' : 'Web Sitesi'}</span>
                    </div>
                    <span class="status-badge ${p.running ? 'status-running' : 'status-stopped'}">
                        ${p.running ? 'Çalışıyor' : 'Durduruldu'}
                    </span>
                </div>
                <div style="font-size: 0.85rem; color:var(--text-muted);">
                    <i class="fa-regular fa-clock"></i> Uptime: ${formatUptime(p.uptime)}
                </div>
            </div>
        `).join('');
    } catch (err) {
        document.getElementById('projects-list').innerHTML = '<div class="alert error">Projeler yüklenirken hata oluştu.</div>';
    }
}

function formatUptime(ms) {
    if(!ms) return '0s';
    const s = Math.floor(ms/1000);
    const h = Math.floor(s/3600);
    const m = Math.floor((s%3600)/60);
    return `${h > 0 ? h+'s ' : ''}${m > 0 ? m+'d ' : ''}${s%60}sn`;
}

// ─── Proje Detay & Terminal ───────────────────────────────────────────────

async function openProject(id, name, running) {
    currentProject = id;
    document.getElementById('detail-name').textContent = name;
    updateStatusUI(running);
    switchView('project-detail');
    
    // Klasör ağacını yükle
    loadFiles(id);
    
    // WebSocket bağlan
    connectWebSocket(id);

    // Güncel status çek
    fetchStatus();
}

function updateStatusUI(running) {
    const badge = document.getElementById('detail-status');
    badge.textContent = running ? 'Çalışıyor' : 'Durduruldu';
    badge.className = `status-badge ${running ? 'status-running' : 'status-stopped'}`;
    
    document.getElementById('btn-start').disabled = running;
    document.getElementById('btn-stop').disabled = !running;
    document.getElementById('btn-restart').disabled = !running;
}

async function projectAction(action) {
    if(!currentProject) return;
    try {
        const res = await fetch(`/api/projects/${currentProject}/${action}`, { method: 'POST' });
        const data = await res.json();
        
        if (data.success) {
            terminal.innerHTML += `<div class="term-sys">[SİSTEM] ${data.message}</div>`;
            fetchStatus();
        } else {
            alert(data.message);
        }
    } catch(err) {
        alert('İşlem başarısız');
    }
}

async function fetchStatus() {
    if(!currentProject) return;
    const res = await fetch(`/api/projects/${currentProject}/status`);
    const data = await res.json();
    if(data.success) {
        updateStatusUI(data.status.running);
        document.getElementById('detail-uptime').innerHTML = `<i class="fa-regular fa-clock"></i> ${formatUptime(data.status.uptime)}`;
    }
}

async function deleteProject() {
    if(!confirm("Bu projeyi tamamen silmek istediğinize emin misiniz? (Geri alınamaz)")) return;
    try {
        const res = await fetch(`/api/projects/${currentProject}`, { method: 'DELETE' });
        const data = await res.json();
        if(data.success) {
            switchView('projects');
        }
    } catch(err) {
        alert('Silinemedi');
    }
}

// WebSocket Terminal
function connectWebSocket(projectId) {
    if(ws) ws.close();
    clearTerminal();
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws?projectId=${projectId}`);
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if(data.type === 'log') {
            const div = document.createElement('div');
            let text = data.line;
            
            // Renklendirme basitçe
            if(text.includes('[ERROR]') || text.includes('[STDERR]')) div.className = 'term-err';
            else if(text.includes('[SYSTEM]')) div.className = 'term-sys';
            
            div.textContent = text;
            terminal.appendChild(div);
            terminal.scrollTop = terminal.scrollHeight;
        }
    };
    
    ws.onclose = () => console.log('WS Kapandı');
}

function clearTerminal() {
    terminal.innerHTML = '';
}

// ─── Dosya Yöneticisi & Editör ──────────────────────────────────────────

async function loadFiles(projectId) {
    const tree = document.getElementById('file-tree');
    tree.innerHTML = 'Yükleniyor...';
    try {
        const res = await fetch(`/api/editor/${projectId}/files`);
        const data = await res.json();
        if(data.success) {
            tree.innerHTML = renderTree(data.files);
            bindTreeEvents();
        }
    } catch(err) {
        tree.innerHTML = 'Dosyalar yüklenemedi.';
    }
}

function renderTree(files, pathPrefix = '') {
    let html = '';
    files.forEach(f => {
        if(f.type === 'directory') {
            html += `
                <div class="tree-item directory" data-path="${f.path}">
                    <i class="fa-solid fa-folder"></i> ${f.name}
                </div>
                <div class="tree-children" style="display:none; padding-left:15px;" id="dir-${f.path.replace(/[/.]/g, '-')}">
                    ${f.children ? renderTree(f.children, f.path) : ''}
                </div>
            `;
        } else {
            // Editlenemeyecek dosyalar
            const ext = f.name.split('.').pop().toLowerCase();
            const badExts = ['zip','jpg','png','sqlite','db'];
            const icon = badExts.includes(ext) ? 'fa-file-image' : 'fa-file-code';
            
            html += `
                <div class="tree-item file" data-path="${f.path}" onclick="openFile('${f.path}', '${f.name}', '${ext}')">
                    <i class="fa-solid ${icon}"></i> ${f.name}
                </div>
            `;
        }
    });
    return html;
}

function bindTreeEvents() {
    document.querySelectorAll('.tree-item.directory').forEach(el => {
        el.onclick = (e) => {
            const childId = `dir-${el.getAttribute('data-path').replace(/[/.]/g, '-')}`;
            const childEl = document.getElementById(childId);
            if(childEl) {
                childEl.style.display = childEl.style.display === 'none' ? 'block' : 'none';
                const icon = el.querySelector('i');
                icon.className = childEl.style.display === 'none' ? 'fa-solid fa-folder' : 'fa-solid fa-folder-open';
            }
        };
    });
}

async function openFile(filePath, fileName, ext) {
    // Kötü uzantıları engelle
    if(['zip','jpg','png','sqlite','db'].includes(ext)) {
        alert('Bu dosya tipi düzenlenemez.');
        return;
    }

    document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');

    document.getElementById('current-file-name').textContent = 'Yükleniyor...';
    
    try {
        const res = await fetch(`/api/editor/${currentProject}/file?filePath=${encodeURIComponent(filePath)}`);
        const data = await res.json();
        
        if(data.success) {
            currentFilePath = filePath;
            document.getElementById('current-file-name').textContent = fileName;
            
            // Mode ayarla
            if(ext === 'json') editor.setOption("mode", "application/json");
            else if(ext === 'html') editor.setOption("mode", "htmlmixed");
            else if(ext === 'css') editor.setOption("mode", "css");
            else editor.setOption("mode", "javascript");
            
            editor.setValue(data.content);
            document.getElementById('btn-save-file').disabled = true; // Değişiklik yok
        } else {
            alert(data.message);
        }
    } catch(err) {
        alert('Dosya açılamadı.');
    }
}

// Dosya Kaydet & Auto Restart
document.getElementById('btn-save-file').addEventListener('click', async () => {
    if(!currentProject || !currentFilePath) return;
    
    const content = editor.getValue();
    const btn = document.getElementById('btn-save-file');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kaydediliyor...';
    
    try {
        const res = await fetch(`/api/editor/${currentProject}/file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: currentFilePath, content })
        });
        const data = await res.json();
        
        if(data.success) {
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Kaydedildi!';
            btn.classList.replace('success', 'primary');
            setTimeout(() => {
                btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Kaydet (Auto-Restart)';
                btn.disabled = true;
                btn.classList.replace('primary', 'success');
            }, 2000);
            
            // Proje yeniden başlıyor, status'u güncelle
            fetchStatus();
        } else {
            alert(data.message);
            btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Kaydet (Auto-Restart)';
        }
    } catch(err) {
        alert('Kaydedilemedi');
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Kaydet (Auto-Restart)';
    }
});

// ─── Yeni Yükle (Upload) ──────────────────────────────────────────────────

const uploadForm = document.getElementById('upload-form');
const upFile = document.getElementById('up-file');
const fileDrop = document.getElementById('file-drop-area');
const fileDisplay = document.getElementById('file-name-display');

upFile.addEventListener('change', (e) => {
    if(e.target.files.length > 0) {
        fileDisplay.innerHTML = `<i class="fa-solid fa-file-zipper"></i> ${e.target.files[0].name} seçildi.`;
        fileDrop.style.borderColor = 'var(--success)';
    }
});

uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const file = upFile.files[0];
    if(!file) return alert('Lütfen bir zip dosyası seçin.');
    
    const formData = new FormData();
    formData.append('projectFile', file);
    formData.append('projectName', document.getElementById('up-name').value);
    formData.append('projectType', document.getElementById('up-type').value);
    formData.append('mainFile', document.getElementById('up-main').value);
    
    const statusDiv = document.getElementById('upload-status');
    const btn = document.getElementById('btn-upload');
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Yükleniyor ve Başlatılıyor...';
    statusDiv.style.display = 'block';
    statusDiv.className = 'alert';
    statusDiv.textContent = 'Lütfen bekleyin, zip çıkartılıyor ve bağımlılıklar kuruluyor...';

    try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        
        if (data.success) {
            statusDiv.className = 'alert success';
            statusDiv.textContent = data.message;
            uploadForm.reset();
            fileDisplay.innerHTML = '';
            fileDrop.style.borderColor = 'var(--border)';
            
            // Başarılı olunca o projenin paneline git
            setTimeout(() => {
                openProject(data.projectId, formData.get('projectName'), true);
            }, 1500);
        } else {
            statusDiv.className = 'alert error';
            statusDiv.textContent = data.message;
            btn.disabled = false;
            btn.innerHTML = 'Yükle ve Başlat <i class="fa-solid fa-rocket"></i>';
        }
    } catch(err) {
        statusDiv.className = 'alert error';
        statusDiv.textContent = 'Bir hata oluştu, tekrar deneyin.';
        btn.disabled = false;
        btn.innerHTML = 'Yükle ve Başlat <i class="fa-solid fa-rocket"></i>';
    }
});

// =============================================
// APEX Yapay Zeka Destek Motoru
// =============================================
const aiResponses = [
    {
        keywords: ['bot', 'ba�lam�yor', 'ba�latam�yorum', '�al��m�yor', 'start', 'ba�lat'],
        answer: Botunuz ba�lam�yorsa �unlar� kontrol edin:\n1. Proje detay�na girip "Ba�lat" butonuna t�klay�n.\n2. Canl� konsol ekran�nda hata mesaj� var m� bak�n.\n3. <code>index.js</code> dosyas� ana dosya olarak do�ru ayarland� m� kontrol edin.\n4. <code>node_modules</code> klas�r� zip'in i�inde varsa silin, sistem otomatik kurar.
    },
    {
        keywords: ['zip', 'y�kleme', 'y�klenemedi', 'hata', 'upload', 'dosya'],
        answer: Zip y�kleme sorunlar� i�in:\n1. Zip dosyas�n�n boyutu �ok b�y�k olmamal� (max 50MB).\n2. Zip do�rudan proje dosyalar�n� i�ermeli, i�inde ba�ka bir zip olmamal�.\n3. Zip i�inde <code>package.json</code> var m� kontrol edin.
    },
    {
        keywords: ['token', 'env', '�evre', 'de�i�ken', 'gizli', 'secret'],
        answer: Gizli anahtarlar�n�z� (TOKEN, API KEY vb.) projenize ��yle ekleyebilirsiniz:\n1. Proje detay ekran�na gidin.\n2. Dosya y�neticisinde <code>.env</code> dosyas� olu�turun.\n3. ��ine <code>TOKEN=sizin_tokeniniz</code> yaz�p kaydedin.
    },
    {
        keywords: ['kapan�yor', 'duruyor', 'crash', 'kilitlendi', 'stopped'],
        answer: Bot s�rekli kapan�yorsa:\n1. Konsol ekran�ndaki hata mesaj�n� okuyun.\n2. Genellikle <code>node_modules</code> eksikli�inden kaynaklan�r. Zip'i <code>node_modules</code> olmadan y�kleyin.\n3. Botunuzun kodunda i�lenmemi� bir hata (unhandledRejection) olabilir.
    },
    {
        keywords: ['nas�l', 'ne', 'ne yapay�m', 'yard�m', 'merhaba', 'selam'],
        answer: Merhaba! Size �u konularda yard�mc� olabilirim:\n� **Bot ba�latma/durdurma** sorunlar�\n� **Zip y�kleme** hatalar�\n� **Token/ENV** de�i�keni ekleme\n� **Konsol hatalar�** yorumlama\n\nSorunuzu detayl� yazarsan�z daha iyi yard�mc� olabilirim!
    }
];

const DISCORD_SUPPORT_URL = 'https://discord.gg/apexhosting'; // De�i�tirilebilir

function sendAIMessage() {
    const input = document.getElementById('ai-chat-input');
    const chatBox = document.getElementById('ai-chat-box');
    const message = input.value.trim();
    if (!message) return;

    // Kullan�c� mesaj� ekle
    appendChatMessage(message, 'user');
    input.value = '';

    // Yapay Zeka yan�t�n� bul
    setTimeout(() => {
        const lower = message.toLowerCase();
        let found = aiResponses.find(r => r.keywords.some(k => lower.includes(k)));
        
        if (found) {
            appendChatMessage(found.answer, 'ai');
        } else {
            appendChatMessage(
                �zg�n�m, bu konuda size yeterince yard�mc� olam�yorum. Daha detayl� destek i�in Discord sunucumuzdaki canl� destek kanal�n� kullanabilirsiniz.\n\n?? <a href="" target="_blank" style="color:#7289da;font-weight:bold;">Discord'da Canl� Destek A�</a>,
                'ai'
            );
        }
    }, 600);
}

function appendChatMessage(text, type) {
    const chatBox = document.getElementById('ai-chat-box');
    const msg = document.createElement('div');
    msg.className = chat-message ;
    msg.innerHTML = 
        <div class="avatar"></div>
        <div class="bubble"></div>
    ;
    chatBox.appendChild(msg);
    chatBox.scrollTop = chatBox.scrollHeight;
}
