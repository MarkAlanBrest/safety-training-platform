/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist", "node-pptx-png", "skia-canvas", "ffmpeg-static", "pg"],
  experimental: {
    // Chunked SCORM uploads use ~1 MB parts; one-shot / server-action ceiling matches package cap.
    proxyClientMaxBodySize: "200mb",
    serverActions: {
      bodySizeLimit: "200mb",
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
