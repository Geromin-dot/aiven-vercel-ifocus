"use client";

import { SessionProvider } from "next-auth/react";
import { usePathname } from 'next/navigation';

export function Providers({ children }) {
  const isLogin = usePathname() === '/login';
  return (
    // The login form starts fresh. Do not fetch/renew an older session while a
    // new credentials request is replacing its cookie. Remount on route changes.
    <SessionProvider key={isLogin ? 'login' : 'app'} session={isLogin ? null : undefined} refetchOnWindowFocus={false} refetchInterval={0}>
      {children}
    </SessionProvider>
  );
}
