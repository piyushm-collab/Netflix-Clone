import React from 'react';

// Supabase removed — replaced with custom JWT backend.
// This file is kept as a passthrough so imports don't break.
export const SupabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>{children}</>
);

export const useSupabase = () => ({});
