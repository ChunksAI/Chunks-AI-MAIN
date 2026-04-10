/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Suppress workspace root detection warning when nested inside a monorepo
  outputFileTracingRoot: new URL('..', import.meta.url).pathname,
};

export default nextConfig;
