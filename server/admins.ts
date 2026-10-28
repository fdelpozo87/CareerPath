// Quién administra Bivio. ADMIN_EMAIL admite varios emails separados por coma, punto y coma o espacio: así el panel no
// depende de una sola persona. Todos tienen los mismos permisos.

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAIL ?? '')
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminEmail(email: string): boolean {
  return adminEmails().includes(email.trim().toLowerCase())
}
