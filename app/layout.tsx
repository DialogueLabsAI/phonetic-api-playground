import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Phonetic — API Playground",
  description:
    "Marketplace access & tagging playground for the Expired Domains MVP.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
