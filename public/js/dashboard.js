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
const menuLinks = document.querySelectorAll('.menu a[data-view]');
const terminal = document.getElementById('terminal-output');

// Init CodeMirror
document.addEventListener('DOMContentLoaded', () => {
    const codeEditorEl = document.getElementById('code-editor');
    if (codeEditorEl) {
        editor = CodeMirror.fromTextArea(codeEditorEl, {
            lineNumbers: true,
            theme: "monokai",
            mode: "javascript",
            matchBrackets: true,
            autoCloseBrackets: true
        });
        editor.setSize("100%", "100%");
        editor.on("change", () => {
            if (currentFilePath) {
                document.getElementById('btn-save-file').disabled = false;
            }
        });
    }
    checkAuth();
});

// Auth Check
async function checkAuth() {
    try {
        const res = await fetch('/auth/me');
        const data = await res.json();
        if (!data.loggedIn) { window.location.href = '/?error=login_required'; return; }
        currentUser = data.user;
        document.getElementById('user-name').textContent = currentUser.username;
        document.getElementById('user-avatar').src = currentUser.avatar;
        const urlParams = new URLSearchParams(window.location.search);
        if (data.ownerPending || urlParams.get('ownerLogin') === '1') {
            ownerModal.style.display = 'flex';
        } else {
            appLayout.style.display = 'flex';
            loadProjects();
            if (data.isOwner) {
                const ownerNavLink = document.getElementById('nav-owner-link');
                if (ownerNavLink) ownerNavLink.style.display = 'flex';
            }
        }
    } catch (err) { console.error('Auth check error', err); }
}

// Owner Verify
document.getElementById('btn-owner-verify')?.addEventListener('click', async () => {
    const password = document.getElementById('owner-password').value;
    const errorDiv = document.getElementById('owner-error');
    try {
        const res = await fetch('/auth/owner/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
        const data = await res.json();
        if (data.success) { window.location.href = data.redirect; }
        else { errorDiv.textContent = data.message; }
    } catch (err) { errorDiv.textContent = 'Baglanti hatasi.'; }
});

// View Switcher
function switchView(viewId) {
    views.forEach(v => v.classList.remove('active'));
    const targetView = document.getElementById('view-' + viewId);
    if (targetView) targetView.classList.add('active');
    menuLinks.forEach(l => l.classList.remove('active'));
    const link = document.querySelector('.menu a[data-view="' + viewId + '"]');
    if (link) link.classList.add('active');
    if (viewId === 'projects') loadProjects();
    if (viewId === 'project-detail' && currentProject && editor) { setTimeout(() => editor.refresh(), 100); }
}

menuLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = e.currentTarget.getAttribute('data-view');
        if (view) switchView(view);
    });
});

// Projeler
async function loadProjects() {
    try {
        const res = await fetch('/api/projects');
        const data = await res.json();
        const list = document.getElementById('projects-list');
        if (!data.success || data.projects.length === 0) {
            list.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem;background:var(--bg-card);border-radius:10px;"><i class="fa-solid fa-folder-open" style="font-size:3rem;color:var(--text-muted);margin-bottom:1rem;display:block;"></i><h3>Henuz projeniz yok</h3><p style="color:var(--text-muted);margin-bottom:1rem;">Hemen bir .zip yukleyerek botunuzu baslatin.</p><button class="btn-primary" onclick="switchView(\'upload\')">Yeni Yukle</button></div>';
            return;
        }
        list.innerHTML = data.projects.map(p =>
            '<div class="project-card" onclick="openProject(\'' + p.id + '\', \'' + p.name + '\', ' + p.running + ')">' +
            '<div class="project-card-header"><div><h3>' + p.name + '</h3><span class="project-type">' + (p.type === 'bot' ? 'Discord Bot' : 'Web Sitesi') + '</span></div>' +
            '<span class="status-badge ' + (p.running ? 'status-running' : 'status-stopped') + '">' + (p.running ? 'Calisiyor' : 'Durduruldu') + '</span></div>' +
            '<div style="font-size:0.85rem;color:var(--text-muted);"><i class="fa-regular fa-clock"></i> Uptime: ' + formatUptime(p.uptime) + '</div></div>'
        ).join('');
    } catch (err) {
        document.getElementById('projects-list').innerHTML = '<div class="alert error">Projeler yuklenirken hata olustu.</div>';
    }
}

function formatUptime(ms) {
    if (!ms) return '0s';
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return (h > 0 ? h + 's ' : '') + (m > 0 ? m + 'd ' : '') + (s % 60) + 'sn';
}

// Proje Detay
async function openProject(id, name, running) {
    currentProject = id;
    document.getElementById('detail-name').textContent = name;
    updateStatusUI(running);
    switchView('project-detail');
    loadFiles(id);
    connectWebSocket(id);
    fetchStatus();
}

function updateStatusUI(running) {
    const badge = document.getElementById('detail-status');
    badge.textContent = running ? 'Calisiyor' : 'Durduruldu';
    badge.className = 'status-badge ' + (running ? 'status-running' : 'status-stopped');
    document.getElementById('btn-start').disabled = running;
    document.getElementById('btn-stop').disabled = !running;
    document.getElementById('btn-restart').disabled = !running;
}

async function projectAction(action) {
    if (!currentProject) return;
    try {
        const res = await fetch('/api/projects/' + currentProject + '/' + action, { method: 'POST' });
        const data = await res.json();
        if (data.success) { terminal.innerHTML += '<div class="term-sys">[SISTEM] ' + data.message + '</div>'; fetchStatus(); }
        else { alert(data.message); }
    } catch (err) { alert('Islem basarisiz'); }
}

async function fetchStatus() {
    if (!currentProject) return;
    const res = await fetch('/api/projects/' + currentProject + '/status');
    const data = await res.json();
    if (data.success) {
        updateStatusUI(data.status.running);
        document.getElementById('detail-uptime').innerHTML = '<i class="fa-regular fa-clock"></i> ' + formatUptime(data.status.uptime);
    }
}

async function deleteProject() {
    if (!confirm("Bu projeyi tamamen silmek istediginize emin misiniz?")) return;
    try {
        const res = await fetch('/api/projects/' + currentProject, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) switchView('projects');
    } catch (err) { alert('Silinemedi'); }
}

// WebSocket Terminal
function connectWebSocket(projectId) {
    if (ws) ws.close();
    clearTerminal();
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(protocol + '//' + location.host + '/ws?projectId=' + projectId);
    ws.onmessage = (event) => {
        const line = document.createElement('div');
        line.textContent = event.data;
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
    };
    ws.onclose = () => {
        const line = document.createElement('div');
        line.className = 'term-sys';
        line.textContent = '[SISTEM] Baglanti kesildi.';
        terminal.appendChild(line);
    };
}

function clearTerminal() { if (terminal) terminal.innerHTML = ''; }

// Dosya Yoneticisi
async function loadFiles(projectId) {
    try {
        const res = await fetch('/api/editor/' + projectId + '/files');
        const data = await res.json();
        const tree = document.getElementById('file-tree');
        if (!data.success) { tree.innerHTML = '<div class="error">Dosyalar yuklenemedi.</div>'; return; }
        tree.innerHTML = renderFileTree(data.files, projectId, '');
    } catch (err) { document.getElementById('file-tree').innerHTML = '<div class="error">Hata olustu.</div>'; }
}

function renderFileTree(files, projectId, prefix) {
    return files.map(f => {
        if (f.type === 'directory') {
            return '<div class="file-folder"><i class="fa-solid fa-folder"></i> ' + f.name + '</div>' +
                   '<div class="folder-children">' + renderFileTree(f.children || [], projectId, prefix + f.name + '/') + '</div>';
        }
        return '<div class="file-item" onclick="openFile(\'' + projectId + '\', \'' + prefix + f.name + '\')">' +
               '<i class="fa-regular fa-file-code"></i> ' + f.name + '</div>';
    }).join('');
}

async function openFile(projectId, filePath) {
    currentFilePath = filePath;
    document.getElementById('current-file-name').textContent = filePath;
    try {
        const res = await fetch('/api/editor/' + projectId + '/file?path=' + encodeURIComponent(filePath));
        const data = await res.json();
        if (data.success && editor) { editor.setValue(data.content); editor.clearHistory(); document.getElementById('btn-save-file').disabled = true; }
    } catch (err) { alert('Dosya acilamadi.'); }
}

// Dosya Kaydet
document.getElementById('btn-save-file')?.addEventListener('click', async () => {
    if (!currentProject || !currentFilePath || !editor) return;
    const btn = document.getElementById('btn-save-file');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kaydediliyor...';
    try {
        const res = await fetch('/api/editor/' + currentProject + '/file', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: currentFilePath, content: editor.getValue() })
        });
        const data = await res.json();
        if (data.success) {
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Kaydedildi!';
            setTimeout(() => { btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Kaydet (Auto-Restart)'; btn.disabled = true; }, 2000);
            fetchStatus();
        } else { alert(data.message); btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Kaydet (Auto-Restart)'; }
    } catch (err) { alert('Kaydedilemedi'); btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Kaydet (Auto-Restart)'; }
});

// Yeni Yukle
const uploadForm = document.getElementById('upload-form');
const upFile = document.getElementById('up-file');
const fileDrop = document.getElementById('file-drop-area');
const fileDisplay = document.getElementById('file-name-display');

if (upFile) {
    upFile.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            fileDisplay.innerHTML = '<i class="fa-solid fa-file-zipper"></i> ' + e.target.files[0].name + ' secildi.';
            fileDrop.style.borderColor = 'var(--success)';
        }
    });
}

if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = upFile.files[0];
        if (!file) return alert('Lutfen bir zip dosyasi secin.');
        const formData = new FormData();
        formData.append('projectFile', file);
        formData.append('projectName', document.getElementById('up-name').value);
        formData.append('projectType', document.getElementById('up-type').value);
        formData.append('mainFile', document.getElementById('up-main').value);
        const statusDiv = document.getElementById('upload-status');
        const btn = document.getElementById('btn-upload');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Yukleniyor...';
        statusDiv.style.display = 'block';
        statusDiv.className = 'alert';
        statusDiv.textContent = 'Lutfen bekleyin...';
        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) {
                statusDiv.className = 'alert success';
                statusDiv.textContent = data.message;
                uploadForm.reset();
                fileDisplay.innerHTML = '';
                fileDrop.style.borderColor = 'var(--border)';
                setTimeout(() => openProject(data.projectId, formData.get('projectName'), true), 1500);
            } else {
                statusDiv.className = 'alert error';
                statusDiv.textContent = data.message;
                btn.disabled = false;
                btn.innerHTML = 'Yukle ve Baslat <i class="fa-solid fa-rocket"></i>';
            }
        } catch (err) {
            statusDiv.className = 'alert error';
            statusDiv.textContent = 'Bir hata olustu, tekrar deneyin.';
            btn.disabled = false;
            btn.innerHTML = 'Yukle ve Baslat <i class="fa-solid fa-rocket"></i>';
        }
    });
}

// AI Destek
const aiResponses = [
    { keywords: ['bot', 'baslamiyor', 'baslatamiyorum', 'calismiyor', 'start'], answer: 'Botunuz baslamiyorsa:\n1. Proje detayina girip "Baslat" butonuna tiklayin.\n2. Canli konsolda hata mesaji var mi bakin.\n3. node_modules klasorunu zipin disinda birakin.' },
    { keywords: ['zip', 'yukleme', 'yuklenemedi', 'upload', 'dosya'], answer: 'Zip yukleme sorunlari icin:\n1. Zip max 50MB olmali.\n2. Zip dogrudan proje dosyalarini icermeli.\n3. Zip icinde package.json var mi kontrol edin.' },
    { keywords: ['token', 'env', 'degisken', 'gizli', 'secret'], answer: 'Gizli anahtarlarinizi eklemek icin:\n1. Proje detay ekranina gidin.\n2. Dosya yoneticisinde .env dosyasi olusturun.\n3. Icine TOKEN=sizin_tokeniniz yazip kaydedin.' },
    { keywords: ['kapaniyor', 'duruyor', 'crash', 'stopped'], answer: 'Bot surekli kapaniyorsa:\n1. Konsol ekranindaki hata mesajini okuyun.\n2. node_modules olmadan zip yukleyin.\n3. Kodunuzda islenmemis hata (unhandledRejection) olabilir.' },
    { keywords: ['nasil', 'yardim', 'merhaba', 'selam', 'ne'], answer: 'Merhaba! Bot baslat/durdurma, zip yukleme, token/ENV ekleme ve konsol hatalari konularinda yardimci olabilirim. Sorunuzu detayli yazin!' }
];

function sendAIMessage() {
    const input = document.getElementById('ai-chat-input');
    const message = input.value.trim();
    if (!message) return;
    appendChatMessage(message, 'user');
    input.value = '';
    setTimeout(() => {
        const lower = message.toLowerCase();
        const found = aiResponses.find(r => r.keywords.some(k => lower.includes(k)));
        if (found) { appendChatMessage(found.answer, 'ai'); }
        else { appendChatMessage('Uzgunum, bu konuda yardimci olamiyorum. Discord sunucumuzdan canli destek alabilirsiniz.\n\n<a href="https://discord.gg/3pRqYchFRV" target="_blank" style="color:#7289da;font-weight:bold;">Discord\'da Canli Destek Ac</a>', 'ai'); }
    }, 600);
}

function appendChatMessage(text, type) {
    try {
        const chatBox = document.getElementById('ai-chat-box');
        if (!chatBox) return;
        const msg = document.createElement('div');
        msg.className = 'chat-message ' + (type === 'ai' ? 'ai-message' : 'user-message');
        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.innerHTML = type === 'ai' ? '<i class="fa-solid fa-robot"></i>' : '<i class="fa-solid fa-user"></i>';
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        bubble.innerHTML = String(text).replace(/\n/g, '<br>');
        msg.appendChild(avatar);
        msg.appendChild(bubble);
        chatBox.appendChild(msg);
        chatBox.scrollTop = chatBox.scrollHeight;
    } catch(e) { console.error('Chat error', e); }
}


