import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Classroom",
  description:
    "Upload a PowerPoint and teach with an AI instructor that talks, listens, and guides learners through your slides.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
