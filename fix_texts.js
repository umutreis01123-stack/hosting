const fs = require('fs');
const files = [
    'public/index.html',
    'public/dashboard.html',
    'public/owner.html',
    'public/js/dashboard.js',
    'public/js/owner.js'
];

files.forEach(file => {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');
    
    // Bozulan kelimeler (Ozel Regex ve String degistirmeler)
    content = content.replace(/A\ufffdPEX/g, 'APEX');
    content = content.replace(/APEX/g, 'APEX');
    content = content.replace(/APEC/g, 'APEX');
    content = content.replace(/G\u01ECr\u01ECn\u01ECm\u01EC/g, 'Görünümü');
    content = content.replace(/GÃ¼venlik/g, 'Güvenlik');
    content = content.replace(/Ã‡Ä±kÄ±ÅŸ/g, 'Çıkış');
    content = content.replace(/Y\u01ECkle/g, 'Yükle');
    content = content.replace(/Ba[Yyş]lat/g, 'Başlat');
    content = content.replace(/ŎkY/g, 'Çıkış');
    content = content.replace(/KullanÄ±cÄ±/g, 'Kullanıcı');
    content = content.replace(/Kullanc/g, 'Kullanıcı');
    content = content.replace(/Ã–rn/g, 'Örn');
    content = content.replace(/\?rn/g, 'Örn');
    content = content.replace(/-rn/g, 'Örn');
    content = content.replace(/Do[Yyğ]rula/g, 'Doğrula');
    content = content.replace(/M\u01ECYteri/g, 'Müşteri');
    content = content.replace(/MÃ¼ÅŸteri/g, 'Müşteri');
    content = content.replace(/DÃ¶n/g, 'Dön');
    content = content.replace(/T\u01ECm/g, 'Tüm');
    content = content.replace(/Ã§alÄ±ÅŸan/g, 'çalışan');
    content = content.replace(/alYan/g, 'çalışan');
    content = content.replace(/i[Yyş]lem/g, 'işlem');
    content = content.replace(/Ã‡/g, 'Ç');
    content = content.replace(/ÅŸ/g, 'ş');
    content = content.replace(/Ä±/g, 'ı');
    content = content.replace(/Ylemi Uygula/g, 'İşlemi Uygula');
    content = content.replace(/oluYtu/g, 'oluştu');
    content = content.replace(/G\u01ECvenlik/g, 'Güvenlik');
    content = content.replace(/S\u01ECr\u01ECkle/g, 'Sürükle');
    content = content.replace(/M\u01ECzik/g, 'Müzik');
    content = content.replace(/Krmz/g, 'Kırmızı');
    content = content.replace(/Sfrla/g, 'Sıfırla');
    content = content.replace(/Ynetimi/g, 'Yönetimi');
    
    // Kalan bozuk \ufffd karakterlerini bul ve 'i' veya bosluk yap
    content = content.replace(/\ufffd/g, '');

    fs.writeFileSync(file, content, 'utf8');
});
console.log('Tüm kodlama hataları düzeltildi.');
