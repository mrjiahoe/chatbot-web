import { supabase } from './supabase';

/**
 * Creates a brand new user account with an Email and Password.
 * We also save extra info (metadata) like their first/last name at the same time.
 */
export async function signUp({ email, password, metadata }) {
    console.log('Attempting signUp with metadata:', { email, metadata });
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: metadata,
        },
    });
    return { data, error };
}

/**
 * Logs in an existing user using their Email and Password.
 */
export async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    return { data, error };
}

/**
 * Logs the current user out of the application.
 */
export async function signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
}

/**
 * Gets the current "Session" (tells us if the user is still actively logged in).
 */
export async function getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    return { session, error };
}

/**
 * Gets the actual User object (contains ID, Email, etc.) of the person logged in.
 */
export async function getUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
}

/**
 * Starts the "Login with Google" process. 
 * This will pop up a Google window and then send you back to our app.
 */
export async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            // After Google says OK, it sends the user here
            redirectTo: window.location.origin + '/auth/callback',
        },
    });
    return { data, error };
}
