const privateRoots = ['/dashboard', '/flashcards', '/coach', '/analytics', '/settings', '/admin'];

export function isProtectedPath(pathname) {
  return typeof pathname === 'string' && privateRoots.some(root => pathname === root || pathname.startsWith(`${root}/`));
}
