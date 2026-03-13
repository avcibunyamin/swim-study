import React, { useState } from 'react';
import { Settings, X, ChevronRight, Palette, Eye, LogOut, Edit3, KeyRound, Trash, ShieldCheck } from 'lucide-react';
import { supabase } from '../../supabase';
import { Capacitor } from '@capacitor/core';
import { useLanguage } from '../../i18n';
import { themes } from '../../constants/themes';

const isNative = Capacitor.isNativePlatform();

export default function SettingsModal({ theme, user, themeKey, changeTheme, showStudyTime, setShowStudyTime, onClose, openEditProfile, openChangePassword, openDeleteConfirm, handleLogout, isOnline, isPasswordUser }) {
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

          <div className={`flex justify-between items-center p-3 ${theme.input} rounded-xl border`}>
            <span className="text-sm"><Eye size={16} className="inline mr-2 text-teal-400" />{t('settings.showStudyTime')}</span>
            <button onClick={() => { const v = !showStudyTime; setShowStudyTime(v); if (isOnline) supabase.from('users').update({ show_study_time: v }).eq('id', user.id).then(() => {}).catch(e => console.warn('Toggle failed:', e.message)); }} className={`w-12 h-6 rounded-full ${showStudyTime ? 'bg-teal-600' : 'bg-slate-600'}`}><div className={`w-5 h-5 bg-white rounded-full transition-transform ${showStudyTime ? 'translate-x-6' : 'translate-x-0.5'}`} /></button>
          </div>

          <button onClick={handleLogout} className={`w-full py-3 ${theme.input} rounded-xl border ${theme.text}`}><LogOut size={16} className="inline mr-2" />{t('settings.logout')}</button>
        </div>
      </div>
    </div>
  );
}
