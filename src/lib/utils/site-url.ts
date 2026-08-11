/**
 * URL absoluta do app, usada nos redirects de OAuth e de confirmação de e-mail.
 *
 * Ordem proposital: preview deployment da Vercel tem hostname novo a cada push,
 * e hostname não cadastrado no Supabase e no Google quebra o login. Por isso
 * caímos sempre no domínio de produção, e não no da preview.
 */
export function getSiteUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;

  if (!configured) return "http://localhost:3000";

  const withProtocol = configured.startsWith("http")
    ? configured
    : `https://${configured}`;

  return withProtocol.replace(/\/$/, "");
}

export function absoluteUrl(path: string): string {
  return `${getSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
