
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
   webpack: (config, { isServer, webpack }) => {
    if (isServer) {
        // Excluir ssh2 de ser empaquetado por Webpack, ya que es una dependencia nativa de Node.js
        config.externals.push('ssh2');
        
        // Manejar el archivo .node para que no sea procesado por los loaders de Webpack
        config.module.rules.push({
            test: /\.node$/,
            use: 'node-loader',
        });
    }
    return config;
  },
};

export default nextConfig;
