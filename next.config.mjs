import withPWA from 'next-pwa';

const nextConfig = {
  reactStrictMode: true
};

export default withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  fallbacks: {
    document: '/offline'
  }
})(nextConfig);
