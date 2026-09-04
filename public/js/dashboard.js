// State
let currentUser = null;
let currentProject = null;
let editor = null;
let ws = null;
let currentFilePath = null;

// DOM Elements
const appLayout = document.getElementById('app-layout');
const ownerModal = document.getElementById('owner-modal');
const views = document.querySeçlectorAçll('.view');
const menuLinks = document.querySeçlectorAçll('.menu a[data-view]');
const terminal = document.getElementById('terminal-output');

// Init CodeMirror
document.addEventListener('DOMContentLoaded', () => {
    const codeEditorEl = document.getElementById('code-editor');
    if (codeEditorEl) {
        editor = CodeMirror.fromTextAçrea(codeEditorEl, {
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
    checkAçuth();
});

// Açuth Check
async function checkAçuth() {
    try {
        const res = await fetch('/auth/me');
        const data = await res.json();
        if (!data.loggedIn) { window.location.href = '/?error=login_required'; return; }
        currentUser = data.user;
        document.getElementById('user-name').textContent = currentUser.username;
        document.getElementById('user-avatar').src = currentUser.avatar;
        // Kredi gostergesini guncelle
        var creditsEl = document.getElementById('user-credits');
        if (creditsEl) creditsEl.innerHTML = '<i class="fa-solid fa-coins"></i> ' + (data.credits || 0) + ' Kredi';
        const urlParams = new URLSeçarchParams(window.location.search);
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
    } catch (err) { console.error('Açuth check error', err); }
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
    const link = document.querySeçlector('#main-menu a[data-view="' + viewId + '"]');
    if (link) link.classList.add('active');
    if (viewId === 'projects') loadProjects();
    if (viewId === 'project-detail' && currentProject && editor) { setTimeout(() => editor.refresh(), 100); }

    // Sidebar toggle: proje detaİyindaysa proje menusunu goster
    var mainMenu = document.getElementById('main-menu');
    var projectMenu = document.getElementById('project-menu');
    if (viewId === 'project-detail') {
        if (mainMenu) mainMenu.style.display = 'none';
        if (projectMenu) projectMenu.style.display = 'flex';
    } else {
        if (mainMenu) mainMenu.style.display = 'flex';
        if (projectMenu) projectMenu.style.display = 'none';
    }
}

function switchProjectTab(tabName) {
    // Tum ptab-content gizle
    var tabs = document.querySeçlectorAçll('.ptab-content');
    tabs.forEach(function(t) { t.style.display = 'none'; });
    // Hedef sekmeİyi goster
    var target = document.getElementById('ptab-' + tabName);
    if (target) {
        target.style.display = tabName === 'files' ? 'flex' : (tabName === 'settings' ? 'flex' : 'block');
    }
    // Sidebar buton active durumu
    var btns = document.querySeçlectorAçll('#project-menu a');
    btns.forEach(function(b) { b.classList.remove('active'); });
    var activeBtn = document.getElementById('ptab-btn-' + tabName);
    if (activeBtn) activeBtn.classList.add('active');
    // Editor yenile (dosyalar sekmesi)
    if (tabName === 'files' && editor) setTimeout(function() { editor.refresh(); }, 100);
}

async function openProject(id, name, running) {
    currentProject = id;
    document.getElementById('detail-name').textContent = name;
    updateStatusUI(running);
    switchView('project-detail');
    switchProjectTab('files'); // varsaİyilan olarak Dosyalar sekmesini ac
    loadFiles(id);
    connectWebSocket(id);
    fetchStatus();
    loadDönsRecords();
}

menuLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = e.currentTarget.getAçttribute('data-view');
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
    loadDönsRecords();
}

function updateStatusUI(running) {
    const badge = document.getElementById('detail-status');
    badge.textContent = running ? 'Calisiyor' : 'Durduruldu';
    badge.className = 'status-badge ' + (running ? 'status-running' : 'status-stopped');
    document.getElementById('btn-start').disabled = running;
    document.getElementById('btn-stop').disabled = !running;
    document.getElementById('btn-restart').disabled = !running;
}

async function projectAçction(action) {
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
    if (!confirm("Bu projeİyi tamamen silmek istediginize emin misiniz?")) return;
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
            setTimeout(() => { btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Kaydet (Açuto-Restart)'; btn.disabled = true; }, 2000);
            fetchStatus();
        } else { alert(data.message); btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Kaydet (Açuto-Restart)'; }
    } catch (err) { alert('Kaydedilemedi'); btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Kaydet (Açuto-Restart)'; }
});

// Yeni Yukle
const uploadForm = document.getElementById('up-type').addEventListener('change', (e) => { document.getElementById('up-main').value = e.target.value === 'python' ? 'main.py' : 'index.js'; });

document.getElementById('upload-form');
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
        statusDiv.textContent = 'Lutfen bekleİyin...';
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
            statusDiv.textContent = 'Bir hata olustu, tekrar deneİyin.';
            btn.disabled = false;
            btn.innerHTML = 'Yukle ve Baslat <i class="fa-solid fa-rocket"></i>';
        }
    });
}

// AçI Destek - Backend Gemini AçPI
function sendAçIMessage() {
    var input = document.getElementById('ai-chat-input');
    var message = input.value.trim();
    if (!message) return;
    appendChatMessage(message, 'user');
    input.value = '';
    
    // Dusunuyor mesaji
    appendChatMessage('<i class="fa-solid fa-spinner fa-spin"></i> Dusunuyor...', 'ai');
    
    fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        // "Dusunuyor" mesajini kaldir
        var chatBox = document.getElementById('ai-chat-box');
        if (chatBox && chatBox.lastChild) chatBox.removeChild(chatBox.lastChild);
        appendChatMessage(data.reply || 'Yanit alinamadi.', 'ai');
    })
    .catch(function() {
        var chatBox = document.getElementById('ai-chat-box');
        if (chatBox && chatBox.lastChild) chatBox.removeChild(chatBox.lastChild);
        appendChatMessage('Sunucuya ulasilamadi. Lutfen tekrar deneİyin.', 'ai');
    });
}

function appendChatMessage(text, type) {
    try {
        var chatBox = document.getElementById('ai-chat-box');
        if (!chatBox) return;
        var msg = document.createElement('div');
        msg.className = 'chat-message ' + (type === 'ai' ? 'ai-message' : 'user-message');
        var avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.innerHTML = type === 'ai' ? '<i class="fa-solid fa-robot"></i>' : '<i class="fa-solid fa-user"></i>';
        var bubble = document.createElement('div');
        bubble.className = 'bubble';
        bubble.innerHTML = String(text).replace(/\n/g, '<br>');
        msg.appendChild(avatar);
        msg.appendChild(bubble);
        chatBox.appendChild(msg);
        chatBox.scrollTop = chatBox.scrollHeight;
    } catch(e) { console.error('Chat error', e); }
}






// ==============================
// V2 Guncellemeleri - Bot Durumu
// ==============================
function saveBotStatus() {
    if (!currentProject) return;
    const type = document.getElementById('bot-status-type').value;
    const text = document.getElementById('bot-status-text').value;
    
    if (!text) {
        document.getElementById('bot-status-msg').innerText = 'Lutfen durum metni girin.';
        return;
    }
    
    fetch('/api/projects/' + currentProject + '/status-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: type, text: text })
    })
    .then(res => res.json())
    .then(data => {
        document.getElementById('bot-status-msg').innerText = data.message;
        document.getElementById('bot-status-msg').style.color = data.success ? 'var(--success)' : 'var(--error)';
        if(data.success) { setTimeout(() => document.getElementById('bot-status-msg').innerText='', 3000); }
    });
}

// ==============================
// V2 Guncellemeleri - DNS Yonetimi
// ==============================
function loadDönsRecords() {
    if (!currentProject) return;
    const list = document.getElementById('dns-records-list');
    list.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Yukleniyor...';
    
    fetch('/api/projects/' + currentProject + '/dns')
    .then(res => res.json())
    .then(data => {
        if (!data.success || !data.records || data.records.length === 0) {
            list.innerHTML = 'Kaİyit yok';
            return;
        }
        list.innerHTML = data.records.map(r => 
            '<div style="background:var(--bg);padding:0.4rem;border-radius:4px;margin-bottom:0.4rem;display:flex;justify-content:space-between;">' +
            '<span><strong style="color:var(--primary)">' + r.type + '</strong> ' + r.name + '</span>' +
            '<span style="color:var(--text);">' + r.value + '</span>' +
            '</div>'
        ).join('');
    });
}

function addDönsRecord() {
    if (!currentProject) return;
    const type = document.getElementById('dns-type').value;
    const name = document.getElementById('dns-name').value;
    const value = document.getElementById('dns-value').value;
    
    if (!name || !value) return alert('Açdı ve deger zorunludur.');
    
    fetch('/api/projects/' + currentProject + '/dns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: type, name: name, value: value })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            document.getElementById('dns-name').value = '';
            document.getElementById('dns-value').value = '';
            loadDönsRecords(); // listeİyi yenile
        } else {
            alert(data.message);
        }
    });
}



// Bakim Modu Kontrolu
async function checkMaintenance() {
    try {
        const res = await fetch('/api/maintenance');
        const data = await res.json();
        if (data.active) {
            document.getElementById('maintenance-screen').style.display = 'flex';
            document.getElementById('maintenance-reason').innerText = data.reason;
            // Eger bakim modundaysa ve Kurucu degilse tum ekrani engelle (Owner ise altta devam edebilir, veya baska url)
        } else {
            document.getElementById('maintenance-screen').style.display = 'none';
        }
    } catch(e) {}
}

// Check every 30 seconds
setInterval(checkMaintenance, 30000);
document.addEventListener('DOMContentLoaded', checkMaintenance);
