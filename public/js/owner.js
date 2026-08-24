document.addEventListener('DOMContentLoaded', () => {
    checkOwnerAuth();
    setInterval(fetchStats, 5000); // Her 5 saniyede bir stats güncelle
});

async function checkOwnerAuth() {
    try {
        const res = await fetch('/auth/me');
        const data = await res.json();
        
        if (!data.loggedIn) {
            window.location.href = '/';
            return;
        }
        
        if (!data.isOwner) {
            window.location.href = '/dashboard';
            return;
        }

        document.getElementById('owner-app').style.display = 'flex';
        fetchStats();
        fetchUsers();
    } catch (err) {
        console.error(err);
    }
}

async function fetchStats() {
    try {
        const res = await fetch('/api/owner/stats');
        const data = await res.json();
        
        if (data.success) {
            const mem = data.stats.memory;
            document.getElementById('stat-cpu').textContent = `${data.stats.cpu.usage}%`;
            document.getElementById('stat-ram').textContent = `${mem.usedGB} / ${mem.totalGB} GB (${mem.usagePercent}%)`;
            document.getElementById('stat-active').textContent = `${data.activeProjectsCount} / ${data.totalProjectsCount}`;
        }
    } catch (err) { }
}

async function fetchUsers() {
    try {
        const res = await fetch('/api/owner/users');
        const data = await res.json();
        
        if (data.success) {
            renderUsers(data.users);
        }
    } catch (err) { }
}

function renderUsers(users) {
    const tbody = document.getElementById('users-table');
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Henüz kullanıcı yok</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => `
        <tr>
            <td>
                <div class="user-cell">
                    <img src="${user.avatar || '/default-avatar.png'}" alt="">
                    <div>
                        <span>${user.username}</span>
                        <small>ID: ${user.id}</small>
                    </div>
                </div>
            </td>
            <td>
                ${user.banned 
                    ? '<span class="status-badge status-stopped">Banlı</span>' 
                    : '<span class="status-badge status-running">Aktif</span>'}
            </td>
            <td>
                ${user.projects.length === 0 ? '<span style="color:var(--text-muted)">Proje Yok</span>' : ''}
                ${user.projects.map(p => `
                    <div class="proj-badge ${p.status === 'running' ? 'running' : 'stopped'}">
                        ${p.name} (${p.status === 'running' ? 'ON' : 'OFF'})
                        <div style="margin-top:5px; display:flex; gap:5px;">
                            <button class="btn-small ${p.status==='running' ? 'danger' : 'success'}" 
                                onclick="forceProjectAction('${p.id}', '${p.status==='running' ? 'stop' : 'start'}')">
                                ${p.status === 'running' ? '<i class="fa-solid fa-stop"></i>' : '<i class="fa-solid fa-play"></i>'}
                            </button>
                            <button class="btn-small danger" onclick="forceProjectDelete('${p.id}')"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                `).join('')}
            </td>
            <td>
                <button class="btn-small ${user.banned ? 'success' : 'danger'}" onclick="toggleBan('${user.id}', ${!user.banned})">
                    <i class="fa-solid fa-gavel"></i> ${user.banned ? 'Banı Aç' : 'Banla'}
                </button>
            </td>
        </tr>
    `).join('');
}

async function forceProjectAction(projectId, action) {
    try {
        const res = await fetch(`/api/owner/project/${projectId}/${action}`, { method: 'POST' });
        const data = await res.json();
        alert(data.message);
        fetchUsers();
        fetchStats();
    } catch(err) { alert('Hata oluştu'); }
}

async function forceProjectDelete(projectId) {
    if(!confirm("Kullanıcının projesini kalıcı olarak silmek üzeresiniz. Emin misiniz?")) return;
    try {
        const res = await fetch(`/api/owner/project/${projectId}`, { method: 'DELETE' });
        const data = await res.json();
        alert(data.message);
        fetchUsers();
    } catch(err) { alert('Hata oluştu'); }
}

async function toggleBan(userId, banStatus) {
    if(!confirm(`Kullanıcıyı ${banStatus ? 'banlamak' : 'yasağını kaldırmak'} istediğinize emin misiniz?`)) return;
    try {
        const res = await fetch(`/api/owner/ban/${userId}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ banned: banStatus })
        });
        const data = await res.json();
        alert(data.message);
        fetchUsers();
    } catch(err) { alert('Hata oluştu'); }
}

async function sendAnnouncement() {
    const title = document.getElementById('ann-title').value;
    const message = document.getElementById('ann-msg').value;
    const type = document.getElementById('ann-type').value;

    if(!title || !message) return alert('Başlık ve mesaj girin');

    try {
        const res = await fetch('/api/owner/announce', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ title, message, type })
        });
        const data = await res.json();
        if(data.success) {
            alert('Duyuru yayınlandı!');
            document.getElementById('ann-title').value = '';
            document.getElementById('ann-msg').value = '';
        }
    } catch(err) { alert('Duyuru gönderilemedi'); }
}
