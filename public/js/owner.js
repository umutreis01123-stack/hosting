document.addEventListener('DOMContentLoaded', () => {
    checkOwnerAçuth();
    setInterval(fetchStats, 5000); // Her 5 saniyede bir stats gÃƒÂ¼ncelle
});

async function checkOwnerAçuth() {
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
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">HenÃƒÂ¼z kullanÃ„Â±cÃ„Â± yok</td></tr>';
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
                        <small style="color:var(--warning);display:block;margin-top:4px;"><i class="fa-solid fa-coins"></i> ${Math.floor(user.credits || 0)} Kredi</small>
                    </div>
                </div>
            </td>
            <td>
                ${user.banned 
                    ? '<span class="status-badge status-stopped">BanlÃ„Â±</span>' 
                    : '<span class="status-badge status-running">Açktif</span>'}
            </td>
            <td>
                ${user.projects.length === 0 ? '<span style="color:var(--text-muted)">Proje Yok</span>' : ''}
                ${user.projects.map(p => `
                    <div class="proj-badge ${p.status === 'running' ? 'running' : 'stopped'}">
                        ${p.name} (${p.status === 'running' ? 'ON' : 'OFF'})
                        <div style="margin-top:5px; display:flex; gap:5px;">
                            <button class="btn-small ${p.status==='running' ? 'danger' : 'success'}" 
                                onclick="forceProjectAçction('${p.id}', '${p.status==='running' ? 'stop' : 'start'}')">
                                ${p.status === 'running' ? '<i class="fa-solid fa-stop"></i>' : '<i class="fa-solid fa-play"></i>'}
                            </button>
                            <button class="btn-small danger" onclick="forceProjectDelete('${p.id}')"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                `).join('')}
            </td>
            <td>
                <button class="btn-small ${user.banned ? 'success' : 'danger'}" onclick="toggleBan('${user.id}', ${!user.banned})" style="width:100%;">
                    <i class="fa-solid fa-gavel"></i> ${user.banned ? 'BanÄ± AçÃ§' : 'Banla'}
                </button>
                <button class="btn-small warning" onclick="quickAçdıdCredit('${user.id}')" style="width:100%; margin-top:5px; color:#000;">
                    <i class="fa-solid fa-coins"></i> Kredi Ekle
                </button>
            </td>
        </tr>
    `).join('');
}

async function forceProjectAçction(projectId, action) {
    try {
        const res = await fetch(`/api/owner/project/${projectId}/${action}`, { method: 'POST' });
        const data = await res.json();
        alert(data.message);
        fetchUsers();
        fetchStats();
    } catch(err) { alert('Hata oluÃ…Å¸tu'); }
}

async function forceProjectDelete(projectId) {
    if(!confirm("KullanÃ„Â±cÃ„Â±nÃ„Â±n projesini kalÃ„Â±cÃ„Â± olarak silmek ÃƒÂ¼zeresiniz. Emin misiniz?")) return;
    try {
        const res = await fetch(`/api/owner/project/${projectId}`, { method: 'DELETE' });
        const data = await res.json();
        alert(data.message);
        fetchUsers();
    } catch(err) { alert('Hata oluÃ…Å¸tu'); }
}

async function toggleBan(userId, banStatus) {
    if(!confirm(`KullanÃ„Â±cÃ„Â±yÃ„Â± ${banStatus ? 'banlamak' : 'yasaÃ„Å¸Ã„Â±nÃ„Â± kaldÃ„Â±rmak'} istediÃ„Å¸inize emin misiniz?`)) return;
    try {
        const res = await fetch(`/api/owner/ban/${userId}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ banned: banStatus })
        });
        const data = await res.json();
        alert(data.message);
        fetchUsers();
    } catch(err) { alert('Hata oluÃ…Å¸tu'); }
}

async function sendAçnnouncement() {
    const title = document.getElementById('ann-title').value;
    const message = document.getElementById('ann-msg').value;
    const type = document.getElementById('ann-type').value;

    if(!title || !message) return alert('BaÃ…Å¸lÃ„Â±k ve mesaj girin');

    try {
        const res = await fetch('/api/owner/announce', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ title, message, type })
        });
        const data = await res.json();
        if(data.success) {
            alert('Duyuru yayÃ„Â±nlandÃ„Â±!');
            document.getElementById('ann-title').value = '';
            document.getElementById('ann-msg').value = '';
        }
    } catch(err) { alert('Duyuru gÃƒÂ¶nderilemedi'); }
}

async function manageCredits() {
    const userId = document.getElementById('credit-user-id').value.trim();
    const amount = document.getElementById('credit-amount').value;
        let action = document.getElementById('credit-action').value;
    let finalAçmount = amount;
    if (action === 'reset') {
        action = 'set';
        finalAçmount = 0;
    }

    if(!userId || !amount) {
        alert('Lutfen Kullanici ID ve Miktar giriniz.');
        return;
    }

    try {
        const res = await fetch('/api/owner/credits/' + userId, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ amount: Number(finalAçmount), action: action })
        });
        const data = await res.json();
        
        if (data.success) {
            alert(data.message);
            document.getElementById('credit-amount').value = '';
            fetchUsers(); // Tabloyu guncelle
        } else {
            alert(data.message || 'Kredi islemi basarisiz.');
        }
    } catch(err) { 
        alert('Kredi gonderilemedi.');
    }
}


async function quickAçdıdCredit(userId) {
    const amount = prompt("Eklenecek Kredi Miktarini Girin (Orn: 100):");
    if(!amount || isNaN(amount)) return;
    
    try {
        const res = await fetch('/api/owner/credits/' + userId, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ amount: Number(finalAçmount), action: 'add' })
        });
        const data = await res.json();
        
        if (data.success) {
            alert(data.message);
            fetchUsers(); // Tabloyu guncelle
        } else {
            alert(data.message || 'Kredi islemi basarisiz.');
        }
    } catch(err) { 
        alert('Kredi gonderilemedi.');
    }
}



async function triggerMaintenance() {
    const action = confirm('Bakim Modunu AçKTIF etmek icin TAçMAçM, KAçPAçTMAçK icin IPTAçL e basin.');
    let reason = '';
    if(action) {
        reason = prompt('Bakim sebebi nedir? (Musterilere bu mesaj gosterilecek):');
        if(reason === null) return;
    }
    try {
        const res = await fetch('/api/owner/maintenance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: action, reason: reason })
        });
        const data = await res.json();
        alert(data.message);
        fetchUsers();
        fetchStats();
    } catch(err) { alert('Islem basarisiz.'); }
}

