# APEX | Hosting 🚀

Discord OAuth2 tabanlı, tam kapsamlı Node.js Bot ve Web Sitesi hosting platformu.

## 🌟 Özellikler

* **Discord OAuth2 Girişi**: Kullanıcılar Discord hesaplarıyla saniyeler içinde giriş yapabilir.
* **Zip ile Hızlı Yükleme**: Projelerini `.zip` olarak yükleyen kullanıcıların dosyaları otomatik çıkartılır, `npm install` atılır ve proje saniyeler içinde başlatılır.
* **Gelişmiş Kod Editörü**: Müşteriler tarayıcı üzerinden (CodeMirror) kodlarını düzenleyebilir.
* **Auto-Restart (Otomatik Yeniden Başlatma)**: Editör üzerinden kod kaydedildiğinde bot/site anında kendini yeniden başlatır.
* **Canlı Konsol (Live Logs)**: WebSocket altyapısı sayesinde botun terminal logları saniyesi saniyesine panele yansır.
* **İzole Süreçler**: Her müşterinin botu izole bir Node.js `child_process` olarak çalıştırılır.

## 👑 Owner (Kurucu) Özellikleri

`umutpapa123` isimli kurucu (Discord ID: `1403495996138323989`) giriş yaptığında özel bir güvenlik duvarıyla karşılaşır.
Şifre: `umutbaba123u` girildikten sonra Owner paneli açılır.

* **Sunucu İstatistikleri**: Anlık RAM ve CPU kullanım oranlarını canlı izleme.
* **Müşteri Kontrolü**: Hangi müşterinin hangi botu çalıştırdığını görme.
* **Projeye Müdahale**: Müşterilerin botlarını tek tıkla durdurma, başlatma veya silme.
* **Ban Sistemi**: Kural ihlali yapan kullanıcıyı tek tıkla sistemden yasaklama (Banlanan kullanıcının tüm botları anında durdurulur).
* **Duyuru Sistemi**: Tüm müşteri panellerine renkli (Bilgi, Başarı, Uyarı, Hata) duyurular gönderme.

## 🚀 Kurulum (Local)

1. Depoyu klonlayın veya zip'ten çıkartın.
2. Konsola `npm install` yazarak bağımlılıkları indirin.
3. `.env.example` dosyasının adını `.env` olarak değiştirin ve içini doldurun (Discord Client ID ve Secret gereklidir).
4. `npm start` yazarak projeyi başlatın.
5. Tarayıcıda `http://localhost:3000` adresine gidin.

## 🚂 Railway Üzerinde Yayınlama (Deploy)

Bu proje Railway altyapısına tam uyumludur (Docker desteği içerir).

1. Projeyi GitHub deponuza yükleyin.
2. Railway.app paneline girin ve `New Project -> Deploy from GitHub repo` seçeneğini seçin.
3. Hosting deponuzu seçin.
4. **Environment Variables (Ortam Değişkenleri)** kısmına `.env` dosyanızdaki değerleri girin:
   - `DISCORD_CLIENT_ID`
   - `DISCORD_CLIENT_SECRET`
   - `DISCORD_REDIRECT_URI` (Örn: `https://senin-railway-url.up.railway.app/auth/discord/callback`)
   - `SESSION_SECRET` (Rastgele karmaşık bir şifre)
   - `OWNER_DISCORD_ID` = `1403495996138323989`
   - `OWNER_PASSWORD` = `umutbaba123u`
   - `APP_URL` (Örn: `https://senin-railway-url.up.railway.app`)
5. Railway otomatik olarak `Dockerfile` dosyasını algılayacak ve kurulumu saniyeler içinde tamamlayacaktır. Artık platformunuz yayında!

---
*Coded with ❤️ for APEX*
