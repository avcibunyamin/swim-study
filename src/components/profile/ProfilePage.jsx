import React, { useState } from 'react';
import { Settings, Trophy, Info, WifiOff } from 'lucide-react';
import { supabase } from '../../supabase';
import { useLanguage } from '../../i18n';
import { fmtSecs } from '../../utils/formatters';
import { sanitizeInput } from '../../utils/sanitize';
import { achievements } from '../../constants/achievements';
import { avatarOptions } from '../../constants/avatarOptions';
import Logo from '../ui/Logo';
import SettingsModal from './SettingsModal';
import EditProfileModal from './EditProfileModal';
import ChangePasswordModal from './ChangePasswordModal';

export default function ProfilePage({ theme, pagePadding, navPosition, changeNavPosition, user, userData, setUserData, totalStudySecs, currentAchievement, aboutMe, setAboutMe, showStudyTime, setShowStudyTime, themeKey, changeTheme, notifications, setNotifications, showSettings, setShowSettings, showEditProfile, setShowEditProfile, showDeleteConfirm, setShowDeleteConfirm, handleLogout, handleDeleteAccount, isOnline, deletePassword, setDeletePassword }) {
  const { t, ta } = useLanguage();
  const [localAbout, setLocalAbout] = useState(aboutMe);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const isPasswordUser = user.app_metadata?.provider === 'email';
  const achievementTitles = ta('achievementTitles') || [];

  const handleAboutBlur = async () => {
    if (localAbout !== aboutMe) {
      setAboutMe(localAbout);
      if (isOnline) try { await supabase.from('users').update({ about_me: sanitizeInput(localAbout, 200) }).eq('id', user.id); } catch (e) { console.warn('About update failed:', e.message); }
    }
  };

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} ${pagePadding} relative`}>
      <button onClick={() => setShowSettings(true)} className={`absolute ${navPosition === 'top' ? 'top-16' : 'top-4'} ${navPosition === 'right' ? 'right-20' : 'right-4'} p-2 ${theme.input} rounded-xl border z-10`}><Settings size={20} className="text-teal-400" /></button>
      <div className="text-center py-2"><Logo size="sm" centered /></div>
      {!isOnline && <div className="bg-yellow-600 rounded-xl p-2 mb-4 text-white text-sm text-center flex items-center justify-center gap-2"><WifiOff size={16} />{t('auth.offline')}</div>}
      <div className="flex flex-col items-center mb-6">
        <span className="text-6xl mb-2">{userData?.avatar || '🐟'}</span>
        <h2 className="text-xl font-bold">@{userData?.username}</h2>
        {userData?.full_name && <p className={`${theme.text} text-sm`}>{userData.full_name}</p>}
        <p className={`${theme.textMuted} text-sm`}>{userData?.email}</p>
        <div className={`mt-2 px-3 py-1 rounded-full bg-gradient-to-r ${currentAchievement.color}`}>
          <span className="text-white text-sm font-bold">{currentAchievement.icon} {currentAchievement.title}</span>
        </div>
        <p className={`text-sm ${theme.textMuted} mt-1`}>{fmtSecs(totalStudySecs, t)}</p>
      </div>

      <div className={`${theme.card} rounded-xl p-4 mb-4 border`}>
        <h3 className="font-bold text-teal-400 mb-3 flex items-center gap-2"><Trophy size={18} />{t('profile.titles')}</h3>
        <div className="grid grid-cols-5 gap-2">
          {achievements.filter(a => a.hours > 0).map((a, idx) => {
            const earned = totalStudySecs / 3600 >= a.hours;
            const title = achievementTitles[idx + 1] || a.title;
            return (
              <div key={a.hours} className={`text-center p-2 rounded-lg ${earned ? `bg-gradient-to-br ${a.color}` : `${theme.input} opacity-40 border`}`}>
                <span className="text-2xl">{a.icon}</span>
                <p className="text-[9px] mt-1 font-bold">{title}</p>
                <p className="text-[8px] opacity-80">{a.hours}{t('time.h')}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`${theme.card} rounded-xl p-4 mb-4 border`}>
        <h3 className="font-bold text-teal-400 mb-2"><Info size={16} className="inline mr-1" />{t('profile.about')}</h3>
        <textarea value={localAbout} onChange={e => setLocalAbout(e.target.value)} onBlur={handleAboutBlur} maxLength={200} placeholder={t('profile.aboutPlaceholder')} className={`w-full ${theme.input} rounded-lg p-3 text-sm resize-none h-20 outline-none border ${theme.text}`} />
        <p className={`text-xs ${theme.textMuted} text-right`}>{localAbout.length}/200</p>
      </div>

      <div className={`${theme.card} rounded-xl p-4 border`}>
        <h3 className="font-bold text-teal-400 mb-3">{t('profile.avatar')}</h3>
        <div className="flex flex-wrap gap-2 justify-center max-h-40 overflow-y-auto">
          {avatarOptions.map(a => (
            <button key={a} onClick={() => { if (isOnline) { supabase.from('users').update({ avatar: a }).eq('id', user.id).then(() => {}).catch(e => console.warn('Avatar update failed:', e.message)); setUserData({ ...userData, avatar: a }); }}} className={`text-2xl p-2 rounded-lg ${userData?.avatar === a ? 'bg-teal-600 ring-2 ring-teal-400 scale-110' : `${theme.input} border`}`}>
              {a}
            </button>
          ))}
        </div>
      </div>

      {showSettings && <SettingsModal theme={theme} user={user} themeKey={themeKey} changeTheme={changeTheme} navPosition={navPosition} changeNavPosition={changeNavPosition} showStudyTime={showStudyTime} setShowStudyTime={setShowStudyTime} notifications={notifications} setNotifications={setNotifications} onClose={() => setShowSettings(false)} openEditProfile={() => { setShowSettings(false); setShowEditProfile(true); }} openChangePassword={() => { setShowSettings(false); setShowChangePassword(true); }} openDeleteConfirm={() => { setShowSettings(false); setShowDeleteConfirm(true); }} handleLogout={handleLogout} isOnline={isOnline} isPasswordUser={isPasswordUser} />}
      {showEditProfile && <EditProfileModal theme={theme} user={user} userData={userData} setUserData={setUserData} onClose={() => setShowEditProfile(false)} isOnline={isOnline} />}
      {showChangePassword && <ChangePasswordModal theme={theme} user={user} onClose={() => setShowChangePassword(false)} isOnline={isOnline} />}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className={`${theme.modal} rounded-2xl p-5 w-full max-w-sm border border-red-500/50`}>
            <span className="block text-center mb-2 text-red-400"><svg className="mx-auto" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg></span>
            <h3 className="text-lg font-bold text-center text-red-400 mb-4">{t('profile.deleteAccount')}</h3>
            <p className={`text-center ${theme.textMuted} text-sm mb-4`}>{t('profile.deleteWarning')}</p>
            {isPasswordUser && (
              <div className="mb-4">
                <label className={`text-sm ${theme.textMuted} block mb-2`}>{t('profile.enterPassword')}</label>
                <input type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} placeholder={t('auth.password')} className={`w-full ${theme.input} rounded-xl p-3 outline-none border ${theme.text}`} />
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); }} className={`flex-1 py-2.5 rounded-xl ${theme.input} border ${theme.text}`}>{t('pomodoro.cancel')}</button>
              <button onClick={handleDeleteAccount} disabled={isPasswordUser && !deletePassword} className="flex-1 py-2.5 rounded-xl bg-red-600 font-bold text-white disabled:opacity-50">{t('profile.delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
