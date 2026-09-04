const fs = require('fs');
const path = require('path');

const files = [
    'public/dashboard.html',
    'public/owner.html',
    'public/index.html',
    'public/js/dashboard.js',
    'public/js/owner.js'
];

files.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Cok bozulan kelimeleri degistir
        content = content.replace(/GǬrǬnǬmǬ/g, 'Görünümü');
        content = content.replace(/YǬkle/g, 'Yükle');
        content = content.replace(/BaYlat/g, 'Başlat');
        content = content.replace(/BaYlat/g, 'Başlat');
        content = content.replace(/ŎkY/g, 'Çıkış');
        content = content.replace(/Kullanc/g, 'Kullanıcı');
        content = content.replace(/Kullanc/g, 'Kullanıcı');
        content = content.replace(/Ad/g, 'Adı');
        content = content.replace(/-rn/g, 'Örn');
        content = content.replace(/\?rn/g, 'Örn');
        content = content.replace(/Yifre/g, 'Şifre');
        content = content.replace(/DoYrula/g, 'Doğrula');
        content = content.replace(/MǬYteri/g, 'Müşteri');
        content = content.replace(/MǬYteri/g, 'Müşteri');
        content = content.replace(/Dn/g, 'Dön');
        content = content.replace(/TǬm/g, 'Tüm');
        content = content.replace(/alYan/g, 'çalışan');
        content = content.replace(/alYan/g, 'çalışan');
        content = content.replace(/iYlem/g, 'işlem');
        content = content.replace(/iYlem/g, 'işlem');
        content = content.replace(/yi/g, 'İyi');
        content = content.replace(/BaYlY/g, 'Başlığı');
        content = content.replace(/Krmz/g, 'Kırmızı');
        content = content.replace(/Yaynla/g, 'Yayınla');
        content = content.replace(/Sfrla/g, 'Sıfırla');
        content = content.replace(/Ynetimi/g, 'Yönetimi');
        content = content.replace(/Ynetimi/g, 'Yönetimi');
        content = content.replace(/BaYaryla/g, 'Başarıyla');
        content = content.replace(/oluYtu/g, 'oluştu');
        content = content.replace(/GǬvenlik/g, 'Güvenlik');
        content = content.replace(/Sein/g, 'Seçin');
        content = content.replace(/Se/g, 'Seç');
        content = content.replace(/Gnder/g, 'Gönder');
        content = content.replace(/A/g, 'Aç');
        content = content.replace(/Canl/g, 'Canlı');
        content = content.replace(/MǬzik/g, 'Müzik');
        content = content.replace(/SǬrǬkle/g, 'Sürükle');
        content = content.replace(/brak/g, 'bırak');
        content = content.replace(/Uyar/g, 'Uyarı');
        content = content.replace(/Sar/g, 'Sarı');
        content = content.replace(/Ynetici/g, 'Yönetici');

        fs.writeFileSync(filePath, content, 'utf8');
        console.log("Fixed:", file);
    }
});
