import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pattern Generator",
  description: "Real-time image and video pattern effects",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
