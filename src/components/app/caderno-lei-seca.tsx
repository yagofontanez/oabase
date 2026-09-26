"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ControlesDeLeitura, useLeitor } from "@/components/ouvir-lei";
import { daLei } from "@/lib/format";
import { formatarData } from "@/lib/format";
import type { ItemDoCaderno } from "@/lib/caderno-lei-seca";

type AlteracaoNoCaderno = {
  artigoId: string;
  leiSlug: string;
  leiSigla: string;
  artigoSlug: string;
  numero: string;
  detectadaEm: string;
};

type Filtro = "todos" | "revisar" | "favoritos" | "notas" | "lidos";

const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: "todos", rotulo: "Todos" },
  { id: "revisar", rotulo: "Revisar agora" },
  { id: "favoritos", rotulo: "Importantes" },
  { id: "notas", rotulo: "Com notas" },
  { id: "lidos", rotulo: "Lidos" },
];

function semAcento(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function CadernoLeiSeca({
  itens,
  hoje,
  alteracoes,
}: {
  itens: ItemDoCaderno[];
  hoje: string;
  alteracoes: AlteracaoNoCaderno[];
}) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");
  const vencidos = itens.filter(
    (item) => item.revisarEm && item.revisarEm <= hoje,
  ).length;
  const lidos = itens.filter((item) => item.lidoEm).length;
  const favoritos = itens.filter((item) => item.favorito).length;
  const destaques = itens.reduce((total, item) => total + item.destaques, 0);

  const visiveis = useMemo(() => {
    const termo = semAcento(busca.trim());
    return itens.filter((item) => {
      const atendeFiltro =
        filtro === "todos" ||
        (filtro === "revisar" &&
          Boolean(item.revisarEm && item.revisarEm <= hoje)) ||
        (filtro === "favoritos" && item.favorito) ||
        (filtro === "notas" && Boolean(item.nota.trim())) ||
        (filtro === "lidos" && Boolean(item.lidoEm));
      if (!atendeFiltro) return false;
      if (!termo) return true;
      return semAcento(
        `${item.leiNome} ${item.leiSigla} ${item.numero} ${item.caput} ${item.nota} ${item.importantePara}`,
      ).includes(termo);
    });
  }, [busca, filtro, hoje, itens]);

  // Ouvir o caderno em sequência — o uso do ônibus. Toca o que o filtro
  // está mostrando: "Revisar" vira a lista de revisão de hoje em áudio.
  const blocos = useMemo(
    () =>
      visiveis.map((item) => ({
        id: item.artigoId,
        titulo: `Art. ${item.numero} ${daLei(item.leiNome)} ${item.leiNome}.`,
        partes: [item.caput, ...item.paragrafos],
      })),
    [visiveis],
  );
  const leitor = useLeitor(blocos, (id) => {
    document
      .querySelectorAll("[data-item][data-lendo]")
      .forEach((el) => el.removeAttribute("data-lendo"));
    if (!id) return;
    const cartao = document.querySelector(`[data-item="${id}"]`);
    cartao?.setAttribute("data-lendo", "");
    cartao?.scrollIntoView({ block: "center", behavior: "smooth" });
  });

  return (
    <div className="painel-conteudo flex max-w-[1280px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <span className="rotulo">Sua leitura, com memória</span>
          <h1 className="mt-1 text-[clamp(1.8rem,3vw,2.45rem)] leading-none font-extrabold tracking-[-0.045em] text-ink">
            Caderno de lei seca
          </h1>
          <p className="mt-2 max-w-[66ch] text-[0.9rem] leading-relaxed text-body">
            Artigos que você marcou, anotou ou separou para revisão — sempre
            ligados ao texto oficial do acervo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {visiveis.length > 0 && (
            <ControlesDeLeitura
              leitor={leitor}
              rotulo={
                visiveis.length === 1
                  ? "Ouvir artigo"
                  : `Ouvir ${visiveis.length} artigos`
              }
            />
          )}
          <Link
            href="/legislacao"
            className="rounded-full bg-brand-700 px-4 py-2.5 text-[0.8rem] font-semibold text-white"
          >
            Encontrar artigos
          </Link>
        </div>
      </header>

      {alteracoes.length > 0 && (
        <section className="rounded-[18px] border border-ouro-200 bg-ouro-50 p-5">
          <span className="text-[0.7rem] font-bold tracking-[0.12em] text-ouro-700 uppercase">Texto oficial atualizado</span>
          <p className="mt-1 text-[0.88rem] text-body">
            {alteracoes.length === 1 ? "Um artigo do seu caderno mudou" : `${alteracoes.length} artigos do seu caderno mudaram`} depois de você guardá-los. Destaques incompatíveis ficam ocultos; suas notas continuam preservadas.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {alteracoes.slice(0, 5).map((alteracao) => (
              <Link key={alteracao.artigoId} href={`/legislacao/${alteracao.leiSlug}/${alteracao.artigoSlug}`} className="rounded-full border border-ouro-300 bg-surface px-3 py-1.5 text-[0.76rem] font-semibold text-ouro-800">
                Art. {alteracao.numero} {alteracao.leiSigla} →
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="grid overflow-hidden rounded-[22px] border border-brand-100 bg-brand-900 text-white sm:grid-cols-2 xl:grid-cols-4">
        {[
          [String(itens.length), "artigos no caderno"],
          [String(vencidos), "para revisar agora"],
          [String(destaques), "trechos destacados"],
          [String(lidos), "marcados como lidos"],
        ].map(([valor, rotulo]) => (
          <div
            key={rotulo}
            className="border-b border-white/10 p-5 last:border-0 sm:border-r xl:border-b-0"
          >
            <strong className="block text-[1.65rem] tracking-[-0.04em] text-white">
              {valor}
            </strong>
            <span className="mt-1 block text-[0.72rem] text-white/55">
              {rotulo}
            </span>
          </div>
        ))}
      </section>

      {itens.length === 0 ? (
        <section className="superficie flex flex-col items-start p-7 sm:p-9">
          <span className="rotulo">O caderno começa na fonte</span>
          <h2 className="mt-1 text-[1.3rem] font-bold text-ink">
            Você ainda não guardou nenhum artigo.
          </h2>
          <p className="mt-2 max-w-[60ch] text-[0.88rem] leading-relaxed text-body">
            Abra um dispositivo, selecione uma regra importante e salve a sua
            primeira nota. Ela reaparecerá quando o artigo voltar no roadmap
            ou depois de uma questão.
          </p>
          <Link
            href="/legislacao"
            className="mt-5 rounded-full bg-ouro-400 px-5 py-2.5 text-[0.82rem] font-bold text-noite"
          >
            Explorar legislação
          </Link>
        </section>
      ) : (
        <>
          <section className="superficie flex flex-col gap-4 p-4 sm:p-5">
            <div className="flex flex-wrap gap-2">
              {FILTROS.map((opcao) => {
                const quantidade =
                  opcao.id === "revisar"
                    ? vencidos
                    : opcao.id === "favoritos"
                      ? favoritos
                      : null;
                return (
                  <button
                    key={opcao.id}
                    type="button"
                    onClick={() => setFiltro(opcao.id)}
                    aria-pressed={filtro === opcao.id}
                    className={`rounded-full px-3.5 py-2 text-[0.76rem] font-semibold ${filtro === opcao.id ? "bg-brand-700 text-white" : "bg-sunk text-body"}`}
                  >
                    {opcao.rotulo}
                    {quantidade !== null && ` · ${quantidade}`}
                  </button>
                );
              })}
            </div>
            <label className="relative block">
              <span className="sr-only">Buscar no caderno</span>
              <span
                aria-hidden="true"
                className="absolute top-1/2 left-3.5 -translate-y-1/2 text-muted"
              >
                ⌕
              </span>
              <input
                type="search"
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
                placeholder="Buscar por lei, artigo, nota ou prova…"
                className="w-full rounded-[12px] border border-hairline bg-paper py-3 pr-4 pl-9 text-[0.84rem] text-ink outline-none focus:border-brand-300"
              />
            </label>
          </section>

          {visiveis.length === 0 ? (
            <p className="superficie p-7 text-[0.88rem] text-muted">
              Nenhum artigo corresponde a este filtro.
            </p>
          ) : (
            <section className="grid gap-4 lg:grid-cols-2">
              {visiveis.map((item) => {
                const revisarAgora = Boolean(
                  item.revisarEm && item.revisarEm <= hoje,
                );
                return (
                  <article
                    key={item.artigoId}
                    data-item={item.artigoId}
                    className={`superficie flex flex-col overflow-hidden ${revisarAgora ? "ring-1 ring-ouro-300" : ""}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-paper px-5 py-4">
                      <div>
                        <span className="text-[0.68rem] font-bold tracking-[0.1em] text-brand-600 uppercase">
                          {item.leiSigla}
                        </span>
                        <h2 className="mt-0.5 text-[1.05rem] font-bold text-ink">
                          Art. {item.numero}
                        </h2>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {item.favorito && (
                          <span className="rounded-full bg-ouro-100 px-2.5 py-1 text-[0.68rem] font-semibold text-ouro-700">
                            ★ importante
                          </span>
                        )}
                        {revisarAgora && (
                          <span className="rounded-full bg-vinho-50 px-2.5 py-1 text-[0.68rem] font-semibold text-vinho-600">
                            revisar agora
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <p className="lei-texto line-clamp-4 text-[0.92rem]">
                        {item.caput}
                      </p>
                      {item.nota && (
                        <div className="mt-4 rounded-[11px] bg-brand-50 p-3.5">
                          <span className="text-[0.64rem] font-bold tracking-[0.1em] text-brand-700 uppercase">
                            Minha nota
                          </span>
                          <p className="mt-1 line-clamp-3 text-[0.78rem] leading-relaxed text-body">
                            {item.nota}
                          </p>
                        </div>
                      )}
                      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.7rem] text-muted">
                        {item.destaques > 0 && (
                          <span>
                            {item.destaques} {item.destaques === 1 ? "destaque" : "destaques"}
                          </span>
                        )}
                        {item.lidoEm && <span>✓ lido</span>}
                        {item.vistoEmQuestao && <span>↗ visto em questão</span>}
                        {item.revisarEm && (
                          <span>
                            revisão {formatarData(item.revisarEm)}
                          </span>
                        )}
                      </div>
                      {item.importantePara && (
                        <p className="mt-3 text-[0.72rem] text-muted">
                          Importante para: <strong>{item.importantePara}</strong>
                        </p>
                      )}
                      <div className="mt-5 flex flex-wrap gap-2">
                        <Link
                          href={`/legislacao/${item.leiSlug}/${item.artigoSlug}`}
                          className="rounded-full border border-brand-200 px-4 py-2 text-[0.76rem] font-semibold text-brand-700 hover:bg-brand-50"
                        >
                          {revisarAgora ? "Revisar artigo agora →" : "Abrir e editar →"}
                        </Link>
                        <Link
                          href={`/app/flashcards?artigo=${encodeURIComponent(`${item.leiSlug}/${item.artigoSlug}`)}`}
                          className="rounded-full bg-brand-50 px-4 py-2 text-[0.76rem] font-semibold text-brand-700 hover:bg-brand-100"
                        >
                          Criar flashcard
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </>
      )}
    </div>
  );
}
