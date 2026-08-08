/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist", "node-pptx-png", "skia-canvas", "ffmpeg-static"],
  experimental: {
    proxyClientMaxBodySize: "25mb",
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  turbopack: {
    root: __dirname,
  },
  transpilePackages: ["pptx-react-viewer"],
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
