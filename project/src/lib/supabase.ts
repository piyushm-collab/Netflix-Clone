// Supabase removed — replaced with custom JWT backend.
// This stub prevents import errors from any residual references.
export const supabase = null as any;
export const signUp = async () => ({ data: null, error: new Error('Supabase removed') });
export const signIn = async () => ({ data: null, error: new Error('Supabase removed') });
export const signOut = async () => ({ error: null });
export const resetPassword = async () => ({ data: null, error: null });
export const getCurrentUser = async () => null;
export const getSignInLogs = async () => ({ data: null, error: null });
