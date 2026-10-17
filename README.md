# SWIM - Study With Me 🌊

Kişisel gelişim ve çalışma takip uygulaması.

**Tamamen offline çalışır.** Hesap, sunucu veya veritabanı yok — tüm veriler cihazda
`localStorage`'da tutulur. İnternet bağlantısı gerekmez.

## 🚀 Özellikler

### ⏱️ Pomodoro Timer
- 25/5, 40/10, 60/15 preset'ler
- Serbest mod (sınırsız çalışma)
- Ortam sesleri (Yağmur, Okyanus, Orman, Kafe)
- Saniye bazında çalışma takibi
- Arka planda çalışmaya devam (Android foreground service / iOS Live Activity)

### 📊 İstatistikler
- Gün/Hafta/Ay/Yıl görünümü
- Geçmiş dönemleri görüntüleme
- Grafik ile görselleştirme

### 🔥 Çalışma Serisi
- Günlük seri takibi (günde en az 1 dk)
- En uzun seri kaydı
- Seri bozulmadan önce hatırlatma bildirimleri

### 🏆 Başarım Sistemi
- 10 farklı unvan (Yavru Balık → Poseidon)
- 1 saatten 10.000 saate kadar hedefler

### 📅 Plan Takvimi
- Günlük plan ekleme
- Takvim görünümü

### 🌍 Çoklu Dil
11 dil desteği, tarayıcı diline göre otomatik seçim:
Türkçe, İngilizce, Almanca, İspanyolca, Fransızca, Portekizce, Rusça, Japonca,
Korece, Çince, Hintçe

### ⚙️ Ayarlar
- Tema seçimi (karanlık/aydınlık)
- Bildirimler ve sağlık ipuçları
- Profil düzenleme
- Verileri silme

## 💻 Geliştirme

Gereksinimler: Node.js 20+

```bash
npm install
npm run dev
```

Yapılandırma dosyası veya ortam değişkeni gerekmez.

## 🔊 Ses Dosyaları

`public/sounds/` klasörüne ekle:
- `rain.mp3` - Yağmur sesi (10dk loop)
- `ocean.mp3` - Okyanus sesi
- `forest.mp3` - Orman sesi
- `cafe.mp3` - Kafe sesi

## 📱 Mobil Build

Gereksinimler: JDK 21 (Android), Xcode (iOS), Android SDK 36

```bash
npm run cap:android   # Android Studio'da aç
npm run cap:ios       # Xcode'da aç
```

Android release imzalama için `android/keystore.properties` gerekir:

```properties
storeFile=/mutlak/yol/release.jks
storePassword=***
keyAlias=***
keyPassword=***
```

> Keystore ve şifreler git'e **commit edilmez** (`.gitignore`'da). Kaybedilirse
> Play Store'da aynı uygulamaya güncelleme yayınlanamaz — mutlaka yedekle.

## 🌐 Web Dağıtımı

```bash
npm run build         # dist/ üretir
npm run deploy:web    # Firebase Hosting'e yükler
```

`dist/` klasörü statik bir dosya yığınıdır; Vercel, Netlify veya herhangi bir
statik host'a da yüklenebilir.
