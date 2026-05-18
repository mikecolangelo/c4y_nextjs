/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  images: { unoptimized: true },
  swcMinify: false,
  experimental: {
    cpus: 1,
    workerThreads: false,
    memoryBasedWorkersCount: false,
  }
};
export default nextConfig;
