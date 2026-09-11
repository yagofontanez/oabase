"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatarData } from "@/lib/format";
import {
  AVALIACOES_FLASHCARD,
  type AvaliacaoFlashcard,
  type Flashcard,
  type FonteParaNovoFlashcard,
  type ResultadoDaRevisao,
} from "@/lib/flashcards";
import { supabaseNavegador } from "@/lib/supabase/browser";

type Modo = "biblioteca" | "formulario" | "revisao";

function fonteDoCartao(cartao: Flashcard): FonteParaNovoFlashcard | null {
  if (!cartao.fonte) return null;
  return { ...cartao.fonte, trecho: cartao.trechoFonte };
}

function FormularioFlashcard({
  cartao,
  fonte,
  hoje,
  aoSalvar,
  aoCancelar,
}: {
  cartao: Flashcard | null;
  fonte: FonteParaNovoFlashcard | null;
  hoje: string;
  aoSalvar: (cartao: Flashcard) => void;
  aoCancelar: () => void;
}) {
  const [frente, setFrente] = useState(cartao?.frente ?? "");
  const [verso, setVerso] = useState(cartao?.verso ?? fonte?.trecho ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    const pergunta = frente.trim();
    const resposta = verso.trim();
    if (!pergunta || !resposta || salvando) {
      if (!pergunta || !resposta) setErro("Preencha a frente e o verso do cartão.");
      return;
    }
    setSalvando(true);
    setErro(null);
    const { data, error } = await supabaseNavegador().rpc("salvar_flashcard", {
      p_id: cartao?.id ?? null,
      p_frente: pergunta,
      p_verso: resposta,
      p_lei_slug: fonte?.tipo === "artigo" ? fonte.leiSlug : null,
      p_artigo_slug: fonte?.tipo === "artigo" ? fonte.artigoSlug : null,
      p_sumula_slug: fonte?.tipo === "sumula" ? fonte.sumulaSlug : null,
      p_trecho_fonte: fonte?.trecho ?? "",
    });
    setSalvando(false);
    if (error || !data) {
      setErro("Não consegui salvar o cartão. Tente novamente.");
      return;
    }

    const agora = new Date().toISOString();
    aoSalvar({
      id: String(data),
      frente: pergunta,
      verso: resposta,
      trechoFonte: fonte?.trecho ?? "",
      proximaRevisao: cartao?.proximaRevisao ?? hoje,
      intervaloDias: cartao?.intervaloDias ?? 0,
      facilidade: cartao?.facilidade ?? 2.5,
      repeticoes: cartao?.repeticoes ?? 0,
      suspenso: cartao?.suspenso ?? false,
      criadoEm: cartao?.criadoEm ?? agora,
      atualizadoEm: agora,
      revisoesTotal: cartao?.revisoesTotal ?? 0,
      fonte: fonte
        ? fonte.tipo === "artigo"
          ? {
              tipo: "artigo",
              leiSlug: fonte.leiSlug,
              artigoSlug: fonte.artigoSlug,
              rotulo: fonte.rotulo,
              href: fonte.href,
            }
          : {
              tipo: "sumula",
              sumulaSlug: fonte.sumulaSlug,
              rotulo: fonte.rotulo,
              href: fonte.href,
            }
        : null,
    });
  }

  return (
    <section className="superficie overflow-hidden">
      <div className="border-b border-line bg-paper px-5 py-4 sm:px-6">
        <span className="rotulo">{cartao ? "Editar cartão" : "Novo cartão"}</span>
        <h2 className="mt-1 text-[1.3rem] font-bold text-ink">
          {fonte ? "Transforme a fonte em uma pergunta" : "Registre uma lembrança sua"}
        </h2>
        <p className="mt-1 max-w-[68ch] text-[0.82rem] leading-relaxed text-muted">
          O sistema não escreve conteúdo jurídico por você. A pergunta é sua;
          quando há fonte, o trecho literal permanece preso ao cartão.
        </p>
      </div>

      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[.88fr_1.12fr]">
        <div>
          <div
            className={`rounded-[14px] border p-4 ${fonte ? "border-brand-200 bg-brand-50" : "border-hairline bg-paper"}`}
          >
            <span className="text-[0.66rem] font-bold tracking-[0.12em] text-brand-700 uppercase">
              {fonte ? "Fonte oficial vinculada" : "Anotação pessoal"}
            </span>
            {fonte ? (
              <>
                <Link
                  href={fonte.href}
                  target="_blank"
                  className="mt-1.5 block text-[0.9rem] font-bold text-brand-700 underline decoration-brand-200 underline-offset-4"
                >
                  {fonte.rotulo} ↗
                </Link>
                {fonte.trecho && (
                  <blockquote className="mt-3 border-l-2 border-ouro-300 pl-3 text-[0.78rem] leading-relaxed text-body">
                    “{fonte.trecho}”
                  </blockquote>
                )}
              </>
            ) : (
              <p className="mt-1.5 text-[0.78rem] leading-relaxed text-muted">
                Este cartão ficará claramente identificado como pessoal, sem
                fingir que a resposta veio do acervo jurídico.
              </p>
            )}
          </div>

          <label className="mt-5 block text-[0.74rem] font-semibold text-muted">
            Frente · o que você quer lembrar?
            <textarea
              value={frente}
              onChange={(evento) => setFrente(evento.target.value)}
              maxLength={2000}
              rows={5}
              placeholder="Ex.: Quais são os requisitos da responsabilidade civil subjetiva?"
              className="mt-1.5 block w-full resize-y rounded-[12px] border border-hairline bg-surface px-3.5 py-3 text-[0.88rem] leading-relaxed font-normal text-ink outline-none focus:border-brand-300"
            />
          </label>
          <span className="mt-1 block text-right text-[0.68rem] text-muted">
            {frente.length}/2.000
          </span>
        </div>

        <div>
          <label className="block text-[0.74rem] font-semibold text-muted">
            Verso · resposta que deve voltar
            <textarea
              value={verso}
              onChange={(evento) => setVerso(evento.target.value)}
              maxLength={5000}
              rows={11}
              placeholder="Escreva a resposta com suas palavras ou mantenha o trecho literal da fonte…"
              className="mt-1.5 block w-full resize-y rounded-[12px] border border-hairline bg-surface px-3.5 py-3 text-[0.88rem] leading-relaxed font-normal text-ink outline-none focus:border-brand-300"
            />
          </label>
          <span className="mt-1 block text-right text-[0.68rem] text-muted">
            {verso.length}/5.000
          </span>
          {erro && (
            <p role="alert" className="mt-3 rounded-[10px] bg-vinho-50 px-3 py-2.5 text-[0.76rem] text-vinho-600">
              {erro}
            </p>
          )}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={aoCancelar}
              disabled={salvando}
              className="rounded-full border border-hairline px-4 py-2.5 text-[0.8rem] font-semibold text-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void salvar()}
              disabled={salvando}
              className="rounded-full bg-brand-700 px-5 py-2.5 text-[0.8rem] font-semibold text-white disabled:opacity-50"
            >
              {salvando ? "Salvando…" : cartao ? "Salvar alterações" : "Criar flashcard"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SessaoDeRevisao({
  cartoes,
  hoje,
  aoAtualizar,
  aoSair,
}: {
  cartoes: Flashcard[];
  hoje: string;
  aoAtualizar: (cartao: Flashcard) => void;
  aoSair: () => void;
}) {
  const [fila] = useState(() =>
    cartoes
      .filter(
        (cartao) => !cartao.suspenso && cartao.proximaRevisao <= hoje,
      )
      .map((cartao) => cartao.id),
  );
  const [indice, setIndice] = useState(0);
  const [revelado, setRevelado] = useState(false);
  const [avaliando, setAvaliando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoDaRevisao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const cartao = cartoes.find((item) => item.id === fila[indice]) ?? null;

  async function avaliar(avaliacao: AvaliacaoFlashcard) {
    if (!cartao || avaliando || resultado) return;
    setAvaliando(true);
    setErro(null);
    const { data, error } = await supabaseNavegador().rpc(
      "revisar_flashcard",
      { p_flashcard_id: cartao.id, p_avaliacao: avaliacao },
    );
    setAvaliando(false);
    if (error || !data) {
      setErro("Não consegui registrar esta revisão.");
      return;
    }
    const proximo = data as ResultadoDaRevisao;
    setResultado(proximo);
    aoAtualizar({
      ...cartao,
      ...proximo,
      revisoesTotal: cartao.revisoesTotal + 1,
    });
  }

  function avancar() {
    setIndice((atual) => atual + 1);
    setRevelado(false);
    setResultado(null);
    setErro(null);
  }

  if (!cartao) {
    const semPendencias = fila.length === 0;
    return (
      <section className="mx-auto flex w-full max-w-[680px] flex-col items-center rounded-[24px] bg-brand-900 p-8 text-center text-white shadow-[0_20px_55px_rgba(8,58,49,.2)] sm:p-11">
        <span className="text-[2rem]" aria-hidden="true">✓</span>
        <h2 className="mt-3 text-[1.65rem] font-extrabold text-white">
          {semPendencias ? "Fila em dia" : "Revisão concluída"}
        </h2>
        <p className="mt-2 max-w-[48ch] text-[0.88rem] leading-relaxed text-white/65">
          {semPendencias
            ? "Nenhum flashcard está vencido. Quando chegar a hora, ele aparece aqui e na sua sessão de hoje."
            : `Você revisou ${fila.length} ${fila.length === 1 ? "cartão" : "cartões"}. Os próximos retornos já foram distribuídos pelo seu desempenho.`}
        </p>
        <button
          type="button"
          onClick={aoSair}
          className="mt-6 rounded-full bg-ouro-400 px-5 py-2.5 text-[0.82rem] font-bold text-noite"
        >
          Voltar à biblioteca
        </button>
      </section>
    );
  }

  const progresso = fila.length ? (indice / fila.length) * 100 : 100;
  return (
    <section className="mx-auto flex w-full max-w-[760px] flex-col gap-4">
      <div className="flex items-center justify-between gap-4 text-[0.78rem] text-muted">
        <span>Cartão {indice + 1} de {fila.length}</span>
        <button type="button" onClick={aoSair} className="font-semibold hover:text-ink">
          Encerrar sessão
        </button>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-sunk">
        <span className="block h-full rounded-full bg-brand-500" style={{ width: `${progresso}%` }} />
      </div>

      <article className="superficie min-h-[410px] overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-paper px-5 py-3.5">
          <span className={`rounded-full px-2.5 py-1 text-[0.68rem] font-bold ${cartao.fonte ? "bg-brand-100 text-brand-700" : "bg-sunk text-muted"}`}>
            {cartao.fonte?.rotulo ?? "Anotação pessoal"}
          </span>
          <span className="text-[0.7rem] text-muted">
            {cartao.revisoesTotal} {cartao.revisoesTotal === 1 ? "revisão" : "revisões"}
          </span>
        </div>
        <div className="flex min-h-[350px] flex-col justify-center p-6 sm:p-9">
          <span className="rotulo">Frente</span>
          <h2 className="mt-3 text-[clamp(1.3rem,3vw,1.8rem)] leading-snug font-bold text-ink">
            {cartao.frente}
          </h2>

          {!revelado ? (
            <button
              type="button"
              onClick={() => setRevelado(true)}
              className="mt-8 self-start rounded-full bg-brand-700 px-5 py-2.5 text-[0.84rem] font-semibold text-white"
            >
              Mostrar resposta
            </button>
          ) : (
            <div className="mt-7 border-t border-line pt-6">
              <span className="rotulo">Verso</span>
              <p className="mt-3 whitespace-pre-line text-[0.95rem] leading-relaxed text-body">
                {cartao.verso}
              </p>
              {cartao.trechoFonte && cartao.trechoFonte.trim() !== cartao.verso.trim() && (
                <blockquote className="mt-4 rounded-[12px] border-l-2 border-ouro-300 bg-ouro-50 px-4 py-3 text-[0.8rem] leading-relaxed text-body">
                  {cartao.trechoFonte}
                </blockquote>
              )}
              {cartao.fonte && (
                <Link
                  href={cartao.fonte.href}
                  target="_blank"
                  className="mt-4 inline-block text-[0.76rem] font-semibold text-brand-700 underline decoration-brand-200 underline-offset-4"
                >
                  Conferir na fonte oficial →
                </Link>
              )}

              {!resultado ? (
                <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {AVALIACOES_FLASHCARD.map((avaliacao) => (
                    <button
                      key={avaliacao.id}
                      type="button"
                      onClick={() => void avaliar(avaliacao.id)}
                      disabled={avaliando}
                      className={`rounded-[12px] border px-3 py-3 text-left ${avaliacao.id === "errei" ? "border-vinho-200 bg-vinho-50" : avaliacao.id === "facil" ? "border-brand-200 bg-brand-50" : "border-hairline bg-paper"}`}
                    >
                      <strong className={`block text-[0.8rem] ${avaliacao.id === "errei" ? "text-vinho-600" : "text-ink"}`}>
                        {avaliacao.rotulo}
                      </strong>
                      <span className="mt-0.5 block text-[0.66rem] text-muted">
                        {avaliacao.detalhe}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[13px] bg-brand-50 p-4">
                  <p className="text-[0.8rem] text-brand-800">
                    Próxima revisão em <strong>{formatarData(resultado.proximaRevisao)}</strong>
                    {` · intervalo de ${resultado.intervaloDias} ${resultado.intervaloDias === 1 ? "dia" : "dias"}`}
                  </p>
                  <button
                    type="button"
                    onClick={avancar}
                    className="rounded-full bg-brand-700 px-4 py-2 text-[0.76rem] font-semibold text-white"
                  >
                    Próximo cartão →
                  </button>
                </div>
              )}
              {erro && <p role="alert" className="mt-3 text-[0.76rem] text-vinho-600">{erro}</p>}
            </div>
          )}
        </div>
      </article>
    </section>
  );
}

export function Flashcards({
  cartoesIniciais,
  fonteInicial,
  hoje,
  revisadosHoje: revisadosHojeInicial,
  abrirRevisao,
}: {
  cartoesIniciais: Flashcard[];
  fonteInicial: FonteParaNovoFlashcard | null;
  hoje: string;
  revisadosHoje: number;
  abrirRevisao: boolean;
}) {
  const router = useRouter();
  const [cartoes, setCartoes] = useState(cartoesIniciais);
  const [modo, setModo] = useState<Modo>(
    fonteInicial ? "formulario" : abrirRevisao ? "revisao" : "biblioteca",
  );
  const [fonteDoFormulario, setFonteDoFormulario] =
    useState<FonteParaNovoFlashcard | null>(fonteInicial);
  const [editando, setEditando] = useState<Flashcard | null>(null);
  const [busca, setBusca] = useState("");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [revisadosHoje, setRevisadosHoje] = useState(revisadosHojeInicial);
  const vencidos = cartoes.filter(
    (cartao) => !cartao.suspenso && cartao.proximaRevisao <= hoje,
  ).length;
  const vinculados = cartoes.filter((cartao) => cartao.fonte).length;
  const consolidados = cartoes.filter((cartao) => cartao.intervaloDias >= 21).length;
  const visiveis = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return cartoes;
    return cartoes.filter((cartao) =>
      `${cartao.frente} ${cartao.verso} ${cartao.fonte?.rotulo ?? "anotação pessoal"}`
        .toLocaleLowerCase("pt-BR")
        .includes(termo),
    );
  }, [busca, cartoes]);

  function abrirNovo() {
    setEditando(null);
    setFonteDoFormulario(null);
    setModo("formulario");
    setMensagem(null);
  }

  function abrirEdicao(cartao: Flashcard) {
    setEditando(cartao);
    setFonteDoFormulario(fonteDoCartao(cartao));
    setModo("formulario");
    setMensagem(null);
  }

  function cartaoSalvo(cartao: Flashcard) {
    setCartoes((atuais) => {
      const existe = atuais.some((item) => item.id === cartao.id);
      return existe
        ? atuais.map((item) => (item.id === cartao.id ? cartao : item))
        : [cartao, ...atuais];
    });
    setModo("biblioteca");
    setEditando(null);
    setFonteDoFormulario(null);
    setMensagem("Flashcard salvo e colocado na fila de hoje.");
    router.replace("/app/flashcards", { scroll: false });
  }

  async function excluir(cartao: Flashcard) {
    if (!window.confirm("Excluir este flashcard e todo o histórico dele?")) return;
    const { error } = await supabaseNavegador()
      .from("flashcards")
      .delete()
      .eq("id", cartao.id);
    if (error) {
      setMensagem("Não consegui excluir o cartão.");
      return;
    }
    setCartoes((atuais) => atuais.filter((item) => item.id !== cartao.id));
    setMensagem("Flashcard excluído.");
  }

  async function alternarSuspensao(cartao: Flashcard) {
    const { error } = await supabaseNavegador()
      .from("flashcards")
      .update({ suspenso: !cartao.suspenso })
      .eq("id", cartao.id);
    if (error) {
      setMensagem("Não consegui alterar o cartão.");
      return;
    }
    setCartoes((atuais) =>
      atuais.map((item) =>
        item.id === cartao.id ? { ...item, suspenso: !item.suspenso } : item,
      ),
    );
  }

  function iniciarRevisao() {
    setModo("revisao");
    setMensagem(null);
  }

  return (
    <div className="painel-conteudo flex max-w-[1280px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <span className="rotulo">Memória ativa, ligada à fonte</span>
          <h1 className="mt-1 text-[clamp(1.8rem,3vw,2.45rem)] leading-none font-extrabold tracking-[-0.045em] text-ink">
            Flashcards
          </h1>
          <p className="mt-2 max-w-[66ch] text-[0.9rem] leading-relaxed text-body">
            Revise no intervalo certo e confira a regra no artigo ou na súmula
            de onde ela veio.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={abrirNovo}
            className="rounded-full border border-brand-200 bg-surface px-4 py-2.5 text-[0.8rem] font-semibold text-brand-700"
          >
            + Novo cartão pessoal
          </button>
          <button
            type="button"
            onClick={iniciarRevisao}
            disabled={vencidos === 0}
            className="rounded-full bg-brand-700 px-5 py-2.5 text-[0.8rem] font-semibold text-white disabled:opacity-40"
          >
            Revisar agora · {vencidos}
          </button>
        </div>
      </header>

      {modo === "revisao" ? (
        <SessaoDeRevisao
          cartoes={cartoes}
          hoje={hoje}
          aoAtualizar={(cartao) => {
            setCartoes((atuais) =>
              atuais.map((item) => (item.id === cartao.id ? cartao : item)),
            );
            setRevisadosHoje((total) => total + 1);
          }}
          aoSair={() => setModo("biblioteca")}
        />
      ) : modo === "formulario" ? (
        <FormularioFlashcard
          key={`${editando?.id ?? "novo"}-${fonteDoFormulario?.href ?? "pessoal"}`}
          cartao={editando}
          fonte={fonteDoFormulario}
          hoje={hoje}
          aoSalvar={cartaoSalvo}
          aoCancelar={() => {
            setModo("biblioteca");
            setEditando(null);
            setFonteDoFormulario(null);
          }}
        />
      ) : (
        <>
          <section className="grid overflow-hidden rounded-[22px] bg-brand-900 text-white sm:grid-cols-2 xl:grid-cols-4">
            {[
              [String(cartoes.length), "cartões"],
              [String(vencidos), "para revisar"],
              [String(revisadosHoje), "revisados hoje"],
              [String(consolidados), "intervalo de 21+ dias"],
            ].map(([valor, rotulo]) => (
              <div key={rotulo} className="border-b border-white/10 p-5 sm:border-r xl:border-b-0">
                <strong className="block text-[1.6rem] tracking-[-0.04em] text-white">{valor}</strong>
                <span className="mt-1 block text-[0.72rem] text-white/55">{rotulo}</span>
              </div>
            ))}
          </section>

          {mensagem && (
            <p role="status" className="rounded-[12px] bg-brand-50 px-4 py-3 text-[0.78rem] text-brand-700">
              {mensagem}
            </p>
          )}

          {cartoes.length === 0 ? (
            <section className="superficie flex flex-col items-start p-7 sm:p-9">
              <span className="rotulo">Primeiro cartão</span>
              <h2 className="mt-1 text-[1.3rem] font-bold text-ink">
                Comece de uma regra que você acabou de ler.
              </h2>
              <p className="mt-2 max-w-[60ch] text-[0.88rem] leading-relaxed text-body">
                No Caderno de Lei Seca, cada destaque pode virar um cartão com
                fonte em um clique. Você também pode criar uma anotação pessoal.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href="/app/lei-seca" className="rounded-full bg-ouro-400 px-5 py-2.5 text-[0.8rem] font-bold text-noite">
                  Abrir caderno de lei seca
                </Link>
                <button type="button" onClick={abrirNovo} className="rounded-full border border-hairline px-5 py-2.5 text-[0.8rem] font-semibold text-ink">
                  Criar cartão pessoal
                </button>
              </div>
            </section>
          ) : (
            <>
              <section className="superficie flex flex-wrap items-center gap-3 p-4 sm:p-5">
                <label className="min-w-[240px] flex-1">
                  <span className="sr-only">Buscar nos flashcards</span>
                  <input
                    type="search"
                    value={busca}
                    onChange={(evento) => setBusca(evento.target.value)}
                    placeholder="Buscar na frente, resposta ou fonte…"
                    className="w-full rounded-[12px] border border-hairline bg-paper px-4 py-3 text-[0.82rem] text-ink outline-none focus:border-brand-300"
                  />
                </label>
                <span className="text-[0.72rem] text-muted">
                  {vinculados} com fonte · {cartoes.length - vinculados} pessoais
                </span>
              </section>

              {visiveis.length === 0 ? (
                <p className="superficie p-6 text-[0.84rem] text-muted">Nenhum cartão corresponde à busca.</p>
              ) : (
                <section className="grid gap-4 lg:grid-cols-2">
                  {visiveis.map((cartao) => {
                    const vencido = !cartao.suspenso && cartao.proximaRevisao <= hoje;
                    return (
                      <article key={cartao.id} className={`superficie flex flex-col overflow-hidden ${vencido ? "ring-1 ring-ouro-300" : ""}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper px-5 py-3.5">
                          <span className={`rounded-full px-2.5 py-1 text-[0.66rem] font-bold ${cartao.fonte ? "bg-brand-100 text-brand-700" : "bg-sunk text-muted"}`}>
                            {cartao.fonte?.rotulo ?? "Anotação pessoal"}
                          </span>
                          <span className={`text-[0.68rem] font-semibold ${vencido ? "text-vinho-600" : "text-muted"}`}>
                            {cartao.suspenso
                              ? "pausado"
                              : vencido
                                ? "revisar agora"
                                : `volta em ${formatarData(cartao.proximaRevisao)}`}
                          </span>
                        </div>
                        <div className="flex flex-1 flex-col p-5">
                          <span className="text-[0.64rem] font-bold tracking-[0.1em] text-muted uppercase">Frente</span>
                          <h2 className="mt-1.5 text-[1rem] leading-snug font-bold text-ink">{cartao.frente}</h2>
                          <p className="mt-3 line-clamp-3 whitespace-pre-line text-[0.8rem] leading-relaxed text-body">{cartao.verso}</p>
                          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[0.68rem] text-muted">
                            <span>{cartao.revisoesTotal} revisões</span>
                            <span>intervalo {cartao.intervaloDias}d</span>
                            {cartao.trechoFonte && <span>trecho literal preservado</span>}
                          </div>
                          <div className="mt-5 flex flex-wrap items-center gap-2">
                            <button type="button" onClick={() => abrirEdicao(cartao)} className="rounded-full border border-brand-200 px-3.5 py-2 text-[0.72rem] font-semibold text-brand-700">Editar</button>
                            <button type="button" onClick={() => void alternarSuspensao(cartao)} className="rounded-full px-3 py-2 text-[0.72rem] font-semibold text-muted">{cartao.suspenso ? "Retomar" : "Pausar"}</button>
                            <button type="button" onClick={() => void excluir(cartao)} className="rounded-full px-3 py-2 text-[0.72rem] font-semibold text-vinho-600">Excluir</button>
                            {cartao.fonte && <Link href={cartao.fonte.href} className="ml-auto text-[0.72rem] font-semibold text-brand-700 underline decoration-brand-200 underline-offset-4">Fonte →</Link>}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
