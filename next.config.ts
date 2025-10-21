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
    if (isServer) {
      // This is a workaround for a build issue with the 'ssh2' library and its dependencies.
      // It prevents Next.js from trying to bundle certain dynamic requires.
      config.externals.push('ssh2');
      config.module.rules.push({
        test: /@heroku\/socksv5/,
        loader: 'null-loader',
      });
    }
    return config;
  },
};

export default nextConfig;
