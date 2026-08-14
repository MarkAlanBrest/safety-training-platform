/** @type {import('next').NextConfig} */
function canvasFrameAncestors() {
  const base = process.env.CANVAS_BASE_URL || "";
  const hosts = ["https://*.instructure.com", "https://*.canvaslms.com"];
  try {
    if (base) {
      const host = new URL(base.startsWith("http") ? base : `https://${base}`).host;
      hosts.push(`https://${host}`);
    }
  } catch {
    // ignore invalid CANVAS_BASE_URL
  }
  return `frame-ancestors 'self' ${hosts.join(" ")}`;
}

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
    const embedPolicy = canvasFrameAncestors();
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
      {
        source: "/canvas/:path*",
        headers: [{ key: "Content-Security-Policy", value: embedPolicy }],
      },
      {
        source: "/api/lti/:path*",
        headers: [{ key: "Content-Security-Policy", value: embedPolicy }],
      },
    ];
  },
};

module.exports = nextConfig;
