import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rig D Agent",
  description: "Coach flawed AI fighters into impossible wins.",
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
