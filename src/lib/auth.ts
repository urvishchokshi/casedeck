export const ALLOWED_EMAIL_DOMAIN = "@isb.edu";

export function isIsbEmail(email: string | undefined | null): boolean {
  return !!email && email.toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN);
}
