import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // Lets <ViewTransition> crossfade the page, list and tab swaps below.
    viewTransition: true,
  },

  /**
   * Checking the board on a real phone means loading the dev server over the
   * LAN, and `next dev` refuses cross-origin requests for its own assets
   * unless the host is named here. The wildcard covers the last octet so a
   * new DHCP lease does not break it. Development only — `next build` and
   * `next start` ignore this.
   */
  allowedDevOrigins: ['192.168.1.*'],
};

export default nextConfig;
