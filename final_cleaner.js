const fs = require('fs');
const files = [
    'public/index.html',
    'public/dashboard.html',
    'public/owner.html'
];

const fixMap = {
    'AÃŞPEX': 'APEX',
    'yÃ¶net': 'yönet',
    'baÅŸlat': 'başlat',
    'OAÃşuth2': 'OAuth2',
    'anÄ±nda': 'anında',
    'giriÅŸ': 'giriş',
    'GiriÅŸ': 'Giriş',
    'AÃŞnÄ±nda': 'Anında',
    'yÃ¼kle': 'yükle',
    'iÃ§inde': 'içinde',
    'baÅŸlasÄ±n': 'başlasın',
    'CanlÄ±': 'Canlı',
    'EditÃ¶r': 'Editör',
    'Ã¼zerinden': 'üzerinden',
    'dÃ¼zenle': 'düzenle',
    'AÃŞuto-Restart': 'Auto-Restart',
    'loglarÄ±nÄ±': 'loglarını',
    'DoÄŸrulaması': 'Doğrulaması',
    'LÃ¼tfen': 'Lütfen',
    'gÃ¼venlik': 'güvenlik',
    'DoÄŸrula': 'Doğrula',
    'RAÃŞM': 'RAM',
    'AÃŞKTİF': 'AKTİF',
    'Kontrolü¼': 'Kontrolü',
    'TÃ¼m': 'Tüm',
    'YÃ¶netimi': 'Yönetimi',
    'GÃ¼n': 'Gün',
    'Ã°şlemi': 'İşlemi',
    'Ä°ŞLEM': 'İŞLEM',
    'BaşlıÄŸı': 'Başlığı',
    'YÃ¼kle': 'Yükle',
    'Proje Açdıı': 'Proje Adı',
    'MÃ¼zik': 'Müzik',
    'Açna Dosya': 'Ana Dosya',
    'SÃ¼rÃ¼kle': 'Sürükle',
    'SeççÄŞ': 'Seç',
    'ÅŸ': 'ş',
    'Ä±': 'ı',
    'Ã§': 'ç',
    'Ã¼': 'ü',
    'Ã¶': 'ö',
    'ÄŸ': 'ğ',
    'Ä°': 'İ',
    'Ã‡': 'Ç',
    'Ã–': 'Ö',
    'Ãœ': 'Ü',
    'Åž': 'Ş',
    'Äž': 'Ğ',
    'Ã°': 'İ'
};

files.forEach(file => {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');
    
    // Once spesifik kelimeleri degistir
    for (const [bad, good] of Object.entries(fixMap)) {
        content = content.split(bad).join(good);
    }

    fs.writeFileSync(file, content, 'utf8');
    console.log(file + ' temizlendi.');
});
