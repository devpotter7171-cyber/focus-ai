"use client";

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { apiFetch } from '@/lib/api';

export interface Profile {
    id: string;
    email: string | null;
    full_name?: string | null;
    role: 'student' | 'teacher' | 'admin';
    profile_segment?: string | null;
    onboarding_completed?: boolean;
    experience_level?: string | null;
    initial_content_level?: number | null;
}

interface AuthContextType {
    user: User | null;
    profile: Profile | null;
    loading: boolean;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    profile: null,
    loading: true,
    signOut: async () => { },
    refreshProfile: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const signOut = async () => {
        await firebaseSignOut(auth);
        setProfile(null);
    };

    const refreshProfile = useCallback(async () => {
        if (!auth.currentUser) {
            setProfile(null);
            return;
        }
        try {
            const me = await apiFetch<Profile>('/auth/me');
            setProfile(me);
        } catch (err) {
            console.warn('Failed to fetch /auth/me:', err);
            setProfile(null);
        }
    }, []);

    // Voice command sign-out hook (unchanged behavior).
    useEffect(() => {
        const onVoiceSignOut = async () => {
            try {
                await firebaseSignOut(auth);
                router.push('/login');
            } catch (err) {
                console.error('Voice sign-out failed:', err);
            }
        };
        window.addEventListener('voice-sign-out', onVoiceSignOut);
        return () => window.removeEventListener('voice-sign-out', onVoiceSignOut);
    }, [router]);

    useEffect(() => {
        let lastSyncedUid: string | null = null;

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                if (firebaseUser.uid !== lastSyncedUid) {
                    lastSyncedUid = firebaseUser.uid;
                    const token = await firebaseUser.getIdToken();
                    try {
                        await apiFetch('/auth/sync-user', {
                            method: 'POST',
                            body: JSON.stringify({
                                id_token: token,
                                full_name: firebaseUser.displayName || null,
                            }),
                            includeAuth: false,
                        });
                    } catch (syncError) {
                        console.warn("User sync failed (non-critical):", syncError);
                    }
                }
                // Pull the role from the server. Don't fail loading if this errors.
                try {
                    const me = await apiFetch<Profile>('/auth/me');
                    setProfile(me);
                } catch (err) {
                    console.warn('Failed to fetch /auth/me on auth change:', err);
                    setProfile(null);
                }
            } else {
                setProfile(null);
            }
            setUser(firebaseUser);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
};
