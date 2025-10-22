
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
    // En el entorno del servidor, no queremos empaquetar 'ssh2'
    if (isServer) {
      config.externals.push('ssh2');
    }
    return config;
  },
};

export default nextConfig;
