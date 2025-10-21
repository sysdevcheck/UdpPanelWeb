import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
   webpack: (config, { isServer }) => {
    // This is a workaround for a build issue with the 'ssh2' library and its dependencies.
    // It prevents Next.js from trying to bundle certain dynamic requires.
    // The main fix is handled by 'patch-package'.
    if (isServer) {
      config.externals.push('ssh2');
    }
    return config;
  },
};

export default nextConfig;
