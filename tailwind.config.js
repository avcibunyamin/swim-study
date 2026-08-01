/** @type {import('tailwindcss').Config} */

// Vurgu renkleri (teal / cyan / emerald) sabit değer yerine CSS değişkeninden
// okunur. Böylece index.css'teki bir tema geçişi, bileşenlere dağılmış 130+
// sabit renk sınıfını tek noktadan yeniden renklendirir — JSX'e dokunmadan.
//
// <alpha-value> Tailwind'in opaklık sözdizimini korur: bg-teal-500/25 gibi
// kullanımlar değişkenle de doğru çalışır.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        teal: {
          300: v('c-teal-300'),
          400: v('c-teal-400'),
          500: v('c-teal-500'),
          600: v('c-teal-600'),
          900: v('c-teal-900'),
        },
        cyan: {
          300: v('c-cyan-300'),
          400: v('c-cyan-400'),
          500: v('c-cyan-500'),
          600: v('c-cyan-600'),
        },
        emerald: {
          300: v('c-emerald-300'),
          400: v('c-emerald-400'),
          500: v('c-emerald-500'),
          600: v('c-emerald-600'),
          900: v('c-emerald-900'),
        },
      },
    },
  },
  plugins: [],
}
