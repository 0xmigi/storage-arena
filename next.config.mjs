/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // PGlite ships WASM and loads it natively — keep it out of the webpack bundle.
  experimental: {
    serverComponentsExternalPackages: ["@electric-sql/pglite"],
  },
};
export default nextConfig;
