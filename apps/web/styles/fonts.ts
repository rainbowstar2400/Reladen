import { Inter } from 'next/font/google';
import localFont from 'next/font/local';

export const fontSans = Inter({ subsets: ['latin'], variable: '--font-sans' });
export const fontRounded = localFont({
  src: [{ path: '../public/fonts/KiwiMaru-Regular.woff2', weight: '400', style: 'normal' }],
  display: 'swap',
});
