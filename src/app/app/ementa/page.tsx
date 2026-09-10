import type { Metadata } from "next";
import { ImportadorEmenta } from "@/components/app/importador-ementa";
import { getDisciplinas } from "@/lib/content/queries";
import type { ContextoSalvoDoPlano } from "@/lib/ia/plano";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Importar ementa",
  robots: { index: false, follow: false },
};

export default async function EmentaPage() {
  const supabase = await supabaseServidor();
  const [disciplinas, planoRes] = await Promise.all([
    getDisciplinas(),
    supabase.from("planos_estudo").select("user_id, contexto").maybeSingle(),
  ]);
  return (
    <ImportadorEmenta
      disciplinas={disciplinas.map((disciplina) => disciplina.nome)}
      temPlano={Boolean(planoRes.data)}
      contextoInicial={(planoRes.data?.contexto as ContextoSalvoDoPlano | null) ?? null}
    />
  );
}
