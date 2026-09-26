import { NextResponse } from "next/server";
import type { ContextoSalvoDoPlano } from "@/lib/ia/plano";
import { site } from "@/lib/site";
import { supabaseServidor, usuarioAtual } from "@/lib/supabase/servidor";

function escapar(valor: string) {
  return valor
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function dobrarLinha(linha: string) {
  const partes: string[] = [];
  let restante = linha;
  while (restante.length > 72) {
    partes.push(restante.slice(0, 72));
    restante = ` ${restante.slice(72)}`;
  }
  partes.push(restante);
  return partes.join("\r\n");
}

function instanteDoIcs(data: string, horario: string) {
  return `${data.replaceAll("-", "")}T${horario.replace(":", "")}00`;
}

export async function GET() {
  const supabase = await supabaseServidor();
  // Sessão conferida no JWT, sem ida ao servidor de Auth (ver `usuarioAtual`).
  const user = await usuarioAtual();
  if (!user) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }

  const { data: registro } = await supabase
    .from("planos_estudo")
    .select("versao_roadmap, contexto")
    .maybeSingle();
  if (!registro?.versao_roadmap) {
    return NextResponse.json(
      { erro: "Crie um roadmap antes de exportar o calendário." },
      { status: 400 },
    );
  }
  const [{ data: itens, error }, { data: preferencias }] = await Promise.all([
    supabase
      .from("roadmap_itens")
      .select("id, disciplina, objetivo, horas, estado, data_planejada, horario_planejado, atualizado_em")
      .eq("versao", registro.versao_roadmap)
      .not("data_planejada", "is", null)
      .order("data_planejada"),
    supabase
      .from("calendario_preferencias")
      .select("horario_preferido")
      .maybeSingle(),
  ]);
  if (error) {
    return NextResponse.json(
      { erro: "Não consegui preparar o arquivo do calendário." },
      { status: 500 },
    );
  }
  const contexto = registro.contexto as ContextoSalvoDoPlano | null;
  const nome = contexto?.ementa?.titulo || "Roadmap OABase";
  const horarioPadrao = String(preferencias?.horario_preferido ?? "19:00").slice(0, 5);
  const agora = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const eventos = (itens ?? []).flatMap((item) => {
    if (!item.data_planejada) return [];
    const horario = String(item.horario_planejado ?? horarioPadrao).slice(0, 5);
    const minutos = Math.max(15, Math.round(Number(item.horas) * 60));
    const estado =
      item.estado === "concluido"
        ? "Concluído"
        : item.estado === "em_andamento"
          ? "Em andamento"
          : "A estudar";
    return [
      "BEGIN:VEVENT",
      `UID:${item.id}@oabase.com.br`,
      `DTSTAMP:${agora}`,
      `DTSTART;TZID=America/Sao_Paulo:${instanteDoIcs(item.data_planejada, horario)}`,
      `DURATION:PT${minutos}M`,
      `SUMMARY:${escapar(`${item.disciplina} — OABase`)}`,
      `DESCRIPTION:${escapar(`${item.objetivo}\nEstado: ${estado}\n${site.url}/app/roadmap?item=${item.id}`)}`,
      `URL:${site.url}/app/roadmap?item=${item.id}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
    ];
  });
  const linhas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OABase//Calendario de estudos//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapar(nome)}`,
    "X-WR-TIMEZONE:America/Sao_Paulo",
    ...eventos,
    "END:VCALENDAR",
  ];
  const corpo = `${linhas.map(dobrarLinha).join("\r\n")}\r\n`;

  return new NextResponse(corpo, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="calendario-oabase.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
