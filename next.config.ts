
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
    // This is the crucial change. In a browser environment (or any non-server environment
    // during client-side bundling), we tell webpack to treat 'ssh2' as an external
    // library that will be provided, but for our case, we effectively nullify it
    // so it doesn't get bundled and cause compilation errors.
    if (!isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'ssh2': 'ssh2',
      });
    }

    // For the server-side build on App Hosting, which is also a restricted environment,
    // we do the same. This prevents the build process from trying to resolve
    // the native dependencies of ssh2. The consequence is that any code
    // calling ssh2 will fail at runtime in production, which we will handle gracefully.
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
