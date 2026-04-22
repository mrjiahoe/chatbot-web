import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseEnv } from './supabase-env';

const { supabaseUrl, supabasePublishableKey } = getSupabaseEnv();

/**
 * Supabase client for use in Client Components.
 */
export const supabase = createBrowserClient(
    supabaseUrl,
    supabasePublishableKey
);
