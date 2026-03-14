import React, { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../../supabase';
import { useLanguage } from '../../i18n';
import { sanitizeInput } from '../../utils/sanitize';

export default function EditProfileModal({ theme, user, userData, setUserData, onClose, isOnline }) {
  const { t } = useLanguage();
  const [editUsername, setEditUsername] = useState(userData?.display_name || userData?.username || '');
  const [editFullName, setEditFullName] = useState(userData?.full_name || '');
  const [usernameStatus, setUsernameStatus] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const canEditUsername = () => !userData?.last_username_change ||
    (Date.now() - new Date(userData.last_username_change).getTime()) / 86400000 >= 7;

  const getDaysUntil = d => d ? Math.max(0, Math.ceil(7 - (Date.now() - new Date(d).getTime()) / 86400000)) : 0;

  useEffect(() => {
    const lower = editUsername.toLowerCase();
    if (lower.length < 3 || lower === userData?.username) { setUsernameStatus(null); return; }
    const timer = setTimeout(async () => {
      setUsernameStatus('checking');
      try {
        const { data, error: e } = await supabase
          .from('users')
          .select('id')
          .eq('username', lower)
          .neq('id', user.id)
          .maybeSingle();
        if (e) throw e;
        setUsernameStatus(data ? 'taken' : 'available');
      } catch (e) { console.warn('Username check failed:', e.message); setUsernameStatus(null); }
    }, 500);
    return () => clearTimeout(timer);
  }, [editUsername, userData?.username, user.id]);

  const handleSave = async () => {
    if (!isOnline) { setError(t('auth.noInternet')); return; }
    setError(''); setSuccess('');

    const updates = {};
    const localUpdates = {};

    // --- Kullanıcı adı ---
    const newUsername = editUsername.toLowerCase().trim();
    if (newUsername !== userData?.username) {
      if (!canEditUsername()) {
        setError(`Kullanıcı adını değiştirmek için ${getDaysUntil(userData?.last_username_change)} gün beklemelisin`);
        return;
      }
      if (newUsername.length < 3) { setError('Kullanıcı adı en az 3 karakter olmalı'); return; }
      if (usernameStatus === 'taken') { setError(t('profile.usernameNotAvailable') || 'Bu kullanıcı adı zaten alınmış'); return; }
      if (usernameStatus !== 'available') { setError('Kullanıcı adı uygunluğu kontrol ediliyor, lütfen bekle'); return; }
      updates.username = newUsername;
      updates.display_name = sanitizeInput(editUsername.trim(), 20);
      updates.last_username_change = new Date().toISOString();
      localUpdates.username = updates.username;
      localUpdates.display_name = updates.display_name;
      localUpdates.last_username_change = updates.last_username_change;
    }

    // --- Ad soyad (max 50 karakter) ---
    const newFullName = editFullName.trim();
    if (newFullName !== (userData?.full_name || '').trim()) {
      updates.full_name = sanitizeInput(newFullName, 50);
      localUpdates.full_name = updates.full_name;
    }

    if (Object.keys(updates).length === 0) {
      setSuccess(t('profile.noChanges') || 'Değişiklik yok');
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id);
      if (updateError) throw updateError;
      setUserData({ ...userData, ...localUpdates });
      setSuccess(t('profile.saved') || 'Kaydedildi!');
    } catch (e) {
      console.warn('Profile save failed:', e.message);
      setError(t('profile.saveFailed') || 'Kaydedilemedi: ' + e.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`${theme.modal} rounded-2xl p-5 w-full max-w-md border border-slate-600`} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-teal-400">{t('settings.editProfile')}</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        {error && <div className="bg-red-600 rounded-xl p-3 mb-4 text-white text-sm text-center">{error}</div>}
        {success && <div className="bg-green-600 rounded-xl p-3 mb-4 text-white text-sm text-center">{success}</div>}

        <div className="space-y-4">
          {/* Kullanıcı adı */}
          <div>
            <label className={`text-sm ${theme.textMuted} block mb-1`}>
              {t('profile.username')}
              <span className="text-xs opacity-60 ml-1">({t('profile.weeklyLimit') || 'haftada 1 değişiklik'})</span>
              {!canEditUsername() && (
                <span className="text-yellow-400 ml-1">
                  ({getDaysUntil(userData?.last_username_change)} {t('profile.daysLeft') || 'gün kaldı'})
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="text"
                value={editUsername}
                onChange={e => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                disabled={!canEditUsername()}
                className={`w-full ${theme.input} rounded-xl p-3 outline-none border ${theme.text} ${!canEditUsername() ? 'opacity-50' : ''}`}
                maxLength={20}
                placeholder="kullanici_adi"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {usernameStatus === 'checking' && <Loader2 size={18} className="animate-spin text-slate-400" />}
                {usernameStatus === 'available' && <CheckCircle size={18} className="text-green-400" />}
                {usernameStatus === 'taken' && <XCircle size={18} className="text-red-400" />}
              </div>
            </div>
          </div>

          {/* Ad soyad */}
          <div>
            <label className={`text-sm ${theme.textMuted} block mb-1`}>
              {t('profile.fullName') || 'Ad Soyad'}
              <span className="text-xs opacity-60 ml-1">(max 50 karakter)</span>
            </label>
            <input
              type="text"
              value={editFullName}
              onChange={e => setEditFullName(e.target.value.slice(0, 50))}
              className={`w-full ${theme.input} rounded-xl p-3 outline-none border ${theme.text}`}
              maxLength={50}
              placeholder={t('profile.fullName') || 'Adın soyadın'}
            />
            <p className={`text-xs ${theme.textMuted} text-right mt-0.5`}>{editFullName.length}/50</p>
          </div>

          {/* E-posta — salt okunur */}
          <div>
            <label className={`text-sm ${theme.textMuted} block mb-1`}>
              {t('profile.email') || 'E-posta'}
            </label>
            <input
              type="email"
              value={userData?.email || ''}
              disabled
              className={`w-full ${theme.input} rounded-xl p-3 outline-none border ${theme.text} opacity-50 cursor-not-allowed`}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className={`flex-1 py-2.5 rounded-xl ${theme.input} border ${theme.text}`}>
              {t('pomodoro.cancel')}
            </button>
            <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 font-bold text-white">
              {t('profile.save') || 'Kaydet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
