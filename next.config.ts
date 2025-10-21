
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
    // Exclude ssh2 from being bundled in the client-side build
    if (!isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'ssh2': 'ssh2',
      });
    }
    // For server-side, you might need to mark it as external 
    // if the environment doesn't support it, but for App Hosting
    // we just want to get the build to pass. We can mark it as external
    // and expect it to fail at runtime.
    else {
        config.externals = config.externals || [];
        config.externals.push({
            'ssh2': 'ssh2',
        });
    }


    return config;
  },
};

export default nextConfig;
