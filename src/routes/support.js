const express = require('express');
const router = express.Router();

let genAI = null;
let model = null;

// Gemini API baslatma
try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
        genAI = new GoogleGenerativeAI(apiKey);
        model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        console.log('[SISTEM] Gemini AI basariyla baglandi.');
    } else {
        console.log('[SISTEM] GEMINI_API_KEY bulunamadi. AI destek basit modda calisacak.');
    }
} catch(e) {
    console.log('[SISTEM] Gemini yuklenemedi:', e.message);
}

const SYSTEM_PROMPT = 'Sen APEX Hosting platformunun yapay zeka destek asistanisin. Kullanicilara Discord botlari ve web siteleri barindirma (hosting) konularinda yardimci oluyorsun. Turkce konusuyorsun. Kisa ve net cevaplar ver. Sorun cozulemezse kullaniciyi Discord canli destege yonlendir: https://discord.gg/3pRqYchFRV - Sadece hosting, bot kurulumu, hata cozumu, dosya yukleme, proje yonetimi gibi konularda yardimci ol. Diger konularda kibarca reddedip hosting konularina yonlendir.';

router.post('/support', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false, reply: 'Giris yapmaniz gerekiyor.' });

    const { message } = req.body;
    if (!message || !message.trim()) return res.json({ success: true, reply: 'Lutfen bir soru yazin.' });

    // Gemini varsa gercek AI, yoksa basit kelime esleme
    if (model) {
        try {
            const chat = model.startChat({
                history: [{ role: 'user', parts: [{ text: SYSTEM_PROMPT }] }, { role: 'model', parts: [{ text: 'Anlasildi. APEX Hosting destek asistani olarak hazirdayim.' }] }]
            });
            const result = await chat.sendMessage(message);
            const reply = result.response.text();
            return res.json({ success: true, reply: reply });
        } catch(e) {
            console.error('[GEMINI] Hata:', e.message);
            return res.json({ success: true, reply: 'Yapay zeka sunucusuna ulasilamadi. Lutfen Discord sunucumuzdan destek alin: https://discord.gg/3pRqYchFRV' });
        }
    }

    // Fallback: Basit kelime esleme
    const lower = message.toLowerCase();
    const responses = [
        { keys: ['bot', 'baslamiyor', 'calismiyor', 'start'], reply: 'Botunuz baslamiyorsa: 1) Proje detayindan Baslat butonuna tiklayin. 2) Konsolda hata var mi bakin. 3) node_modules olmadan zip yukleyin.' },
        { keys: ['zip', 'yukleme', 'upload', 'dosya'], reply: 'Zip yukleme icin: 1) Max 50MB olmali. 2) Dogrudan proje dosyalarini icermeli. 3) package.json icermeli.' },
        { keys: ['token', 'env', 'gizli'], reply: 'Token/API key eklemek icin proje detayinda .env dosyasi olusturun ve TOKEN=deger seklinde yazin.' },
        { keys: ['kredi', 'credit', 'bakiye'], reply: 'Kredi bilginizi sol menudeki profil alaninizda gorebilirsiniz. Kredi yukleme icin yetkililerle iletisime gecin.' },
        { keys: ['merhaba', 'selam', 'yardim', 'nasil'], reply: 'Merhaba! Bot baslat/durdurma, zip yukleme, token ekleme ve konsol hatalari konularinda yardimci olabilirim!' }
    ];
    const found = responses.find(r => r.keys.some(k => lower.includes(k)));
    if (found) return res.json({ success: true, reply: found.reply });
    
    return res.json({ success: true, reply: 'Bu konuda yardimci olamiyorum. Discord sunucumuzdan canli destek alabilirsiniz: https://discord.gg/3pRqYchFRV' });
});

module.exports = router;
