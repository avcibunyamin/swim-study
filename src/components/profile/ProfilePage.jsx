import React, { useState } from 'react';
import { Settings, Trophy, WifiOff, Flame } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { fmtSecs } from '../../utils/formatters';
import { achievements } from '../../constants/achievements';
import Logo from '../ui/Logo';
import SettingsModal from './SettingsModal';
import EditProfileModal from './EditProfileModal';

export default function ProfilePage({ theme, pagePadding, navPosition, changeNavPosition, user, userData, setUserData, totalStudySecs, currentAchievement, currentStreak, longestStreak, showStudyTime, setShowStudyTime, themeKey, changeTheme, notifications, setNotifications, healthTips, setHealthTips, liveActivity, setLiveActivity, dailyGoalMins, setDailyGoalMins, showSettings, setShowSettings, showEditProfile, setShowEditProfile, showDeleteConfirm, setShowDeleteConfirm, handleLogout, handleDeleteAccount, isOnline, deletePassword, setDeletePassword, weekStart, setWeekStart }) {
  const { t, ta, lang } = useLanguage();
  const isPasswordUser = false;
  const achievementTitles = ta('achievementTitles') || [];

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} ${pagePadding} relative`}>
      <button aria-label={t('settings.title')} onClick={() => setShowSettings(true)} className={`absolute ${navPosition === 'top' ? 'top-16' : 'top-2'} ${navPosition === 'right' ? 'right-20' : 'right-4'} p-2 ${theme.input} rounded-xl border z-10`}><Settings size={20} className="text-teal-400" /></button>
      <div className="text-center py-2"><Logo size="sm" centered /></div>
      <div className="flex flex-col items-center mb-6">
        <span className="text-6xl mb-2">{userData?.avatar || '🐟'}</span>
        <h2 className="text-xl font-bold">{userData?.full_name || userData?.display_name}</h2>
        <div className={`mt-2 px-3 py-1 rounded-full bg-gradient-to-r ${currentAchievement.color}`}>
          <span className="text-white text-sm font-bold">{currentAchievement.icon} {currentAchievement.title}</span>
        </div>
        <p className={`text-sm ${theme.textMuted} mt-1`}>{fmtSecs(totalStudySecs, t)}</p>
      </div>

      {/* Seri kartı */}
      <div className={`${theme.card} rounded-xl p-4 mb-4 border`}>
        <h3 className="font-bold text-orange-400 mb-3 flex items-center gap-2"><Flame size={18} />{t('streak.title')}</h3>
        {currentStreak === 0 && longestStreak === 0 ? (
          <p className={`text-sm ${theme.textMuted} text-center py-1`}>{t('streak.none')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className={`${theme.input} rounded-xl p-3 text-center border`}>
              <p className="text-3xl font-black text-orange-400">{currentStreak}</p>
              <p className={`text-[10px] ${theme.textMuted} mt-0.5`}>{t('streak.current')} ({t('streak.days')})</p>
            </div>
            <div className={`${theme.input} rounded-xl p-3 text-center border`}>
              <p className="text-3xl font-black text-yellow-400">{longestStreak}</p>
              <p className={`text-[10px] ${theme.textMuted} mt-0.5`}>{t('streak.longest')} ({t('streak.days')})</p>
            </div>
          </div>
        )}
      </div>

      <div className={`${theme.card} rounded-xl p-4 mb-4 border`}>
        <h3 className="font-bold text-teal-400 mb-3 flex items-center gap-2"><Trophy size={18} />{t('profile.titles')}</h3>
        <div className="grid grid-cols-2 gap-2">
          {achievements.filter(a => a.hours > 0).map((a, idx) => {
            const earned = totalStudySecs / 3600 >= a.hours;
            const title = achievementTitles[idx + 1] || a.title;
            return (
              <div key={a.hours} className={`flex items-center gap-2 p-2.5 rounded-lg ${earned ? `bg-gradient-to-br ${a.color}` : `${theme.input} opacity-40 border`}`}>
                <span className="text-2xl">{a.icon}</span>
                <div>
                  <p className="text-xs font-bold">{title}</p>
                  <p className="text-[10px] opacity-80">{a.hours}{t('time.h')}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showSettings && <SettingsModal theme={theme} themeKey={themeKey} changeTheme={changeTheme} onClose={() => setShowSettings(false)} openEditProfile={() => { setShowSettings(false); setShowEditProfile(true); }} openDeleteConfirm={() => { setShowSettings(false); setShowDeleteConfirm(true); }} handleLogout={handleLogout} isPasswordUser={isPasswordUser} weekStart={weekStart} setWeekStart={setWeekStart} notifications={notifications} setNotifications={setNotifications} healthTips={healthTips} setHealthTips={setHealthTips} liveActivity={liveActivity} setLiveActivity={setLiveActivity} dailyGoalMins={dailyGoalMins} setDailyGoalMins={setDailyGoalMins} />}
      {showEditProfile && <EditProfileModal theme={theme} userData={userData} setUserData={setUserData} onClose={() => setShowEditProfile(false)} />}

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
