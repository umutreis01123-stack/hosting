/**
 * ============================================
 * APEX | Hosting — Auth Middleware
 * Kullanıcının giriş yapıp yapmadığını kontrol eder
 * ============================================
 */

const fs = require('fs');

/**
 * Giriş yapmış kullanıcı kontrolü
 * API route'larını korumak için kullanılır
 */
function requireAuth(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            success: false,
            message: 'Bu işlem için giriş yapmanız gerekiyor',
            redirect: '/'
        });
    }

    // Kullanıcının banlanıp banlanmadığını kontrol et
    try {
        const usersData = JSON.parse(fs.readFileSync('data/users.json', 'utf8'));
        const user = usersData[req.session.user.id];
        
        if (user && user.banned) {
            req.session.destroy();
            return res.status(403).json({
                success: false,
                message: 'Hesabınız yasaklanmıştır. Destek için iletişime geçin.',
                banned: true
            });
        }
    } catch (err) {
        // Dosya okunamadıysa devam et (ilk kurulum olabilir)
        console.error('[AUTH] Kullanıcı verisi okunamadı:', err.message);
    }

    next();
}

/**
 * Kaynağın sahibi kontrolü
 * Kullanıcı sadece kendi kaynaklarına erişebilir
 */
function requireOwnership(getResourceUserId) {
    return async (req, res, next) => {
        try {
            const resourceUserId = await getResourceUserId(req);
            
            // Owner her şeye erişebilir
            if (req.session.isOwner) return next();
            
            if (resourceUserId !== req.session.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Bu kaynağa erişim yetkiniz yok'
                });
            }
            next();
        } catch (err) {
            res.status(500).json({ success: false, message: 'Yetki kontrolü başarısız' });
        }
    };
}

module.exports = { requireAuth, requireOwnership };
