/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: '.next-prod-deploy',

  // Deshabilitar todo lo que consume RAM innecesariamente
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
  optimizeFonts: false,
  productionBrowserSourceMaps: false,
  swcMinify: true,
  compress: false, // evita compresión gzip durante build (ahorra RAM/CPU)

  // Límites para evitar que el build se cuelgue
  staticPageGenerationTimeout: 60,

  experimental: {
    optimizeCss: false,
    webpackBuildWorker: false,
    parallelServerCompiles: false,
    parallelServerBuildTraces: false,
  },

  // Headers anti-caché para prevenir Server Actions mismatch entre builds
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
    ];
  },

  webpack: (config, { isServer }) => {
    // Limitar paralelismo de webpack a 1 para reducir picos de memoria
    config.parallelism = 1;

    // Deshabilitar caché persistente de webpack durante build (ahorra RAM)
    config.cache = false;

    // Reducir el número de workers de terser/minificación
    if (config.optimization && config.optimization.minimizer) {
      config.optimization.minimizer.forEach((plugin) => {
        if (plugin.constructor.name === 'TerserPlugin') {
          plugin.options.parallel = 1;
        }
      });
    }

    return config;
  },
};

module.exports = nextConfig;
