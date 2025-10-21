'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useAuth } from '@/firebase';

export interface UserState {
  user: User | null;
  loading: boolean;
  error: Error | null;
}

export function useUser(): UserState {
  const auth = useAuth();
  const [userState, setUserState] = useState<UserState>({
    user: auth.currentUser,
    loading: auth.currentUser === null, // Only loading if user isn't already available
    error: null,
  });

  useEffect(() => {
    // If we already have a user, no need to set up the listener again
    if (userState.user) {
      if (userState.loading) {
        setUserState(s => ({...s, loading: false}));
      }
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setUserState({ user, loading: false, error: null });
      },
      (error) => {
        console.error('useUser auth error:', error);
        setUserState({ user: null, loading: false, error });
      }
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [auth, userState.user, userState.loading]);

  return userState;
}
