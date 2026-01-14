import { Inter, Noto_Sans_JP } from 'next/font/google';

export const fontSans = Inter({ subsets: ['latin'], variable: '--font-sans' });
export const fontRounded = Noto_Sans_JP({
  subsets: ['latin', 'japanese'],
  weight: ['400', '500', '700'],
  variable: '--font-rounded',
});
