import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { sanitizeInput } from '../../utils/sanitize';
import { avatarOptions } from '../../constants/avatarOptions';

export default function EditProfileModal({ theme, userData, setUserData, onClose }) {
  const { t } = useLanguage();
  const [editFullName, setEditFullName] = useState(userData?.full_name || '');
  const [editAvatar,   setEditAvatar]   = useState(userData?.avatar || '🐟');
  const [success,      setSuccess]      = useState('');

  const handleSave = () => {
    setSuccess('');
    const updates = {};

    const newFullName = editFullName.trim();
    if (newFullName && newFullName !== (userData?.full_name || '').trim()) {
      updates.full_name    = sanitizeInput(newFullName, 50);
      updates.display_name = sanitizeInput(newFullName, 50);
    }

    if (editAvatar !== userData?.avatar) {
      updates.avatar = editAvatar;
    }

    if (Object.keys(updates).length === 0) {
      setSuccess(t('profile.noChanges') || 'Değişiklik yok');
      return;
    }

    setUserData({ ...userData, ...updates });
    setSuccess(t('profile.saved') || 'Kaydedildi!');
    setTimeout(onClose, 700);
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`${theme.modal} rounded-2xl p-5 w-full max-w-md border border-slate-600`} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-teal-400">{t('settings.editProfile')}</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        {success && (
          <div className="bg-green-600 rounded-xl p-3 mb-4 text-white text-sm text-center">{success}</div>
        )}

        <div className="space-y-4">
          {/* Ad Soyad */}
          <div>
            <label className={`text-sm ${theme.textMuted} block mb-1`}>
              {t('profile.fullName') || 'Ad Soyad'}
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

          {/* Avatar */}
          <div>
            <label className={`text-sm ${theme.textMuted} block mb-2`}>Emoji</label>
            <div className="grid grid-cols-6 gap-2 max-h-52 overflow-y-auto">
              {avatarOptions.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setEditAvatar(emoji)}
                  className={`text-2xl p-2 rounded-xl transition-all flex items-center justify-center aspect-square ${
                    editAvatar === emoji
                      ? 'bg-teal-600 scale-110'
                      : `${theme.input} border`
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className={`flex-1 py-2.5 rounded-xl ${theme.input} border ${theme.text}`}
            >
              {t('pomodoro.cancel')}
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 font-bold text-white"
            >
              {t('profile.save') || 'Kaydet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
