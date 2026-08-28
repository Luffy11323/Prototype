import { createBrowserClient } from '@supabase/ssr';

export const createClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  console.log('SUPABASE CLIENT INIT:', { url, anonKey });

  if (!url || !anonKey) {
    // Return a safe Proxy fallback to prevent "cannot read property of undefined" crashes when env vars are missing
    const handler = {
      get: (target: any, prop: string): any => {
        if (prop === 'auth') {
          return {
            getUser: async () => ({ data: { user: null }, error: new Error('Supabase URL/Key missing') }),
            getSession: async () => ({ data: { session: null }, error: new Error('Supabase URL/Key missing') }),
            signInWithPassword: async () => ({ data: { user: null, session: null }, error: new Error('Supabase configuration is missing. Please restart your dev server after adding .env.local') }),
            signOut: async () => ({ error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
          };
        }
        if (prop === 'from') {
          return () => ({
            select: () => ({
              eq: () => ({
                single: async () => ({ data: null, error: new Error('Supabase URL/Key missing') }),
                order: async () => ({ data: [], error: new Error('Supabase URL/Key missing') }),
              }),
              order: async () => ({ data: [], error: new Error('Supabase URL/Key missing') }),
            }),
          });
        }
        return () => { };
      }
    };
    return new Proxy({}, handler) as any;
  }

  return createBrowserClient(url, anonKey);
};
