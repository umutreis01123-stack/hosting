/**
 * ============================================
 * APEX | Hosting — System Stats
 * RAM/CPU istatistiklerini getirir
 * ============================================
 */

const si = require('systeminformation');

/**
 * Anlık sistem istatistiklerini getir
 * @returns {Promise<object>} RAM ve CPU bilgisi
 */
async function getSystemStats() {
    try {
        const [mem, cpu, cpuLoad] = await Promise.all([
            si.mem(),
            si.cpu(),
            si.currentLoad()
        ]);

        return {
            cpu: {
                brand: cpu.brand,
                cores: cpu.cores,
                usage: Math.round(cpuLoad.currentLoad * 10) / 10, // Yüzde
                usagePerCore: cpuLoad.cpus?.map(c => Math.round(c.load * 10) / 10) || []
            },
            memory: {
                total: mem.total,
                used: mem.used,
                free: mem.free,
                usagePercent: Math.round((mem.used / mem.total) * 100 * 10) / 10,
                totalGB: (mem.total / 1024 / 1024 / 1024).toFixed(2),
                usedGB: (mem.used / 1024 / 1024 / 1024).toFixed(2),
                freeGB: (mem.free / 1024 / 1024 / 1024).toFixed(2)
            },
            serverUptime: process.uptime(), // Saniye cinsinden
            timestamp: new Date().toISOString()
        };
    } catch (err) {
        console.error('[SYSTEM STATS] İstatistik alınamadı:', err.message);
        
        // Hata durumunda basit fallback
        const used = process.memoryUsage();
        return {
            cpu: { brand: 'Unknown', cores: 1, usage: 0 },
            memory: {
                total: 0,
                used: used.rss,
                free: 0,
                usagePercent: 0,
                totalGB: '0',
                usedGB: (used.rss / 1024 / 1024 / 1024).toFixed(2),
                freeGB: '0'
            },
            serverUptime: process.uptime(),
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Uptime süresini okunabilir formata çevir
 * @param {number} ms - Millisecond cinsinden süre
 * @returns {string} "2 gün 3 saat 15 dakika" formatında
 */
function formatUptime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}g`);
    if (hours > 0) parts.push(`${hours}s`);
    if (minutes > 0) parts.push(`${minutes}d`);
    if (parts.length === 0) parts.push(`${seconds}sn`);

    return parts.join(' ');
}

module.exports = { getSystemStats, formatUptime };
