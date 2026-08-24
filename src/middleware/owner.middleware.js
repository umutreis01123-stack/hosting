/**
 * ============================================
 * APEX | Hosting — Owner Middleware
 * Owner yetkisini doğrular
 * ============================================
 */

/**
 * Owner şifresinin doğrulanmış olmasını kontrol eder
 * Owner paneli route'larını korur
 */
function requireOwner(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            success: false,
            message: 'Giriş yapmanız gerekiyor',
            redirect: '/'
        });
    }

    if (!req.session.isOwner) {
        return res.status(403).json({
            success: false,
            message: 'Bu alana erişim yetkiniz yok. Owner girişi gereklidir.',
            requireOwnerLogin: true
        });
    }

    // Owner Discord ID'sini de doğrula (ek güvenlik katmanı)
    const ownerDiscordId = process.env.OWNER_DISCORD_ID || '1403495996138323989';
    if (req.session.user.id !== ownerDiscordId) {
        req.session.isOwner = false; // Sahte owner sessionını temizle
        return res.status(403).json({
            success: false,
            message: 'Geçersiz owner kimliği'
        });
    }

    next();
}

module.exports = { requireOwner };
