import React, { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../../supabase';
import { useLanguage } from '../../i18n';
import { sanitizeInput } from '../../utils/sanitize';

export default function EditProfileModal({ theme, user, userData, setUserData, onClose, isOnline }) {
  const { t } = useLanguage();
  const [editUsername, setEditUsername] = useState(userData?.displayName || '');
  const [editFullName, setEditFullName] = useState(userData?.fullName || '');
  const [editEmail, setEditEmail] = useState(userData?.email || '');
  const [usernameStatus, setUsernameStatus] = useState(null), [error, setError] = useState(''), [success, setSuccess] = useState('');

  const canEditUsername = () => !userData?.lastUsernameChange || (Date.now() - new Date(userData.lastUsernameChange).getTime()) / 86400000 >= 7;
  const canEditEmail = () => !userData?.lastEmailChange || (Date.now() - new Date(userData.lastEmailChange).getTime()) / 86400000 >= 7;
  const getDaysUntil = d => d ? Math.max(0, Math.ceil(7 - (Date.now() - new Date(d).getTime()) / 86400000)) : 0;

  useEffect(() => {
    if (editUsername.length < 3 || editUsername.toLowerCase() === userData?.username) { setUsernameStatus(null); return; }
    const timer = setTimeout(async () => {
      setUsernameStatus('checking');
      try {
        const { data, error: e } = await supabase
          .from('users')
          .select('id')
          .eq('username', editUsername.toLowerCase())
          .neq('id', user.id)
          .maybeSingle();
        if (e) throw e;
        setUsernameStatus(data ? 'taken' : 'available');
      } catch (e) { console.warn('Username check failed:', e.message); setUsernameStatus(null); }
    }, 500);
    return () => clearTimeout(timer);
  }, [editUsername, userData?.username]);

  const handleSave = async () => {
    if (!isOnline) { setError(t('auth.noInternet')); return; }
    setError(''); setSuccess('');
    const updates = {};
    if (editUsername.toLowerCase() !== userData?.username && canEditUsername()) {
      if (usernameStatus !== 'available') { setError(t('profile.usernameNotAvailable')); return; }
      updates.username = sanitizeInput(editUsername, 20).toLowerCase();
      updates.display_name = sanitizeInput(editUsername, 20);
      updates.last_username_change = new Date().toISOString();
    }
    if (editFullName !== userData?.fullName) {
      updates.full_name = sanitizeInput(editFullName, 30);
    }
    if (editEmail !== userData?.email && canEditEmail()) {
      try {
        const { error: emailError } = await supabase.auth.updateUser({ email: editEmail });
        if (emailError) throw emailError;
        updates.email = editEmail;
        updates.last_email_change = new Date().toISOString();
      } catch (e) {
        if (e.message?.includes('recent login') || e.message?.includes('reauthentication')) setError(t('profile.reloginRequired'));
        else setError(t('profile.emailChangeFailed'));
        return;
      }
    }
    if (Object.keys(updates).length > 0) {
      try {
        const { error: updateError } = await supabase
          .from('users')
          .update(updates)
          .eq('id', user.id);
        if (updateError) throw updateError;
        // Mirror snake_case updates back into camelCase userData shape for local state
        const localUpdates = {};
        if (updates.username !== undefined) localUpdates.username = updates.username;
        if (updates.display_name !== undefined) { localUpdates.displayName = updates.display_name; localUpdates.last_username_change = updates.last_username_change; }
        if (updates.full_name !== undefined) localUpdates.fullName = updates.full_name;
        if (updates.email !== undefined) { localUpdates.email = updates.email; localUpdates.last_email_change = updates.last_email_change; }
        setUserData({ ...userData, ...localUpdates });
        setSuccess(t('profile.saved'));
      } catch (e) { console.warn('Profile save failed:', e.message); setError(t('profile.saveFailed')); }
    } else {
      setSuccess(t('profile.noChanges'));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`${theme.modal} rounded-2xl p-5 w-full max-w-md border border-slate-600`} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-teal-400">{t('settings.editProfile')}</h3><button onClick={onClose}><X size={20} /></button></div>
        {error && <div className="bg-red-600 rounded-xl p-3 mb-4 text-white text-sm text-center">{error}</div>}
        {success && <div className="bg-green-600 rounded-xl p-3 mb-4 text-white text-sm text-center">{success}</div>}
        <div className="space-y-4">
          <div>
            <label className={`text-sm ${theme.textMuted} block mb-1`}>{t('profile.username')} <span className="text-xs opacity-60">({t('profile.weeklyLimit')})</span> {!canEditUsername() && <span className="text-yellow-400">({getDaysUntil(userData?.lastUsernameChange)} {t('profile.daysLeft')})</span>}</label>
            <div className="relative">
              <input type="text" value={editUsername} onChange={e => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} disabled={!canEditUsername()} className={`w-full ${theme.input} rounded-xl p-3 outline-none border ${theme.text} ${!canEditUsername() ? 'opacity-50' : ''}`} maxLength={20} />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {usernameStatus === 'checking' && <Loader2 size={18} className="animate-spin text-slate-400" />}
                {usernameStatus === 'available' && <CheckCircle size={18} className="text-green-400" />}
                {usernameStatus === 'taken' && <XCircle size={18} className="text-red-400" />}
              </div>
            </div>
          </div>
          <div>
            <label className={`text-sm ${theme.textMuted} block mb-1`}>{t('profile.fullName')}</label>
            <input type="text" value={editFullName} onChange={e => setEditFullName(e.target.value)} className={`w-full ${theme.input} rounded-xl p-3 outline-none border ${theme.text}`} maxLength={30} placeholder={t('profile.fullName')} />
          </div>
          <div>
            <label className={`text-sm ${theme.textMuted} block mb-1`}>{t('profile.email')} <span className="text-xs opacity-60">({t('profile.weeklyLimit')})</span> {!canEditEmail() && <span className="text-yellow-400">({getDaysUntil(userData?.lastEmailChange)} {t('profile.daysLeft')})</span>}</label>
            <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} disabled={!canEditEmail()} className={`w-full ${theme.input} rounded-xl p-3 outline-none border ${theme.text} ${!canEditEmail() ? 'opacity-50' : ''}`} />
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className={`flex-1 py-2.5 rounded-xl ${theme.input} border ${theme.text}`}>{t('pomodoro.cancel')}</button>
            <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 font-bold text-white">{t('profile.save')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
