import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, XCircle, AlertTriangle, WifiOff } from 'lucide-react';
import { supabase } from '../../supabase';
import { useLanguage } from '../../i18n';
import { sanitizeInput } from '../../utils/sanitize';
import { canDoAction } from '../../utils/rateLimit';
import { THEME_IDS } from '../../constants/themes';
import Logo from '../ui/Logo';

const withTimeout = (promise, ms = 15000) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);

export default function AuthScreen() {
  const { t } = useLanguage();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [authMode, setAuthMode] = useState('login');
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState(''), [fullName, setFullName] = useState(''), [usernameStatus, setUsernameStatus] = useState(null);
  const [resetEmail, setResetEmail] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, []);

  // Kullanıcı adı müsaitlik kontrolü
  useEffect(() => {
    if (username.length < 3) { setUsernameStatus(null); return; }
    const timer = setTimeout(async () => {
      setUsernameStatus('checking');
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('username', username.toLowerCase())
          .maybeSingle();
        if (error) throw error;
        setUsernameStatus(data ? 'taken' : 'available');
      } catch (e) { console.warn('Username check failed:', e.message); setUsernameStatus(null); }
    }, 500);
    return () => clearTimeout(timer);
  }, [username]);

  const handleRegister = async e => {
    e.preventDefault();
    if (usernameStatus === 'taken' || !isOnline) return;
    if (!ageConfirmed) { setAuthError(t('auth.ageRequired')); return; }
    if (password !== confirmPassword) { setAuthError(t('auth.passwordMismatch')); return; }
    if (!canDoAction('register', 10000)) { setAuthError(t('auth.tooFast')); return; }
    setIsSubmitting(true);
    try {
      setAuthError('');
      const savedTheme = localStorage.getItem('swim_theme') || 'ocean';
      const cleanEmail = sanitizeInput(email, 100);
      const cleanUsername = sanitizeInput(username, 20).toLowerCase();
      const cleanFullName = sanitizeInput(fullName, 30);

      const { data: signUpData, error } = await withTimeout(
        supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              username: cleanUsername,
              full_name: cleanFullName,
              display_name: cleanUsername,
              theme: savedTheme,
            }
          }
        })
      );
      if (error) throw error;

      // users tablosuna profil satırı ekle (trigger zaten çalıştırıyor, bu fallback)
      if (signUpData?.user) {
        await supabase.from('users').upsert({
          id: signUpData.user.id,
          email: cleanEmail,
          username: cleanUsername,
          full_name: cleanFullName,
          display_name: cleanUsername,
          theme_id: THEME_IDS[savedTheme] || 2,
          status_id: 1,
          is_online: false,
          total_study_secs: 0,
          plans: [],
          about_me: '',
          show_study_time: true,
        }, { onConflict: 'id' }).then(undefined, () => {});
      }

      await supabase.auth.signOut();
      setNeedsVerification(true);
      setAuthMessage(t('auth.verifyLink'));
    } catch (e) {
      console.warn('Register failed:', e.message);
      if (e.message === 'timeout') setAuthError('Bağlantı zaman aşımına uğradı, tekrar dene');
      else if (e.message?.includes('already registered') || e.message?.includes('already been registered')) setAuthError(t('auth.emailInUse'));
      else if (e.message?.includes('Password should be')) setAuthError(t('auth.weakPassword'));
      else if (e.message?.includes('Invalid email')) setAuthError('Geçersiz email adresi');
      else if (e.message?.includes('rate limit') || e.message?.includes('too many') || e.message?.includes('For security purposes')) setAuthError('E-posta gönderme limiti doldu. Birkaç dakika bekleyip tekrar dene veya spam klasörünü kontrol et.');
      else if (e.message?.includes('network') || e.message?.includes('fetch')) setAuthError('İnternet bağlantısı yok');
      else setAuthError(t('auth.registerFailed') + ' (' + e.message + ')');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async e => {
    e.preventDefault();
    if (!isOnline) { setAuthError(t('auth.noInternet')); return; }
    if (!canDoAction('login', 3000)) { setAuthError(t('auth.tooFast')); return; }
    setIsSubmitting(true);
    try {
      setAuthError('');
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password })
      );
      if (error) throw error;
      if (data.user && !data.user.email_confirmed_at) {
        setNeedsVerification(true);
        setAuthError(t('auth.verifyEmail'));
        await supabase.auth.resend({ type: 'signup', email }).catch(() => {});
        await supabase.auth.signOut();
      }
    } catch (e) {
      console.warn('Login failed:', e.message);
      if (e.message === 'timeout') setAuthError('Bağlantı zaman aşımına uğradı, tekrar dene');
      else if (e.message?.includes('Invalid login credentials')) setAuthError(t('auth.loginFailed'));
      else if (e.message?.includes('Email not confirmed')) { setNeedsVerification(true); setAuthError(t('auth.verifyEmail')); }
      else setAuthError(t('auth.loginFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!isOnline) { setAuthError(t('auth.noInternet')); return; }
    if (!canDoAction('login', 3000)) { setAuthError(t('auth.tooFast')); return; }
    setIsSubmitting(true);
    try {
      const { error } = await withTimeout(
        supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin }
        }),
        30000
      );
      if (error) throw error;
    } catch (e) {
      console.warn('Google sign-in failed:', e.message);
      if (e.message === 'timeout') setAuthError('Bağlantı zaman aşımına uğradı, tekrar dene');
      else setAuthError(t('auth.googleFailed'));
      setIsSubmitting(false);
    }
    // Başarılı olursa redirect olduğu için setIsSubmitting(false) çağrılmaz
  };

  const handleForgotPassword = async () => {
    if (!resetEmail.trim()) { setAuthError(t('auth.emailError')); return; }
    if (!isOnline) { setAuthError(t('auth.noInternet')); return; }
    if (!canDoAction('reset_pw', 10000)) { setAuthError(t('auth.tooFast')); return; }
    setIsSubmitting(true);
    try {
      const { error } = await withTimeout(
        supabase.auth.resetPasswordForEmail(resetEmail, { redirectTo: window.location.origin })
      );
      if (error) throw error;
      setAuthMessage(t('auth.resetSent'));
      setShowForgotPassword(false);
      setResetEmail('');
    } catch (e) {
      console.warn('Password reset failed:', e.message);
      if (e.message === 'timeout') setAuthError('Bağlantı zaman aşımına uğradı, tekrar dene');
      else setAuthError(t('auth.emailNotFound'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8"><Logo size="lg" centered /></div>
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h2 className="text-xl font-bold text-white mb-4">{t('auth.forgotPassword')}</h2>
            {authError && <div className="bg-red-600 rounded-xl p-3 mb-4 text-white text-sm text-center">{authError}</div>}
            <p className="text-gray-500 text-sm mb-4">{t('auth.forgotDesc')}</p>
            <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} className="w-full bg-gray-800 rounded-xl p-3 text-white border border-gray-700 focus:border-teal-500 outline-none mb-4" placeholder={t('auth.email')} />
            <button onClick={handleForgotPassword} disabled={isSubmitting} className="w-full py-3 bg-gradient-to-r from-teal-600 to-cyan-600 rounded-xl font-bold text-white disabled:opacity-50 mb-3">
              {isSubmitting ? <Loader2 size={20} className="animate-spin mx-auto" /> : t('auth.sendLink')}
            </button>
            <button onClick={() => { setShowForgotPassword(false); setAuthError(''); }} className="w-full py-3 bg-gray-800 rounded-xl text-white">{t('auth.goBack')}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8"><Logo size="lg" centered /><p className="text-teal-300 text-sm mt-2">{t('auth.subtitle')}</p></div>
        {!isOnline && <div className="bg-yellow-600 rounded-xl p-3 mb-4 text-white text-sm text-center flex items-center justify-center gap-2"><WifiOff size={18} />{t('auth.offline')}</div>}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          {needsVerification && <div className="bg-yellow-600 rounded-xl p-4 mb-4"><p className="text-white text-sm flex items-center gap-2"><AlertTriangle size={18} />{t('auth.verifyEmail')}</p></div>}
          <div className="space-y-3 mb-6">
            <button onClick={handleGoogleSignIn} disabled={isSubmitting || !isOnline} className="w-full py-3 bg-white rounded-xl font-bold text-slate-800 flex items-center justify-center gap-2 disabled:opacity-50">
              <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              {t('auth.googleLogin')}
            </button>
          </div>
          <div className="flex items-center gap-3 mb-6"><div className="flex-1 h-px bg-gray-700" /><span className="text-gray-500 text-sm">{t('auth.or')}</span><div className="flex-1 h-px bg-gray-700" /></div>
          <div className="flex mb-6">
            <button onClick={() => { setAuthMode('login'); setAuthError(''); setAuthMessage(''); setNeedsVerification(false); }} className={`flex-1 py-2.5 rounded-l-xl font-bold ${authMode === 'login' ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white' : 'bg-gray-800 text-gray-500'}`}>{t('auth.login')}</button>
            <button onClick={() => { setAuthMode('register'); setAuthError(''); setAuthMessage(''); setNeedsVerification(false); }} className={`flex-1 py-2.5 rounded-r-xl font-bold ${authMode === 'register' ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white' : 'bg-gray-800 text-gray-500'}`}>{t('auth.register')}</button>
          </div>
          {authError && <div className="bg-red-600 rounded-xl p-3 mb-4 text-white text-sm text-center">{authError}</div>}
          {authMessage && <div className="bg-green-600 rounded-xl p-3 mb-4 text-white text-sm text-center">{authMessage}</div>}
          <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className="space-y-4">
            {authMode === 'register' && (
              <>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full bg-gray-800 rounded-xl p-3 text-white border border-gray-700 focus:border-teal-500 outline-none" placeholder={t('auth.fullName')} maxLength={30} />
                <div className="relative">
                  <input type="text" value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} className="w-full bg-gray-800 rounded-xl p-3 text-white border border-gray-700 focus:border-teal-500 outline-none pr-10" placeholder={t('auth.username')} minLength={3} maxLength={20} required />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {usernameStatus === 'checking' && <Loader2 size={18} className="animate-spin text-gray-500" />}
                    {usernameStatus === 'available' && <CheckCircle size={18} className="text-green-400" />}
                    {usernameStatus === 'taken' && <XCircle size={18} className="text-red-400" />}
                  </div>
                </div>
              </>
            )}
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-gray-800 rounded-xl p-3 text-white border border-gray-700 focus:border-teal-500 outline-none" placeholder={t('auth.email')} required />
            <div>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-gray-800 rounded-xl p-3 text-white border border-gray-700 focus:border-teal-500 outline-none" placeholder={t('auth.password')} minLength={8} required />
              {authMode === 'register' && <p className="text-gray-500 text-xs mt-1 ml-1">En az 8 karakter, büyük/küçük harf ve rakam içermeli</p>}
            </div>
            {authMode === 'register' && <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full bg-gray-800 rounded-xl p-3 text-white border border-gray-700 focus:border-teal-500 outline-none" placeholder={t('auth.confirmPassword')} minLength={8} required />}
            {authMode === 'register' && (
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={ageConfirmed} onChange={e => setAgeConfirmed(e.target.checked)} className="mt-1 shrink-0 accent-teal-500" />
                <span className="text-gray-300 text-xs leading-relaxed">
                  {t('auth.ageConfirmPrefix')}
                  <a href="/terms-of-service.html" target="_blank" rel="noopener noreferrer" className="text-teal-400 underline">{t('auth.terms')}</a>
                  {t('auth.ageConfirmMid')}
                  <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer" className="text-teal-400 underline">{t('auth.privacy')}</a>
                  {t('auth.ageConfirmSuffix')}
                </span>
              </label>
            )}
            {authMode === 'login' && <button type="button" onClick={() => setShowForgotPassword(true)} className="text-teal-400 text-sm hover:underline">{t('auth.forgotLink')}</button>}
            <button type="submit" disabled={(authMode === 'register' && (usernameStatus === 'taken' || usernameStatus === 'checking' || !ageConfirmed || username.length < 3)) || isSubmitting || !isOnline} className="w-full py-3 bg-gradient-to-r from-teal-600 to-cyan-600 rounded-xl font-bold text-white disabled:opacity-50">
              {isSubmitting ? <Loader2 size={20} className="animate-spin mx-auto" /> : authMode === 'login' ? t('auth.loginButton') : t('auth.registerButton')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
