import './globals.css';
import { TooltipProvider } from '@/components/ui/tooltip';

export const metadata = {
    title: 'DataChat - AI Chatbot',
    description: 'Advanced data analysis AI chatbot interface',
};

export default function RootLayout({ children }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className="font-sans antialiased">
                <TooltipProvider>{children}</TooltipProvider>
            </body>
        </html>
    );
}
