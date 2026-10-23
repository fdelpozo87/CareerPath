// El idioma también vive en la URL (/es/, /en/): cada versión tiene su dirección para buscadores, redes y asistentes de IA.

export type PathLang = 'es' | 'en'

/** Idioma que indica el primer tramo de la ruta, o null si no hay (por ejemplo, "/"). */
export function langFromPath(pathname: string): PathLang | null {
  const m = /^\/(es|en)(?:\/|$)/.exec(pathname)
  return m ? (m[1] as PathLang) : null
}

/** La misma ruta en otro idioma: "/" y "/es/" pasan a "/en/"; el resto de la ruta se conserva. */
export function pathForLang(pathname: string, lang: PathLang): string {
  const rest = pathname.replace(/^\/(es|en)(?=\/|$)/, '')
  return `/${lang}${rest.startsWith('/') ? rest : `/${rest}`}`
}

/** Un enlace de acceso de Supabase (tokens en la URL): no se toca la dirección hasta que se haya leído. */
export const hasAuthParams = (search: string, hash: string): boolean =>
  /(^|[#&?])(access_token|refresh_token|error_description|error_code|type)=/.test(hash) || /(^|[?&])code=/.test(search)
