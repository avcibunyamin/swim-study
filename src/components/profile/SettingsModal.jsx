import React, { useState } from 'react';
import { Settings, X, ChevronRight, Palette, Edit3, KeyRound, Trash, ShieldCheck } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useLanguage } from '../../i18n';
import { themes } from '../../constants/themes';

const isNative = Capacitor.isNativePlatform();

export default function SettingsModal({ theme, themeKey, changeTheme, onClose, openEditProfile, openDeleteConfirm, handleLogout, isPasswordUser, weekStart, setWeekStart }) {
  const { t, lang, setLang } = useLanguage();
  const [showAccountMenu, setShowAccountMenu] = useState(false);

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

          <div className={`p-3 ${theme.input} rounded-xl border`}>
            <span className="text-sm flex items-center gap-2 mb-2">{t('settings.language')}</span>
            <div className="flex gap-2">
              {[{ id: 'tr', l: 'Türkçe' }, { id: 'en', l: 'English' }].map(l => (
                <button key={l.id} onClick={() => setLang(l.id)} className={`flex-1 py-2 rounded-lg text-xs ${lang === l.id ? 'bg-teal-600 text-white' : `${theme.card} border ${theme.text}`}`}>{l.l}</button>
              ))}
            </div>
          </div>

          <div className={`p-3 ${theme.input} rounded-xl border`}>
            <span className="text-sm flex items-center gap-2 mb-2">{t('settings.weekStart')}</span>
            <div className="flex gap-2">
              {[{ v: 1, l: t('settings.weekStartMon') }, { v: 0, l: t('settings.weekStartSun') }].map(o => (
                <button key={o.v} onClick={() => setWeekStart(o.v)} className={`flex-1 py-2 rounded-lg text-xs ${weekStart === o.v ? 'bg-teal-600 text-white' : `${theme.card} border ${theme.text}`}`}>{o.l}</button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
