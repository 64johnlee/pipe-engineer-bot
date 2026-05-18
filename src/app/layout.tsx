import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Engineer Bot | screenpipe",
  description: "Auto-comment on GitHub and Linear issues based on your screen activity",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
