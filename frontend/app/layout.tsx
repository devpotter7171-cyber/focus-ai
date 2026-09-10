import type { Metadata } from "next";
import { Inter, Libre_Baskerville } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import ErrorBoundary from "@/components/ErrorBoundary";
import { VoiceCommandButton } from "@/components/VoiceCommandButton";
import { VoiceConversationProvider } from "@/components/VoiceConversationProvider";
import { AccessibilityProvider } from "@/hooks/useAccessibility";
import { AccessibilityAnnouncer, SkipToMain } from "@/components/AccessibilityAnnouncer";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const libreBaskerville = Libre_Baskerville({
    subsets: ["latin"],
    weight: ["400", "700"],
    variable: "--font-serif"
});

export const metadata: Metadata = {
    title: {
        template: '%s | Focus-AI',
        default: 'Focus-AI: Adaptive Learning Platform',
    },
    description: "Personalized learning paths tailored to your confusion levels using advanced AI.",
    openGraph: {
        title: 'Focus-AI',
        description: 'Adaptive Learning Platform powered by Contextual Bandits.',
        url: 'https://focus-ai.demo',
        siteName: 'Focus-AI',
        images: [
            {
                url: 'https://focus-ai.demo/og-image.jpg',
                width: 1200,
                height: 630,
            },
        ],
        locale: 'en_US',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Focus-AI',
        description: 'Personalized learning paths tailored to your confusion levels.',
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`${inter.variable} ${libreBaskerville.variable} font-sans`}>
                <AccessibilityProvider>
                    <AuthProvider>
                        <SkipToMain />
                        <ErrorBoundary>
                            {children}
                        </ErrorBoundary>
                        <Toaster />
                        <VoiceCommandButton />
                        <VoiceConversationProvider />
                        <AccessibilityAnnouncer />
                    </AuthProvider>
                </AccessibilityProvider>
            </body>
        </html>
    );
}

