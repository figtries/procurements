import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // Lets <ViewTransition> crossfade the page, list and tab swaps below.
    viewTransition: true,
  },
};

export default nextConfig;
