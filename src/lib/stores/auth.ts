// Auth store for managing user authentication state
import { writable, derived, get } from 'svelte/store';
import { supabase } from '$lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
}

interface UserProfile {
  phone_number: string;
  username: string | null;
  email: string | null;
  display_name: string | null;
  is_public: boolean;
  has_started: boolean;
  auth_id: string | null;
}

// Create auth store
function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>({
    user: null,
    session: null,
    loading: true,
    initialized: false
  });

  // Initialize auth state
  async function initialize() {
    if (!browser) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();

      set({
        user: session?.user ?? null,
        session: session,
        loading: false,
        initialized: true
      });

      // Set up auth state change listener
      supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state changed:', event);

        update(state => ({
          ...state,
          user: session?.user ?? null,
          session: session,
          loading: false
        }));

        // Handle auth events
        switch (event) {
          case 'SIGNED_IN':
            // Optionally redirect after sign in
            if (window.location.pathname === '/auth/signin') {
              await goto('/');
            }
            break;
          case 'SIGNED_OUT':
            // Clear any cached data
            if (browser) {
              localStorage.removeItem('tbr-userId');
            }
            break;
          case 'USER_UPDATED':
            // Refresh user data
            await refreshProfile();
            break;
        }
      });
    } catch (error) {
      console.error('Error initializing auth:', error);
      set({
        user: null,
        session: null,
        loading: false,
        initialized: true
      });
    }
  }

  // Sign in with magic link
  async function signInWithEmail(email: string) {
    update(state => ({ ...state, loading: true }));

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/verify`
      }
    });

    update(state => ({ ...state, loading: false }));

    if (error) {
      throw error;
    }
  }

  // Sign up with email
  async function signUpWithEmail(email: string) {
    return signInWithEmail(email); // Same as sign in for magic links
  }

  // Sign out
  async function signOut() {
    update(state => ({ ...state, loading: true }));

    const { error } = await supabase.auth.signOut();

    update(state => ({
      ...state,
      user: null,
      session: null,
      loading: false
    }));

    if (error) {
      throw error;
    }

    // Redirect to home
    if (browser) {
      await goto('/');
    }
  }

  // Refresh user profile from database
  async function refreshProfile() {
    const state = get({ subscribe });
    if (!state.user) return null;

    try {
      const { data, error } = await fetch('/api/auth/profile').then(r => r.json());

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      return data as UserProfile;
    } catch (error) {
      console.error('Error refreshing profile:', error);
      return null;
    }
  }

  // Verify phone number for account claiming
  async function verifyPhone(phone: string, code: string) {
    const response = await fetch('/api/auth/verify-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Verification failed');
    }

    return data;
  }

  // Send verification code to phone
  async function sendPhoneVerification(phone: string) {
    const response = await fetch('/api/auth/send-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to send verification');
    }

    return data;
  }

  // Set username
  async function setUsername(username: string) {
    const response = await fetch('/api/auth/username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to set username');
    }

    await refreshProfile();
    return data;
  }

  return {
    subscribe,
    initialize,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    refreshProfile,
    verifyPhone,
    sendPhoneVerification,
    setUsername
  };
}

// Create and export auth store
export const auth = createAuthStore();

// Derived stores
export const user = derived(auth, $auth => $auth.user);
export const session = derived(auth, $auth => $auth.session);
export const isAuthenticated = derived(auth, $auth => !!$auth.session);
export const isLoading = derived(auth, $auth => $auth.loading);