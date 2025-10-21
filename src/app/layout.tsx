import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { cn } from '@/lib/utils';
import { Send } from 'lucide-react';
import { FirebaseClientProvider } from '@/firebase';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'ZiVPN Multi-Manager',
  description: 'Panel de gestión para múltiples servidores ZiVPN.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning={true}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={cn("dark flex flex-col min-h-screen", inter.variable)}>
        <FirebaseClientProvider>
          <main className="flex-grow">
            {children}
          </main>
          <footer className="py-4 text-center text-sm text-muted-foreground border-t border-border mt-auto">
            <div className="container mx-auto flex items-center justify-center gap-2">
              <span>© {new Date().getFullYear()} Todos los derechos reservados.</span>
              <span className="text-muted-foreground">|</span>
              <a
                href="https://t.me/sysdevcheck"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <Send className="w-4 h-4" />
                <span>@sysdevcheck</span>
              </a>
            </div>
          </footer>
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
