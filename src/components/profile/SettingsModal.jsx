import React, { useState } from 'react';
import { Settings, X, ChevronRight, Palette, Edit3, KeyRound, Trash, ShieldCheck, Heart, Globe, Check, Bell, BellOff, Target, Timer } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useLanguage } from '../../i18n';
import { themes } from '../../constants/themes';
import { applyNotificationSetting } from '../../utils/notifications';

const isNative = Capacitor.isNativePlatform();

export default function SettingsModal({ theme, themeKey, changeTheme, onClose, openEditProfile, openDeleteConfirm, handleLogout, isPasswordUser, weekStart, setWeekStart, notifications, setNotifications, healthTips, setHealthTips, liveActivity, setLiveActivity, dailyGoalMins, setDailyGoalMins }) {
  const { t, lang, setLang } = useLanguage();
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);

  const LANGUAGES = [
    { id: 'tr', flag: '🇹🇷', name: 'Türkçe'    },
    { id: 'en', flag: '🇬🇧', name: 'English'    },
    { id: 'es', flag: '🇪🇸', name: 'Español'    },
    { id: 'fr', flag: '🇫🇷', name: 'Français'   },
    { id: 'de', flag: '🇩🇪', name: 'Deutsch'    },
    { id: 'pt', flag: '🇧🇷', name: 'Português'  },
    { id: 'ja', flag: '🇯🇵', name: '日本語'      },
    { id: 'ko', flag: '🇰🇷', name: '한국어'      },
    { id: 'zh', flag: '🇨🇳', name: '中文'        },
    { id: 'ru', flag: '🇷🇺', name: 'Русский'    },
    { id: 'hi', flag: '🇮🇳', name: 'हिन्दी'     },
  ];

  const currentLang = LANGUAGES.find(l => l.id === lang) || LANGUAGES[1];

  const selectLang = (id) => {
    setLang(id);
    localStorage.setItem('swim_language', id);
    setShowLangPicker(false);
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`${theme.modal} rounded-2xl p-5 w-full max-w-md border border-slate-600 max-h-[80vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-teal-400"><Settings size={20} className="inline mr-1" />{t('settings.title')}</h3><button onClick={onClose}><X size={20} /></button></div>
        <div className="space-y-3">
          <div className={`${theme.input} rounded-xl border overflow-hidden`}>
            <button onClick={() => setShowAccountMenu(!showAccountMenu)} className={`w-full flex justify-between items-center p-3 ${theme.text}`}>
              <span className="text-sm flex items-center gap-2"><ShieldCheck size={16} className="text-cyan-400" />{t('settings.account')}</span>
              <ChevronRight size={16} className={`${theme.textMuted} transition-transform ${showAccountMenu ? 'rotate-90' : ''}`} />
            </button>
            {showAccountMenu && (
              <div className="border-t border-slate-600/50">
                <button onClick={openEditProfile} className={`w-full flex justify-between items-center p-3 ${theme.text} hover:opacity-80 transition-opacity`}><span className="text-sm flex items-center gap-2"><Edit3 size={16} className="text-teal-400" />{t('settings.editProfile')}</span><ChevronRight size={16} className={theme.textMuted} /></button>
                {isPasswordUser && <button onClick={openChangePassword} className={`w-full flex justify-between items-center p-3 border-t border-slate-600/50 ${theme.text} hover:opacity-80 transition-opacity`}><span className="text-sm flex items-center gap-2"><KeyRound size={16} className="text-teal-400" />{t('settings.changePassword')}</span><ChevronRight size={16} className={theme.textMuted} /></button>}
                <button onClick={openDeleteConfirm} className="w-full flex justify-between items-center p-3 border-t border-slate-600/50 text-red-400 hover:opacity-80 transition-opacity"><span className="text-sm flex items-center gap-2"><Trash size={16} />{t('settings.deleteAccount')}</span><ChevronRight size={16} /></button>
              </div>
            )}
          </div>

          <div className={`p-3 ${theme.input} rounded-xl border`}>
            <span className="text-sm flex items-center gap-2 mb-2"><Palette size={16} className="text-teal-400" />{t('settings.theme')}</span>
            <div className="flex gap-2">
              {Object.entries(themes).map(([k]) => (
                <button key={k} onClick={() => changeTheme(k)} className={`flex-1 py-2 rounded-lg text-xs ${themeKey === k ? 'bg-teal-600 text-white' : `${theme.card} border ${theme.text}`}`}>{t(`settings.theme_${k}`)}</button>
              ))}
            </div>
          </div>

          {/* Dil seçici butonu */}
          <button
            onClick={() => setShowLangPicker(true)}
            className={`w-full p-3 ${theme.input} rounded-xl border flex justify-between items-center`}
          >
            <span className="text-sm flex items-center gap-2">
              <Globe size={16} className="text-teal-400" />
              {t('settings.language')}
            </span>
            <span className="flex items-center gap-2">
              <span className="text-sm">{currentLang.flag} {currentLang.name}</span>
              <ChevronRight size={16} className={theme.textMuted} />
            </span>
          </button>

          <div className={`p-3 ${theme.input} rounded-xl border`}>
            <span className="text-sm flex items-center gap-2 mb-2">{t('settings.weekStart')}</span>
            <div className="flex gap-2">
              {[{ v: 1, l: t('settings.weekStartMon') }, { v: 0, l: t('settings.weekStartSun') }].map(o => (
                <button key={o.v} onClick={() => setWeekStart(o.v)} className={`flex-1 py-2 rounded-lg text-xs ${weekStart === o.v ? 'bg-teal-600 text-white' : `${theme.card} border ${theme.text}`}`}>{o.l}</button>
              ))}
            </div>
          </div>

          {/* Günlük hedef */}
          {typeof setDailyGoalMins === 'function' && (
            <div className={`p-3 ${theme.input} rounded-xl border`}>
              <span className="text-sm flex items-center gap-2 mb-2">
                <Target size={16} className={dailyGoalMins ? 'text-teal-400' : theme.textMuted} />
                {t('goal.title')}
              </span>
              <div className="flex gap-1.5">
                {[0, 60, 120, 180, 240, 360].map(mins => (
                  <button
                    key={mins}
                    onClick={() => {
                      setDailyGoalMins(mins);
                      try { localStorage.setItem('swim_daily_goal', String(mins)); } catch (_) {}
                    }}
                    className={`flex-1 py-2 rounded-lg text-xs ${
                      dailyGoalMins === mins ? 'bg-teal-600 text-white' : `${theme.card} border ${theme.text}`
                    }`}
                  >
                    {mins === 0 ? t('goal.off') : `${mins / 60}${t('time.h')}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bildirimler toggle */}
          {typeof setNotifications === 'function' && (
            <button
              onClick={async () => {
                const next = !notifications;
                await applyNotificationSetting(next);
                setNotifications(next);
              }}
              className={`w-full p-3 ${theme.input} rounded-xl border flex justify-between items-center`}
            >
              <span className="text-sm flex items-center gap-2">
                {notifications
                  ? <Bell size={16} className="text-teal-400" />
                  : <BellOff size={16} className={theme.textMuted} />}
                {t('settings.notifications')}
              </span>
              <span className={`text-xs px-3 py-1 rounded-full ${notifications ? 'bg-teal-600 text-white' : `${theme.card} ${theme.textMuted}`}`}>
                {notifications ? t('settings.on') : t('settings.off')}
              </span>
            </button>
          )}

          {/* Canlı sayaç bildirimi toggle (üstteki kalıcı süre bildirimi) */}
          {isNative && typeof setLiveActivity === 'function' && (
            <button
              onClick={() => {
                const next = !liveActivity;
                setLiveActivity(next);
                try { localStorage.setItem('swim_live_activity', String(next)); } catch (_) {}
              }}
              className={`w-full p-3 ${theme.input} rounded-xl border flex justify-between items-center`}
            >
              <span className="text-sm flex items-center gap-2">
                <Timer size={16} className={liveActivity ? 'text-teal-400' : theme.textMuted} />
                {t('settings.liveActivity')}
              </span>
              <span className={`text-xs px-3 py-1 rounded-full ${liveActivity ? 'bg-teal-600 text-white' : `${theme.card} ${theme.textMuted}`}`}>
                {liveActivity ? t('settings.on') : t('settings.off')}
              </span>
            </button>
          )}

          {/* Sağlık tavsiyeleri toggle */}
          {typeof setHealthTips === 'function' && (
            <button
              onClick={() => {
                const next = !healthTips;
                setHealthTips(next);
                try { localStorage.setItem('swim_health_tips', String(next)); } catch (_) {}
              }}
              className={`w-full p-3 ${theme.input} rounded-xl border flex justify-between items-center`}
            >
              <span className="text-sm flex items-center gap-2">
                <Heart size={16} className={healthTips ? 'text-pink-400' : theme.textMuted} />
                {t('settings.healthTips')}
              </span>
              <span className={`text-xs px-3 py-1 rounded-full ${healthTips ? 'bg-teal-600 text-white' : `${theme.card} ${theme.textMuted}`}`}>
                {healthTips ? t('settings.on') : t('settings.off')}
              </span>
            </button>
          )}

        </div>
      </div>

      {/* Dil seçici — bottom sheet */}
      {showLangPicker && (
        <div className="fixed inset-0 bg-black/80 z-60 flex items-end justify-center" onClick={() => setShowLangPicker(false)}>
          <div className={`${theme.modal} rounded-t-2xl w-full max-w-md border border-slate-600 border-b-0`} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-slate-700">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <Globe size={16} className="text-teal-400" />
                {t('settings.language')}
              </h4>
              <button onClick={() => setShowLangPicker(false)}><X size={18} /></button>
            </div>
            <div className="overflow-y-auto max-h-[60vh] pb-6">
              {LANGUAGES.map(l => (
                <button
                  key={l.id}
                  onClick={() => selectLang(l.id)}
                  className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors ${lang === l.id ? 'bg-teal-600/20' : 'hover:opacity-80'}`}
                >
                  <span className="flex items-center gap-3 text-sm">
                    <span className="text-xl">{l.flag}</span>
                    <span className={lang === l.id ? 'text-teal-400 font-semibold' : theme.text}>{l.name}</span>
                  </span>
                  {lang === l.id && <Check size={16} className="text-teal-400" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
