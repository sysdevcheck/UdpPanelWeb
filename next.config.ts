
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
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
  env: {
    NEXT_PUBLIC_OWNER_USERNAME: process.env.OWNER_USERNAME,
    NEXT_PUBLIC_OWNER_PASSWORD: process.env.OWNER_PASSWORD,
  },
   webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...config.externals, 'ssh2'];
    }
    return config;
  },
};

export default nextConfig;
