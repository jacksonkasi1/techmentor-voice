/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fix cross-origin warnings in development
  async headers() {
    return [
      {
        source: '/_next/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ];
  },
  
  // Allow dev origins (for Gitpod/CodeSpaces)
  allowedDevOrigins: [
    '3000-jacksonkasi-techmentorv-d05cubf3qoi.ws-us120.gitpod.io',
    'localhost:3000',
    '127.0.0.1:3000'
  ],
  
  experimental: {
    serverComponentsExternalPackages: ['@google/generative-ai']
  }
};

module.exports = nextConfig;