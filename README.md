# SWIM - Study With Me 🌊

Kişisel gelişim ve çalışma takip uygulaması.

## 🚀 Özellikler

### ⏱️ Pomodoro Timer
- 25/5, 40/10, 60/15 preset'ler
- Serbest mod (sınırsız çalışma)
- Ortam sesleri (Yağmur, Okyanus, Orman)
- Saniye bazında çalışma takibi

### 📊 İstatistikler
- Gün/Hafta/Ay/Yıl görünümü
- Geçmiş dönemleri görüntüleme
- Grafik ile görselleştirme

### 🏆 Başarım Sistemi
- 10 farklı unvan (Başlangıç → İmparator)
- 1 saatten 10.000 saate kadar hedefler

### 👥 Arkadaşlar
- Kullanıcı arama ve ekleme
- Birlikte çalışma daveti
- Özel mesajlaşma (50 mesaj)
- Durum: Müsait/Meşgul/Gizli

### 📅 Plan Takvimi
- Günlük plan ekleme
- Takvim görünümü

### ⚙️ Ayarlar
- Karanlık/Aydınlık mod
- Bildirimler
- Profil düzenleme (haftalık)
- Hesap silme

## 💻 Kurulum

```bash
npm install
npm run dev
```

## 🔊 Ses Dosyaları

`public/sounds/` klasörüne ekle:
- `rain.mp3` - Yağmur sesi (10dk loop)
- `ocean.mp3` - Okyanus sesi
- `forest.mp3` - Orman sesi
- `cafe.mp3` - Kafe sesi

## 🔥 Firebase Ayarları

1. Firebase Console → Authentication → Email/Password etkinleştir
2. Firestore Database → Test modunda başlat
3. `.env` dosyasını düzenle

## 📱 Dağıtım

```bash
npm run build
```

`dist/` klasörünü Vercel, Netlify veya Firebase Hosting'e yükle.
