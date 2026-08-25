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
    const codeEditorEl = document.getElementById('code-editor'); if (codeEditorEl) editor = CodeMirror.fromTextArea(codeEditorEl, {
        lineNumbers: true,
        theme: "monokai",
        mode: "javascript",
        matchBrackets: true,
        autoCloseBrackets: true
    });
    editor.setSize("100%", "100%");

    // EditÃ¶rde deÄŸiÅŸiklik olduÄŸunda kaydet butonunu aktif et
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

        // Owner kontrolÃ¼ - Modal gÃ¶ster veya sidebar linkini aÃ§
        const urlParams = new URLSearchParams(window.location.search);
        if (data.ownerPending || urlParams.get('ownerLogin') === '1') {
            ownerModal.style.display = 'flex';
        } else {
            appLayout.style.display = 'flex';
            loadProjects();
            // EÄŸer owner ise sidebar'daki Kurucu Paneli butonunu gÃ¶ster
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
        errorDiv.textContent = 'BaÄŸlantÄ± hatasÄ±.';
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

// â”€â”€â”€ Projeler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function loadProjects() {
    try {
        const res = await fetch('/api/projects');
        const data = await res.json();
        
        const list = document.getElementById('projects-list');
        if (!data.success || data.projects.length === 0) {
            list.innerHTML = `
                <div style="grid-column: 1/-1; text-align:center; padding: 3rem; background: var(--bg-card); border-radius:10px;">
                    <i class="fa-solid fa-folder-open" style="font-size: 3rem; color:var(--text-muted); margin-bottom:1rem;"></i>
                    <h3>HenÃ¼z projeniz yok</h3>
                    <p style="color:var(--text-muted); margin-bottom:1rem;">Hemen bir .zip yÃ¼kleyerek botunuzu veya sitenizi baÅŸlatÄ±n.</p>
                    <button class="btn-primary" onclick="switchView('upload')">Yeni YÃ¼kle</button>
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
                        ${p.running ? 'Ã‡alÄ±ÅŸÄ±yor' : 'Durduruldu'}
                    </span>
                </div>
                <div style="font-size: 0.85rem; color:var(--text-muted);">
                    <i class="fa-regular fa-clock"></i> Uptime: ${formatUptime(p.uptime)}
                </div>
            </div>
        `).join('');
    } catch (err) {
        document.getElementById('projects-list').innerHTML = '<div class="alert error">Projeler yÃ¼klenirken hata oluÅŸtu.</div>';
    }
}

function formatUptime(ms) {
    if(!ms) return '0s';
    const s = Math.floor(ms/1000);
    const h = Math.floor(s/3600);
    const m = Math.floor((s%3600)/60);
    return `${h > 0 ? h+'s ' : ''}${m > 0 ? m+'d ' : ''}${s%60}sn`;
}

// â”€â”€â”€ Proje Detay & Terminal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function openProject(id, name, running) {
    currentProject = id;
    document.getElementById('detail-name').textContent = name;
    updateStatusUI(running);
    switchView('project-detail');
    
    // KlasÃ¶r aÄŸacÄ±nÄ± yÃ¼kle
    loadFiles(id);
    
    // WebSocket baÄŸlan
    connectWebSocket(id);

    // GÃ¼ncel status Ã§ek
    fetchStatus();
}

function updateStatusUI(running) {
    const badge = document.getElementById('detail-status');
    badge.textContent = running ? 'Ã‡alÄ±ÅŸÄ±yor' : 'Durduruldu';
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
            terminal.innerHTML += `<div class="term-sys">[SÄ°STEM] ${data.message}</div>`;
            fetchStatus();
        } else {
            alert(data.message);
        }
    } catch(err) {
        alert('Ä°ÅŸlem baÅŸarÄ±sÄ±z');
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
    if(!confirm("Bu projeyi tamamen silmek istediÄŸinize emin misiniz? (Geri alÄ±namaz)")) return;
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
            
            // Renklendirme basitÃ§e
            if(text.includes('[ERROR]') || text.includes('[STDERR]')) div.className = 'term-err';
            else if(text.includes('[SYSTEM]')) div.className = 'term-sys';
            
            div.textContent = text;
            terminal.appendChild(div);
            terminal.scrollTop = terminal.scrollHeight;
        }
    };
    
    ws.onclose = () => console.log('WS KapandÄ±');
}

function clearTerminal() {
    terminal.innerHTML = '';
}

// â”€â”€â”€ Dosya YÃ¶neticisi & EditÃ¶r â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function loadFiles(projectId) {
    const tree = document.getElementById('file-tree');
    tree.innerHTML = 'YÃ¼kleniyor...';
    try {
        const res = await fetch(`/api/editor/${projectId}/files`);
        const data = await res.json();
        if(data.success) {
            tree.innerHTML = renderTree(data.files);
            bindTreeEvents();
        }
    } catch(err) {
        tree.innerHTML = 'Dosyalar yÃ¼klenemedi.';
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
    // KÃ¶tÃ¼ uzantÄ±larÄ± engelle
    if(['zip','jpg','png','sqlite','db'].includes(ext)) {
        alert('Bu dosya tipi dÃ¼zenlenemez.');
        return;
    }

    document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');

    document.getElementById('current-file-name').textContent = 'YÃ¼kleniyor...';
    
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
            document.getElementById('btn-save-file').disabled = true; // DeÄŸiÅŸiklik yok
        } else {
            alert(data.message);
        }
    } catch(err) {
        alert('Dosya aÃ§Ä±lamadÄ±.');
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
            
            // Proje yeniden baÅŸlÄ±yor, status'u gÃ¼ncelle
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

// â”€â”€â”€ Yeni YÃ¼kle (Upload) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const uploadForm = document.getElementById('upload-form');
const upFile = document.getElementById('up-file');
const fileDrop = document.getElementById('file-drop-area');
const fileDisplay = document.getElementById('file-name-display');

upFile.addEventListener('change', (e) => {
    if(e.target.files.length > 0) {
        fileDisplay.innerHTML = `<i class="fa-solid fa-file-zipper"></i> ${e.target.files[0].name} seÃ§ildi.`;
        fileDrop.style.borderColor = 'var(--success)';
    }
});

uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const file = upFile.files[0];
    if(!file) return alert('LÃ¼tfen bir zip dosyasÄ± seÃ§in.');
    
    const formData = new FormData();
    formData.append('projectFile', file);
    formData.append('projectName', document.getElementById('up-name').value);
    formData.append('projectType', document.getElementById('up-type').value);
    formData.append('mainFile', document.getElementById('up-main').value);
    
    const statusDiv = document.getElementById('upload-status');
    const btn = document.getElementById('btn-upload');
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> YÃ¼kleniyor ve BaÅŸlatÄ±lÄ±yor...';
    statusDiv.style.display = 'block';
    statusDiv.className = 'alert';
    statusDiv.textContent = 'LÃ¼tfen bekleyin, zip Ã§Ä±kartÄ±lÄ±yor ve baÄŸÄ±mlÄ±lÄ±klar kuruluyor...';

    try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        
        if (data.success) {
            statusDiv.className = 'alert success';
            statusDiv.textContent = data.message;
            uploadForm.reset();
            fileDisplay.innerHTML = '';
            fileDrop.style.borderColor = 'var(--border)';
            
            // BaÅŸarÄ±lÄ± olunca o projenin paneline git
            setTimeout(() => {
                openProject(data.projectId, formData.get('projectName'), true);
            }, 1500);
        } else {
            statusDiv.className = 'alert error';
            statusDiv.textContent = data.message;
            btn.disabled = false;
            btn.innerHTML = 'YÃ¼kle ve BaÅŸlat <i class="fa-solid fa-rocket"></i>';
        }
    } catch(err) {
        statusDiv.className = 'alert error';
        statusDiv.textContent = 'Bir hata oluÅŸtu, tekrar deneyin.';
        btn.disabled = false;
        btn.innerHTML = 'YÃ¼kle ve BaÅŸlat <i class="fa-solid fa-rocket"></i>';
    }
});

// =============================================
// APEX Yapay Zeka Destek Motoru
// =============================================
const aiResponses = [
    {
        keywords: ['bot', 'başlamıyor', 'başlatamıyorum', 'çalışmıyor', 'start', 'başlat'],
        answer: Botunuz başlamıyorsa şunları kontrol edin:\n1. Proje detayına girip "Başlat" butonuna tıklayın.\n2. Canlı konsol ekranında hata mesajı var mı bakın.\n3. <code>index.js</code> dosyası ana dosya olarak doğru ayarlandı mı kontrol edin.\n4. <code>node_modules</code> klasörü zip'in içinde varsa silin, sistem otomatik kurar.
    },
    {
        keywords: ['zip', 'yükleme', 'yüklenemedi', 'hata', 'upload', 'dosya'],
        answer: Zip yükleme sorunları için:\n1. Zip dosyasının boyutu çok büyük olmamalı (max 50MB).\n2. Zip doğrudan proje dosyalarını içermeli, içinde başka bir zip olmamalı.\n3. Zip içinde <code>package.json</code> var mı kontrol edin.
    },
    {
        keywords: ['token', 'env', 'çevre', 'değişken', 'gizli', 'secret'],
        answer: Gizli anahtarlarınızı (TOKEN, API KEY vb.) projenize şöyle ekleyebilirsiniz:\n1. Proje detay ekranına gidin.\n2. Dosya yöneticisinde <code>.env</code> dosyası oluşturun.\n3. İçine <code>TOKEN=sizin_tokeniniz</code> yazıp kaydedin.
    },
    {
        keywords: ['kapanıyor', 'duruyor', 'crash', 'kilitlendi', 'stopped'],
        answer: Bot sürekli kapanıyorsa:\n1. Konsol ekranındaki hata mesajını okuyun.\n2. Genellikle <code>node_modules</code> eksikliğinden kaynaklanır. Zip'i <code>node_modules</code> olmadan yükleyin.\n3. Botunuzun kodunda işlenmemiş bir hata (unhandledRejection) olabilir.
    },
    {
        keywords: ['nasıl', 'ne', 'ne yapayım', 'yardım', 'merhaba', 'selam'],
        answer: Merhaba! Size şu konularda yardımcı olabilirim:\n• **Bot başlatma/durdurma** sorunları\n• **Zip yükleme** hataları\n• **Token/ENV** değişkeni ekleme\n• **Konsol hataları** yorumlama\n\nSorunuzu detaylı yazarsanız daha iyi yardımcı olabilirim!
    }
];

const DISCORD_SUPPORT_URL = 'https://discord.gg/apexhosting'; // Değiştirilebilir

function sendAIMessage() {
    const input = document.getElementById('ai-chat-input');
    const chatBox = document.getElementById('ai-chat-box');
    const message = input.value.trim();
    if (!message) return;

    // Kullanıcı mesajı ekle
    appendChatMessage(message, 'user');
    input.value = '';

    // Yapay Zeka yanıtını bul
    setTimeout(() => {
        const lower = message.toLowerCase();
        let found = aiResponses.find(r => r.keywords.some(k => lower.includes(k)));
        
        if (found) {
            appendChatMessage(found.answer, 'ai');
        } else {
            appendChatMessage(
                Üzgünüm, bu konuda size yeterince yardımcı olamıyorum. Daha detaylı destek için Discord sunucumuzdaki canlı destek kanalını kullanabilirsiniz.\n\n?? <a href="" target="_blank" style="color:#7289da;font-weight:bold;">Discord'da Canlı Destek Aç</a>,
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


