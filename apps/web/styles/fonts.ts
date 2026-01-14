import { Inter, M_PLUS_Rounded_1c } from 'next/font/google';

export const fontSans = Inter({ subsets: ['latin'], variable: '--font-sans' });
export const fontRounded = M_PLUS_Rounded_1c({
  subsets: ['latin', 'japanese'],
  weight: ['400', '500', '700'],
  variable: '--font-rounded',
});
