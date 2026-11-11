import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Newsreader, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

const sans = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-schibsted-grotesk" });
const display = Newsreader({ subsets: ["latin"], variable: "--font-newsreader" });

export const metadata: Metadata = {
  title: "Nexo Assist",
  description: "Service desk de TI com atendimento por agent.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${display.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
