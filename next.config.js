/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
  turbopack: {
    root: __dirname,
  },
  generateBuildId: async () => "ncst-visual-slide-v7",
  async headers() {
    return [
      {
        source: "/training/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
