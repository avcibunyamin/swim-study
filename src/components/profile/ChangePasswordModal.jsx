import React, { useState } from 'react';
import { X, KeyRound, Loader2, Check } from 'lucide-react';
import { supabase } from '../../supabase';
import { useLanguage } from '../../i18n';
import { canDoAction } from '../../utils/rateLimit';

export default function ChangePasswordModal({ theme, user, onClose, isOnline }) {
  const { t } = useLanguage();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pwChecks = {
    length: newPassword.length >= 8,
    upper:  /[A-Z]/.test(newPassword),
    lower:  /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
  };
  const pwStrong = Object.values(pwChecks).every(Boolean);

  const handleChangePassword = async () => {
    setError(''); setSuccess('');
    if (!isOnline) { setError(t('auth.noInternet')); return; }
    if (!currentPassword) { setError(t('password.enterCurrent')); return; }
    if (!pwChecks.length) { setError(t('password.minLength')); return; }
    if (!pwChecks.upper)  { setError(t('password.needsUppercase')); return; }
    if (!pwChecks.lower)  { setError(t('password.needsLowercase')); return; }
    if (!pwChecks.number) { setError(t('password.needsNumber')); return; }
    if (newPassword !== confirmNewPassword) { setError(t('password.mismatch')); return; }
    if (currentPassword === newPassword) { setError(t('password.sameAsOld')); return; }
    if (!canDoAction('change_pw', 10000)) { setError(t('auth.tooFast')); return; }

    setIsSubmitting(true);
    try {
      const { error: reAuthError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
      if (reAuthError) {
        setError(t('password.wrongCurrent'));
        setIsSubmitting(false);
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        if (updateError.message?.toLowerCase().includes('weak')) setError(t('password.weak'));
        else { console.warn('Password change failed:', updateError.message); setError(t('password.changeFailed')); }
        setIsSubmitting(false);
        return;
      }
      setSuccess(t('password.changed'));
      setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword('');
      setTimeout(() => onClose(), 2000);
    } catch (e) {
      console.warn('Password change failed:', e.message);
      setError(t('password.changeFailed'));
    }
    setIsSubmitting(false);
  };

  const CheckRow = ({ ok, label }) => (
    <div className={`flex items-center gap-1.5 text-xs ${ok ? 'text-green-400' : 'text-slate-500'}`}>
      <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 ${ok ? 'bg-green-500' : 'bg-slate-600'}`}>
        {ok && <Check size={9} className="text-white" />}
      </div>
      {label}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`${theme.modal} rounded-2xl p-5 w-full max-w-md border border-slate-600`} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-teal-400 flex items-center gap-2"><KeyRound size={20} />{t('settings.changePassword')}</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        {error && <div className="bg-red-600 rounded-xl p-3 mb-4 text-white text-sm text-center">{error}</div>}
        {success && <div className="bg-green-600 rounded-xl p-3 mb-4 text-white text-sm text-center">{success}</div>}
        <div className="space-y-4">
          <div>
            <label className={`text-sm ${theme.textMuted} block mb-1`}>{t('password.current')}</label>
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder={t('password.currentPlaceholder')} className={`w-full ${theme.input} rounded-xl p-3 outline-none border ${theme.text}`} />
          </div>
          <div>
            <label className={`text-sm ${theme.textMuted} block mb-1`}>{t('password.new')}</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder={t('password.newPlaceholder')} className={`w-full ${theme.input} rounded-xl p-3 outline-none border ${theme.text}`} />
            {newPassword && (
              <div className="mt-2 grid grid-cols-2 gap-1">
                <CheckRow ok={pwChecks.length} label={t('password.check8chars')} />
                <CheckRow ok={pwChecks.upper}  label={t('password.checkUpper')} />
                <CheckRow ok={pwChecks.lower}  label={t('password.checkLower')} />
                <CheckRow ok={pwChecks.number} label={t('password.checkNumber')} />
              </div>
            )}
          </div>
          <div>
            <label className={`text-sm ${theme.textMuted} block mb-1`}>{t('password.confirm')}</label>
            <input type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} placeholder={t('password.confirmPlaceholder')} className={`w-full ${theme.input} rounded-xl p-3 outline-none border ${theme.text}`} />
            {newPassword && confirmNewPassword && newPassword !== confirmNewPassword && <p className="text-xs text-red-400 mt-1">{t('password.mismatch')}</p>}
            {newPassword && confirmNewPassword && newPassword === confirmNewPassword && <p className="text-xs text-green-400 mt-1">{t('password.match')}</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className={`flex-1 py-2.5 rounded-xl ${theme.input} border ${theme.text}`}>{t('pomodoro.cancel')}</button>
            <button
              onClick={handleChangePassword}
              disabled={isSubmitting || !currentPassword || !pwStrong || !confirmNewPassword}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 font-bold text-white disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 size={20} className="animate-spin mx-auto" /> : t('password.changeButton')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
