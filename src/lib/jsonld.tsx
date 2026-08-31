/**
 * Injeta JSON-LD. Renderizado no servidor, sem hidratação:
 * o crawler lê o script direto no HTML.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // O dado é nosso, não vem de input do usuário.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
