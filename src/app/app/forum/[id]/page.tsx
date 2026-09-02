import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  TopicoDoForum,
  type RespostaDoForum,
  type TopicoAberto,
} from "@/components/app/forum-topico";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Fórum",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function TopicoPage({ params }: Props) {
  const { id } = await params;
  const supabase = await supabaseServidor();

  const [{ data }, { data: respostas }, { data: admin }] = await Promise.all([
    supabase
      .from("forum_topicos")
      .select(
        "id, titulo, corpo, autor_nome, trancado, removido, criado_em, disciplinas(nome)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("forum_respostas")
      .select("id, autor_nome, corpo, removido, criado_em")
      .eq("topico_id", id)
      .order("criado_em", { ascending: true }),
    supabase.rpc("sou_admin"),
  ]);

  if (!data) notFound();

  type Linha = Omit<TopicoAberto, "disciplina"> & {
    disciplinas: { nome: string } | { nome: string }[] | null;
  };
  const linha = data as unknown as Linha;
  const d = Array.isArray(linha.disciplinas)
    ? linha.disciplinas[0]
    : linha.disciplinas;

  return (
    <TopicoDoForum
      topico={{ ...linha, disciplina: d?.nome ?? null }}
      respostas={(respostas ?? []) as RespostaDoForum[]}
      moderador={Boolean(admin)}
    />
  );
}
