/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{tsx,ts}'],
  theme: {
    extend: {
      colors: {
        elder: {
          bg:      '#0A1628',
          surface: '#112240',
          gold:    '#F0A500',
          text:    '#FFFFFF',
          muted:   '#C8D2F0',   // 提升至 ~10.5:1 对比度 (原 #A8B2D1 仅 6.5:1)
          danger:  '#FF6B6B',
          success: '#7EC8A0',   // 柔和成功绿
        },
      },
      fontSize: {
        'elder':    '1.5rem',    // 24px
        'elder-lg': '2rem',      // 32px
        'elder-xl': '2.5rem',    // 40px
      },
      spacing: {
        'elder-btn': '7.5rem',   // 120px
      },
      fontFamily: {
        elder: [
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          '"Noto Sans SC"',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
