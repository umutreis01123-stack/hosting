const fs = require('fs');
const files = ['public/dashboard.html', 'public/owner.html', 'public/index.html'];

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Yalnizca HTML metin iceriklerini degistiren guvenli degistirmeler
    const replacements = {
        'GǬrǬnǬmǬ': 'Görünümü',
        'YǬkle': 'Yükle',
        'BaYlat': 'Başlat',
        'BaYlk': 'Başlık',
        'BaYaryla': 'Başarıyla',
        'ŎkY': 'Çıkış',
        'Kullanc': 'Kullanıcı',
        'Kullanc': 'Kullanıcı',
        'Ad': 'Adı',
        '-rn': 'Örn',
        '?ifre': 'Şifre',
        'DoYrula': 'Doğrula',
        'MǬYteri': 'Müşteri',
        'MǬYteri': 'Müşteri',
        'Dn': 'Dön',
        'TǬm': 'Tüm',
        'alYan': 'çalışan',
        'iYlem': 'işlem',
        'İyi': 'İyi',
        'Krmz': 'Kırmızı',
        'Yaynla': 'Yayınla',
        'Sfrla': 'Sıfırla',
        'Ynetici': 'Yönetici',
        'Ynetimi': 'Yönetimi',
        'oluYtu': 'oluştu',
        'GǬvenlik': 'Güvenlik',
        'Sein': 'Seçin',
        'Se': 'Seç',
        'Gnder': 'Gönder',
        'A': 'Aç',
        'Canl': 'Canlı',
        'MǬzik': 'Müzik',
        'SǬrǬkle': 'Sürükle',
        'brak': 'bırak',
        'Uyar': 'Uyarı',
        'Sar': 'Sarı',
        'APEX': 'APEX'
    };

    for (const [bad, good] of Object.entries(replacements)) {
        content = content.split(bad).join(good);
    }

    fs.writeFileSync(file, content, 'utf8');
    console.log(file + ' duzeltildi.');
});
