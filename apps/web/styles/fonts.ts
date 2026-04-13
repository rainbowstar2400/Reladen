import { Inter, Noto_Sans_JP } from 'next/font/google';
import localFont from 'next/font/local';

export const fontSans = Inter({ subsets: ['latin'], variable: '--font-sans' });
export const fontJp = Noto_Sans_JP({
  weight: ['400', '600'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jp',
});
export const fontRounded = localFont({
  src: [{ path: '../public/fonts/KiwiMaru-Regular.woff2', weight: '400', style: 'normal' }],
  display: 'swap',
  fallback: ['var(--font-jp)', 'Hiragino Kaku Gothic ProN', 'Meiryo', 'sans-serif'],
});
