import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'TechMentor Voice - AI Programming Assistant',
  description: 'Real-time voice assistant powered by AssemblyAI Universal-Streaming, Context7 MCP, and Gemini 2.0 Flash. Ask anything about programming and get instant, accurate answers.',
  keywords: 'AI, voice assistant, programming, documentation, AssemblyAI, Universal-Streaming, Context7, MCP, Gemini, developer tools',
  authors: [{ name: 'TechMentor Voice Team' }],
  viewport: 'width=device-width, initial-scale=1',
  robots: 'index, follow',
  openGraph: {
    title: 'TechMentor Voice - AI Programming Assistant',
    description: 'Real-time voice assistant for developers. Powered by cutting-edge AI.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TechMentor Voice - AI Programming Assistant',
    description: 'Real-time voice assistant for developers. Powered by cutting-edge AI.',
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#1e293b" />
      </head>
      <body className={inter.className}>
        <div id="root">
          {children}
        </div>
      </body>
    </html>
  );
}