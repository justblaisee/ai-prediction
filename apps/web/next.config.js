/** @type {import('next').NextConfig} */
const isGithubPages = process.env.GITHUB_PAGES === 'true';
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'ai-prediction';

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['lucide-react'],
  output: 'export',
  images: {
    unoptimized: true,
    domains: [],
  },
  basePath: isGithubPages ? `/${repoName}` : '',
  assetPrefix: isGithubPages ? `/${repoName}/` : undefined,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
    NEXT_PUBLIC_ML_URL: process.env.NEXT_PUBLIC_ML_URL || 'http://localhost:8000',
  },
}

module.exports = nextConfig
