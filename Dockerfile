# =========================================
# APEX | Hosting — Dockerfile
# Railway üzerinde sorunsuz çalışacak şekilde yapılandırılmıştır
# =========================================

FROM node:20-alpine

# Çalışma dizini
WORKDIR /app

# Sistem bağımlılıkları (zip/unzip için)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    unzip \
    zip \
    curl

# npm paketlerini önce kopyala (cache optimization)
COPY package*.json ./

# Bağımlılıkları yükle
RUN npm install --production

# Tüm proje dosyalarını kopyala
COPY . .

# Gerekli klasörleri oluştur
RUN mkdir -p uploads projects data

# Veri dosyalarını başlat (eğer yoksa)
RUN [ ! -f data/users.json ] && echo "{}" > data/users.json || true
RUN [ ! -f data/projects.json ] && echo "{}" > data/projects.json || true
RUN [ ! -f data/announcements.json ] && echo "[]" > data/announcements.json || true

# Port
EXPOSE 8080

# Uygulamayı başlat
CMD ["node", "server.js"]
