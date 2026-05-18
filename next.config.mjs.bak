/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  productionBrowserSourceMaps: false,
  swcMinify: false,
  images: {
    unoptimized: true,
  },
  experimental: {
    workerThreads: false,
    cpus: 1,
    memoryBasedWorkersCount: false,
    optimizeCss: false,
    nextScriptWorkers: false,
    parallelServerCompiles: false,
    parallelServerBuildTraces: false,
  },
  optimizeFonts: false,
  compress: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  poweredByHeader: false,
  generateEtags: false,
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
};

export default nextConfig;
