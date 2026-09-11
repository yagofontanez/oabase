"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  LinkDoRoadmap,
  OpcaoDeAnotacao,
  OpcaoDeRevisao,
} from "@/lib/compartilhamento-roadmap";
import { formatarData } from "@/lib/format";
import { supabaseNavegador } from "@/lib/supabase/browser";

function dataComHora(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function estaAtivo(link: LinkDoRoadmap) {
  return !link.revogadoEm && new Date(link.expiraEm).getTime() > Date.now();
}

export function CompartilharRoadmap({
  versao,
  prazo,
  anotacoes,
  revisoes,
  linksIniciais,
}: {
  versao: number;
  prazo: string | null;
  anotacoes: OpcaoDeAnotacao[];
  revisoes: OpcaoDeRevisao[];
  linksIniciais: LinkDoRoadmap[];
}) {
  const [titulo, setTitulo] = useState("Meu roadmap de estudos");
  const [validade, setValidade] = useState(30);
  const [incluirProgresso, setIncluirProgresso] = useState(true);
  const [anotacoesEscolhidas, setAnotacoesEscolhidas] = useState<string[]>([]);
  const [revisoesEscolhidas, setRevisoesEscolhidas] = useState<string[]>([]);
  const [links, setLinks] = useState(linksIniciais);
  const [novoLink, setNovoLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const ativos = useMemo(() => links.filter(estaAtivo).length, [links]);

  function alternar(valor: string, atuais: string[], mudar: (itens: string[]) => void) {
    mudar(atuais.includes(valor) ? atuais.filter((id) => id !== valor) : [...atuais, valor]);
  }

  async function copiar() {
    if (!novoLink) return;
    await navigator.clipboard.writeText(novoLink);
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 2200);
  }

  async function criar() {
    if (salvando || !titulo.trim()) return;
    setSalvando(true);
    setErro(null);
    setNovoLink(null);
    const { data, error } = await supabaseNavegador().rpc(
      "criar_compartilhamento_roadmap",
      {
        p_titulo: titulo.trim(),
        p_validade_dias: validade,
        p_incluir_progresso: incluirProgresso,
        p_anotacoes: anotacoesEscolhidas,
        p_revisoes: revisoesEscolhidas,
        p_prazo: prazo,
      },
    );
    if (error || !data) {
      setErro(error?.message ?? "Não consegui criar o link.");
      setSalvando(false);
      return;
    }
    const resultado = data as { id: string; token: string; expiraEm: string };
    const url = `${window.location.origin}/compartilhar/roadmap/${resultado.token}`;
    setNovoLink(url);
    setLinks((atuais) => [
      {
        id: resultado.id,
        titulo: titulo.trim(),
        versao,
        incluirProgresso,
        anotacoes: anotacoesEscolhidas.length,
        revisoes: revisoesEscolhidas.length,
        expiraEm: resultado.expiraEm,
        revogadoEm: null,
        acessos: 0,
        ultimoAcessoEm: null,
        criadoEm: new Date().toISOString(),
      },
      ...atuais,
    ]);
    setSalvando(false);
  }

  async function revogar(id: string) {
    setErro(null);
    const { data, error } = await supabaseNavegador().rpc(
      "revogar_compartilhamento_roadmap",
      { p_id: id },
    );
    if (error || !data) {
      setErro(error?.message ?? "Não consegui revogar o link.");
      return;
    }
    setLinks((atuais) =>
      atuais.map((link) =>
        link.id === id ? { ...link, revogadoEm: new Date().toISOString() } : link,
      ),
    );
  }

  return (
    <div className="painel-conteudo flex max-w-[1180px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <span className="rotulo">Acompanhamento sem expor sua conta</span>
          <h1 className="mt-1 text-[clamp(1.8rem,3vw,2.45rem)] leading-none font-extrabold tracking-[-0.045em] text-ink">
            Compartilhar roadmap
          </h1>
          <p className="mt-2 max-w-[68ch] text-[0.9rem] leading-relaxed text-body">
            Gere uma visão somente de leitura para professor, mentor ou grupo. Nome, e-mail e conteúdo não escolhido ficam de fora.
          </p>
        </div>
        <Link href="/app/roadmap" className="rounded-full border border-hairline bg-surface px-4 py-2 text-[0.82rem] font-semibold text-ink hover:border-brand-300 hover:text-brand-700">
          Voltar ao roadmap
        </Link>
      </header>

      <section className="grid overflow-hidden rounded-[24px] bg-brand-900 text-white shadow-[0_18px_45px_rgba(8,58,49,.15)] lg:grid-cols-[.82fr_1.18fr]">
        <div className="border-b border-white/10 p-6 sm:p-8 lg:border-r lg:border-b-0">
          <span className="text-[0.72rem] font-bold tracking-[0.14em] text-ouro-200 uppercase">O que o visitante verá</span>
          <h2 className="mt-3 text-[1.65rem] font-extrabold tracking-[-0.035em] text-white">Você abre só a janela que escolher.</h2>
          <p className="mt-3 text-[0.9rem] leading-relaxed text-brand-100">
            O roteiro da versão {versao} entra completo. Progresso, anotações e fechamentos têm controles separados — e o link pode ser desligado na hora.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-2.5 text-[0.78rem]">
            <span className="rounded-[14px] bg-white/8 px-3 py-3"><strong className="block text-white">Privado</strong><span className="text-brand-100">não entra em busca</span></span>
            <span className="rounded-[14px] bg-white/8 px-3 py-3"><strong className="block text-white">Revogável</strong><span className="text-brand-100">você encerra</span></span>
            <span className="rounded-[14px] bg-white/8 px-3 py-3"><strong className="block text-white">Sem identidade</strong><span className="text-brand-100">nenhum perfil</span></span>
            <span className="rounded-[14px] bg-white/8 px-3 py-3"><strong className="block text-white">Com validade</strong><span className="text-brand-100">expira sozinho</span></span>
          </div>
        </div>

        <div className="bg-surface p-6 text-ink sm:p-8">
          <div className="grid gap-5 sm:grid-cols-[1fr_180px]">
            <label className="text-[0.78rem] font-semibold text-body">
              Título do acompanhamento
              <input value={titulo} maxLength={120} onChange={(e) => setTitulo(e.target.value)} className="mt-2 w-full rounded-[12px] border border-hairline bg-white px-3.5 py-3 text-[0.9rem] text-ink outline-none focus:border-brand-400" />
            </label>
            <label className="text-[0.78rem] font-semibold text-body">
              Validade do link
              <select value={validade} onChange={(e) => setValidade(Number(e.target.value))} className="mt-2 w-full rounded-[12px] border border-hairline bg-white px-3.5 py-3 text-[0.9rem] text-ink outline-none focus:border-brand-400">
                <option value={7}>7 dias</option>
                <option value={30}>30 dias</option>
                <option value={90}>90 dias</option>
              </select>
            </label>
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-[14px] border border-brand-100 bg-brand-50 p-4">
            <input type="checkbox" checked={incluirProgresso} onChange={(e) => setIncluirProgresso(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-700" />
            <span><strong className="block text-[0.86rem] text-ink">Mostrar progresso agregado</strong><span className="mt-0.5 block text-[0.76rem] leading-relaxed text-body">Inclui estados dos blocos, tempo de foco, questões e materiais trabalhados.</span></span>
          </label>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <fieldset className="rounded-[16px] border border-hairline p-4">
              <legend className="px-1 text-[0.78rem] font-bold text-ink">Anotações escolhidas <span className="font-normal text-muted">({anotacoesEscolhidas.length})</span></legend>
              <p className="mb-3 text-[0.72rem] leading-relaxed text-muted">Nenhuma é compartilhada por padrão.</p>
              <div className="rolagem-fina flex max-h-52 flex-col gap-2 overflow-y-auto pr-1">
                {anotacoes.length ? anotacoes.map((item) => (
                  <label key={item.id} className="flex cursor-pointer gap-2.5 rounded-[10px] bg-paper p-3">
                    <input type="checkbox" checked={anotacoesEscolhidas.includes(item.id)} onChange={() => alternar(item.id, anotacoesEscolhidas, setAnotacoesEscolhidas)} className="mt-0.5 h-4 w-4 shrink-0 accent-brand-700" />
                    <span className="min-w-0"><strong className="block text-[0.76rem] text-ink">S{item.semana} · {item.disciplina}</strong><span className="mt-0.5 block line-clamp-2 text-[0.7rem] leading-relaxed text-muted">{item.anotacao}</span></span>
                  </label>
                )) : <span className="rounded-[10px] bg-paper p-3 text-[0.74rem] text-muted">Você ainda não salvou anotações nos blocos.</span>}
              </div>
            </fieldset>

            <fieldset className="rounded-[16px] border border-hairline p-4">
              <legend className="px-1 text-[0.78rem] font-bold text-ink">Revisões semanais <span className="font-normal text-muted">({revisoesEscolhidas.length})</span></legend>
              <p className="mb-3 text-[0.72rem] leading-relaxed text-muted">Escolha apenas os fechamentos úteis para o acompanhamento.</p>
              <div className="rolagem-fina flex max-h-52 flex-col gap-2 overflow-y-auto pr-1">
                {revisoes.length ? revisoes.map((item) => (
                  <label key={item.id} className="flex cursor-pointer gap-2.5 rounded-[10px] bg-paper p-3">
                    <input type="checkbox" checked={revisoesEscolhidas.includes(item.id)} onChange={() => alternar(item.id, revisoesEscolhidas, setRevisoesEscolhidas)} className="mt-0.5 h-4 w-4 shrink-0 accent-brand-700" />
                    <span><strong className="block text-[0.76rem] text-ink">{formatarData(item.inicio)} a {formatarData(item.fim)}</strong><span className="mt-0.5 block line-clamp-2 text-[0.7rem] leading-relaxed text-muted">{item.compromisso || "Fechamento sem compromisso escrito"}</span></span>
                  </label>
                )) : <span className="rounded-[10px] bg-paper p-3 text-[0.74rem] text-muted">Feche uma semana para poder compartilhá-la.</span>}
              </div>
            </fieldset>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <span className="text-[0.72rem] text-muted">{ativos}/10 links ativos</span>
            <button type="button" onClick={criar} disabled={salvando || !titulo.trim() || ativos >= 10} className="rounded-full bg-brand-700 px-5 py-2.5 text-[0.82rem] font-bold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50">
              {salvando ? "Protegendo link…" : "Gerar link privado"}
            </button>
          </div>
          {erro && <p role="alert" className="mt-3 text-[0.78rem] font-semibold text-vinho-700">{erro}</p>}
        </div>
      </section>

      {novoLink && (
        <section className="rounded-[20px] border border-ouro-200 bg-ouro-50 p-5 sm:p-6">
          <span className="text-[0.7rem] font-bold tracking-[0.12em] text-ouro-700 uppercase">Copie agora</span>
          <h2 className="mt-1 text-[1.15rem] font-bold text-ink">Este endereço não será exibido novamente.</h2>
          <p className="mt-1 text-[0.78rem] leading-relaxed text-body">Guardamos somente a impressão criptográfica do token. Se perder o endereço, revogue este acesso e gere outro.</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input readOnly value={novoLink} onFocus={(e) => e.currentTarget.select()} aria-label="Link privado criado" className="min-w-0 flex-1 rounded-[12px] border border-ouro-200 bg-white px-3.5 py-3 font-mono text-[0.72rem] text-ink" />
            <button type="button" onClick={copiar} className="rounded-[12px] bg-noite px-5 py-3 text-[0.8rem] font-bold text-white">{copiado ? "Copiado" : "Copiar link"}</button>
          </div>
        </section>
      )}

      <section className="superficie overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <div><span className="rotulo">Controle de acesso</span><h2 className="mt-1 text-[1.2rem] font-bold text-ink">Links criados</h2></div>
          <span className="text-[0.72rem] text-muted">O endereço secreto não fica salvo.</span>
        </div>
        {links.length === 0 ? (
          <p className="p-6 text-[0.86rem] text-body">Nenhum acesso foi criado ainda.</p>
        ) : (
          <div className="divide-y divide-line">
            {links.map((link) => {
              const ativo = estaAtivo(link);
              return (
                <article key={link.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-[0.88rem] text-ink">{link.titulo}</strong>
                      <span className={`rounded-full px-2 py-0.5 text-[0.64rem] font-bold uppercase ${ativo ? "bg-brand-50 text-brand-700" : "bg-sunk text-muted"}`}>{ativo ? "Ativo" : link.revogadoEm ? "Revogado" : "Expirado"}</span>
                    </div>
                    <p className="mt-1 text-[0.72rem] leading-relaxed text-muted">Versão {link.versao} · expira {dataComHora(link.expiraEm)} · {link.acessos} {link.acessos === 1 ? "abertura" : "aberturas"} · {link.anotacoes} {link.anotacoes === 1 ? "nota" : "notas"} · {link.revisoes} {link.revisoes === 1 ? "revisão" : "revisões"}</p>
                    {link.ultimoAcessoEm && <span className="mt-1 block text-[0.68rem] text-muted">Última abertura em {dataComHora(link.ultimoAcessoEm)}</span>}
                  </div>
                  {ativo && <button type="button" onClick={() => revogar(link.id)} className="self-start rounded-full border border-vinho-200 px-3.5 py-2 text-[0.74rem] font-semibold text-vinho-700 hover:bg-vinho-50 sm:self-auto">Revogar agora</button>}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
