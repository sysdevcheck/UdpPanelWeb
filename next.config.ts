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
    // This is the correct and robust way to handle this issue.
    // 'ssh2' and its problematic dependencies should only be bundled on the server.
    if (!isServer) {
        // Exclude 'ssh2' and its dependencies from client-side bundles
        config.externals = [...(config.externals || []), 'ssh2'];
    }
    return config;
  },
};

export default nextConfig;
