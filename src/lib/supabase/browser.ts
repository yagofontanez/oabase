"use client";

import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Cliente do navegador. A sessão vive em cookie, para o servidor enxergar. */
export function supabaseNavegador() {
  return createBrowserClient(url, chave);
}
