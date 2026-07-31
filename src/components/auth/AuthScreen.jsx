import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { avatarOptions } from '../../constants/avatarOptions';
import { THEME_IDS } from '../../constants/themes';
import { useLanguage } from '../../i18n';
import Logo from '../ui/Logo';

function generateUsername(fullName) {
  return fullName
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    // Latin dışı alfabeleri koru — [^a-z0-9] kullanılırsa 田中太郎, Иван,
    // राहुल gibi isimler tamamen silinip herkes aynı fallback'e düşerdi.
    // \p{M} şart: Devanagari sesli harf işaretleri (matra) harf değil
    // birleşen işaret sayılır, dışlanırsa राहुल -> र_ह_ल olur.
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 20) || 'user';
}

export default function AuthScreen({ onUserCreated }) {
  const { t } = useLanguage();
  const [fullName, setFullName]   = useState('');
  const [avatar, setAvatar]       = useState('🐟');
  const [error, setError]         = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const name = fullName.trim();
    if (name.length < 2) { setError(t('auth.nameTooShort')); return; }

    const savedTheme = localStorage.getItem('swim_theme') || 'dark';
    const profile = {
      id:               crypto.randomUUID(),
      username:         generateUsername(name),
      full_name:        name,
      display_name:     name,
      avatar,
      theme_id:         THEME_IDS[savedTheme] || 3,
      total_study_secs: 0,
      plans:            [],
      about_me:         '',
      show_study_time:  true,
      current_streak:   0,
      longest_streak:   0,
      created_at:       new Date().toISOString(),
    };

    onUserCreated(profile);
  };

  const isNative = Capacitor.isNativePlatform();

  return (
    <div className="min-h-screen overflow-y-auto bg-gradient-to-br from-gray-950 via-gray-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Logo size="lg" centered />
          <p className="text-teal-300 text-sm mt-2">{t('auth.tagline')}</p>
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-xl font-bold text-white text-center mb-6">
            {t('auth.introTitle')}
          </h2>

          {error && (
            <div className="bg-red-600 rounded-xl p-3 mb-4 text-white text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Ad Soyad */}
            <div>
              <label className="text-gray-400 text-sm block mb-1.5">{t('auth.fullName')}</label>
              <input
                type="text"
                value={fullName}
                onChange={e => { setFullName(e.target.value); setError(''); }}
                className="w-full bg-gray-800 rounded-xl p-3 text-white border border-gray-700 focus:border-teal-500 outline-none"
                placeholder={t('auth.fullNamePlaceholder')}
                maxLength={40}
                autoFocus={!isNative}
                required
              />
            </div>

            {/* Emoji seçici */}
            <div>
              <label className="text-gray-400 text-sm block mb-2">{t('auth.pickEmoji')}</label>
              <div className="grid grid-cols-5 gap-2 max-h-52 overflow-y-auto">
                {avatarOptions.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setAvatar(emoji)}
                    className={`text-2xl p-2 rounded-xl transition-all flex items-center justify-center aspect-square ${
                      avatar === emoji
                        ? 'bg-teal-600 scale-110 shadow-lg shadow-teal-900'
                        : 'bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Önizleme */}
            <div className="flex items-center gap-3 bg-gray-800 rounded-xl px-4 py-3">
              <span className="text-4xl">{avatar}</span>
              <p className="text-white font-bold text-base">
                {fullName.trim() || t('auth.namePreview')}
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-teal-600 to-cyan-600 rounded-xl font-bold text-white text-base"
            >
              {t('auth.start')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
