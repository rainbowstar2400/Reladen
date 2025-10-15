import withPWA from 'next-pwa';

const isDev = process.env.NODE_ENV !== 'production';

const withPwa = withPWA({
  dest: 'public',
  disable: isDev,
});

const nextConfig = {
  eslint: {
    dirs: ['app', 'components', 'lib'],
  },
  reactStrictMode: true,
  transpilePackages: ['drizzle-orm'],
};

export default withPwa(nextConfig);
