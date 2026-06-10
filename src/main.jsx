import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { LanguageProvider } from './i18n'
import './index.css'

const SUPPORTED_LANGS = ['tr', 'en', 'es', 'fr', 'de', 'pt', 'ja', 'ko', 'zh', 'ru', 'hi'];
const browserLang = navigator.language?.slice(0, 2);
const savedLang = localStorage.getItem('swim_language')
  || (SUPPORTED_LANGS.includes(browserLang) ? browserLang : 'en');

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('App Error:', error, info); }
  render() {
    if (this.state.hasError) {
      const lang = localStorage.getItem('swim_language') || 'en';
      return (
        <div style={{ padding: 20, color: '#fff', background: '#0f172a', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h2>{lang === 'tr' ? 'Bir hata olu\u015ftu' : 'An error occurred'}</h2>
          <p style={{ color: '#f87171' }}>{this.state.error?.message}</p>
          <button onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
            style={{ marginTop: 16, padding: '10px 20px', background: '#14b8a6', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer' }}>
            {lang === 'tr' ? 'Yeniden Dene' : 'Retry'}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <LanguageProvider initialLang={savedLang}>
        <App />
      </LanguageProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
