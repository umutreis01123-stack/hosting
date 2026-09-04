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
    
    // Bozulan kelimeler - Outputtan kopyalanan gercek halleri
    const replacements = {
        'APEX': 'APEX',
        'APEX': 'APEX',
        'APEC': 'APEX',
        'SSTEM BAKIMDA': 'SİSTEM BAKIMDA',
        'Owner ?ifre Modal': 'Kurucu Şifre Ekranı',
        'ŎkY Yap': 'Çıkış Yap',
        'GǬvenlik DoYrulamas': 'Güvenlik Doğrulaması',
        'Kurucu hesab tespit edildi. LǬtfen gǬvenlik Yifrenizi girin.': 'Kurucu hesabı tespit edildi. Lütfen güvenlik şifrenizi girin.',
        'Owner ?ifresi...': 'Kurucu Şifresi...',
        'DoYrula': 'Doğrula',
        'Projelerim GrǬnǬmǬ': 'Projelerim Görünümü',
        'Yeni YǬkle GrǬnǬmǬ': 'Yeni Yükle Görünümü',
        'Destek (Yapay Zeka) GrǬnǬmǬ': 'Destek (Yapay Zeka) Görünümü',
        'Proje Detay GrǬnǬmǬ (Editr & Konsol)': 'Proje Detay Görünümü (Editör & Konsol)',
        'Proje Ad': 'Proje Adı',
        'Proje Dosyas (.zip)': 'Proje Dosyası (.zip)',
        'SǬrǬkle brak veya': 'Sürükle bırak veya',
        'Dosya Se': 'Dosya Seç',
        'YǬkle ve BaYlat': 'Yükle ve Başlat',
        'Nasl yardmc olabilirim?': 'Nasıl yardımcı olabilirim?',
        'Sorunuzu buraya yazn...': 'Sorunuzu buraya yazın...',
        'Gnder': 'Gönder',
        'BaYlat': 'Başlat',
        'Yeniden BaYlat': 'Yeniden Başlat',
        'Durdur': 'Durdur',
        'Projeyi Sil': 'Projeyi Sil',
        'Ayarlar (DNS ve Durum)': 'Ayarlar (DNS ve Durum)',
        'Bot Durumu': 'Bot Durumu',
        'Durum metni...': 'Durum metni...',
        'Durumu Kaydet': 'Durumu Kaydet',
        'DNS Kayitlari': 'DNS Kayıtları',
        'Deger': 'Değer',
        'Dosya Yneticisi': 'Dosya Yöneticisi',
        'Dosyalar': 'Dosyalar',
        'Bir dosya sein...': 'Bir dosya seçin...',
        'Kaydet (Auto-Restart)': 'Kaydet (Auto-Restart)',
        'Canl Konsol': 'Canlı Konsol',
        'Ylemi Uygula': 'İşlemi Uygula',
        'TǬm Projeleri Yeniden': 'Tüm Projeleri Yeniden',
        'Acil Durdurma': 'Acil Durdurma',
        'Sistem KontrolǬ': 'Sistem Kontrolü',
        'Kredi Ynetimi': 'Kredi Yönetimi',
        'Kullanc (Discord ID)': 'Kullanıcı (Discord ID)',
        'Miktar (-rn:': 'Miktar (Örn:',
        'Kredi Ekle': 'Kredi Ekle',
        'Krediyi Ayarla': 'Krediyi Ayarla',
        'Krediyi Sfrla': 'Krediyi Sıfırla',
        'Ayarla': 'Ayarla',
        'Sfrla': 'Sıfırla',
        'Ynetimi': 'Yönetimi',
        'GrǬnǬmǬ': 'Görünümü',
        'Ylem': 'İşlem'
    };

    for (const [bad, good] of Object.entries(replacements)) {
        content = content.split(bad).join(good);
    }
    
    // Ekstra kirli karakter temizligi (sayfa basliklari vb)
    content = content.replace(/A\ufffdPEX/g, 'APEX');
    
    fs.writeFileSync(file, content, 'utf8');
});
console.log('Final text fixes applied.');
