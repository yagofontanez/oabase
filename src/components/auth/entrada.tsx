import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/wordmark";
import { MovimentoEntrada } from "./movimento-entrada";
import styles from "./entrada.module.css";

/** Um caminho contínuo: o que já foi estudado sustenta o próximo passo.
 * A cena é SVG estático no servidor; só o ponto de luz se desloca via CSS. */
function Caminho() {
  const percurso = "M-40 364H50Q88 364 88 326V304Q88 266 126 266H220Q258 266 258 228V204Q258 166 296 166H388Q426 166 426 128V102Q426 64 464 64H560";

  return (
    <div className={styles.scene} aria-hidden="true">
      <div className={styles.sceneLight} />
      <svg className={styles.map} viewBox="0 0 520 420" fill="none">
        <defs>
          <linearGradient id="entrada-traco" x1="50" y1="364" x2="426" y2="64" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--color-brand-400)" stopOpacity="0.15" />
            <stop offset="0.6" stopColor="var(--color-brand-200)" />
            <stop offset="1" stopColor="var(--color-ouro-400)" />
          </linearGradient>
          <pattern id="entrada-grade" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" stroke="var(--color-brand-200)" strokeOpacity="0.055" />
          </pattern>
        </defs>
        <rect width="520" height="420" fill="url(#entrada-grade)" />
        <g stroke="var(--color-brand-200)" strokeWidth="1">
          {[-36, -24, -12, 12, 24, 36].map((offset) => (
            <path key={offset} d={percurso} transform={`translate(0 ${offset})`} opacity={Math.abs(offset) === 12 ? 0.12 : 0.055} />
          ))}
        </g>
        <path d={percurso} stroke="var(--color-brand-200)" strokeOpacity="0.18" strokeWidth="1.5" />
        <path className={styles.draw} d={percurso} stroke="url(#entrada-traco)" strokeWidth="2" pathLength="1" />
        <path d="M88 312H152M258 224H320M362 108H426" stroke="var(--color-brand-200)" strokeOpacity="0.2" strokeDasharray="2 5" />
        <circle cx="88" cy="312" r="9" fill="var(--color-brand-900)" stroke="var(--color-brand-300)" />
        <path d="m84 312 3 3 5-6" stroke="var(--color-brand-200)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle className={styles.beacon} cx="258" cy="224" r="24" fill="var(--color-ouro-400)" fillOpacity="0.07" stroke="var(--color-ouro-400)" strokeOpacity="0.18" />
        <circle cx="258" cy="224" r="12" fill="var(--color-brand-900)" stroke="var(--color-ouro-400)" />
        <circle cx="258" cy="224" r="4" fill="var(--color-ouro-400)" />
        <circle cx="426" cy="108" r="8" fill="var(--color-brand-900)" stroke="var(--color-brand-200)" strokeOpacity="0.6" />
        <circle cx="426" cy="108" r="2" fill="var(--color-brand-200)" />
        <circle className={styles.traveler} r="3" fill="var(--color-ouro-200)" />
        <g fill="var(--color-brand-200)" opacity="0.3">
          <path d="M76 80v8m-4-4h8M456 344v8m-4-4h8M196 36v8m-4-4h8" />
        </g>
      </svg>
      <span className={`${styles.annotation} ${styles.past}`}>Cada descoberta</span>
      <span className={`${styles.annotation} ${styles.present}`}><i />Seu próximo passo</span>
      <span className={`${styles.annotation} ${styles.future}`}>Novas possibilidades</span>
      <span className={styles.sceneCaption}>UM CAMINHO QUE SE CONSTRÓI COM VOCÊ</span>
    </div>
  );
}

/** O cadastro é o ponto de partida: de um marco só, os ramos crescem até o
 * que a conta abre. Mesmo vocabulário visual do login (grade, marcos, luz
 * ouro), outro movimento — lá um caminho percorrido, aqui um que se abre. */
const RAMOS = [
  { d: "M90 330C110 220 170 110 250 90", x: 250, y: 90, rotulo: "Questões oficiais" },
  { d: "M90 330C170 250 300 140 420 120", x: 420, y: 120, rotulo: "Lei seca" },
  { d: "M90 330C200 300 330 250 455 250", x: 455, y: 250, rotulo: "Simulados" },
  { d: "M90 330C200 362 300 352 400 345", x: 400, y: 345, rotulo: "Revisão" },
];

function Ramificacao() {
  return (
    <div className={`${styles.scene} ${styles.sceneRamos}`} aria-hidden="true">
      <div className={styles.sceneLight} />
      <svg className={styles.map} viewBox="0 0 520 420" fill="none">
        <defs>
          <linearGradient id="entrada-ramo" x1="90" y1="330" x2="455" y2="90" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--color-ouro-400)" />
            <stop offset="0.45" stopColor="var(--color-brand-200)" />
            <stop offset="1" stopColor="var(--color-brand-300)" stopOpacity="0.5" />
          </linearGradient>
          <pattern id="entrada-grade-ramos" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" stroke="var(--color-brand-200)" strokeOpacity="0.055" />
          </pattern>
        </defs>
        <rect width="520" height="420" fill="url(#entrada-grade-ramos)" />
        <g stroke="var(--color-brand-200)" strokeDasharray="2 6">
          {[70, 150, 240, 340].map((r, i) => (
            <circle key={r} cx="90" cy="330" r={r} strokeOpacity={0.14 - i * 0.025} />
          ))}
        </g>
        {RAMOS.map((ramo, i) => (
          <path key={ramo.rotulo} className={styles.branch} d={ramo.d} stroke="url(#entrada-ramo)" strokeWidth="1.75" strokeLinecap="round" pathLength="1" style={{ animationDelay: `${300 + i * 220}ms` }} />
        ))}
        {RAMOS.map((ramo, i) => (
          <g key={ramo.rotulo} className={styles.node} style={{ animationDelay: `${1100 + i * 220}ms, ${2400 + i * 1300}ms` }}>
            <circle cx={ramo.x} cy={ramo.y} r="18" fill="var(--color-brand-300)" fillOpacity="0.06" />
            <circle cx={ramo.x} cy={ramo.y} r="8" fill="var(--color-brand-900)" stroke="var(--color-brand-200)" strokeOpacity="0.7" />
            <circle cx={ramo.x} cy={ramo.y} r="2.5" fill="var(--color-brand-100)" />
          </g>
        ))}
        {RAMOS.map((ramo, i) => (
          <circle key={ramo.rotulo} className={styles.spark} r="3" fill="var(--color-ouro-200)" style={{ offsetPath: `path("${ramo.d}")`, animationDelay: `${2400 + i * 1300}ms` }} />
        ))}
        <circle className={styles.ripple} cx="90" cy="330" r="16" stroke="var(--color-ouro-400)" />
        <circle className={styles.ripple} cx="90" cy="330" r="16" stroke="var(--color-ouro-400)" style={{ animationDelay: "2.6s" }} />
        <circle cx="90" cy="330" r="13" fill="var(--color-brand-900)" stroke="var(--color-ouro-400)" />
        <circle cx="90" cy="330" r="4.5" fill="var(--color-ouro-400)" />
      </svg>
      {RAMOS.map((ramo, i) => (
        <span key={ramo.rotulo} className={`${styles.annotation} ${styles.branchLabel}`} style={{ left: `${(ramo.x / 520) * 100}%`, top: `${(ramo.y / 420) * 100}%`, animationDelay: `${1250 + i * 220}ms` }}>
          {ramo.rotulo}
        </span>
      ))}
      <span className={`${styles.annotation} ${styles.origin}`}><i />Seu primeiro passo</span>
      <span className={styles.sceneCaption}>TUDO PARTE DO PRIMEIRO PASSO</span>
    </div>
  );
}

type Cabecalho = { eyebrow: string; titulo: ReactNode; descricao?: string };

const CABECALHOS: Record<"entrar" | "criar", Cabecalho> = {
  entrar: { eyebrow: "BOM TER VOCÊ POR AQUI", titulo: <>Continue de<br />onde parou</>, descricao: "Seu próximo passo começa aqui." },
  criar: { eyebrow: "CONTA GRATUITA · SEM CARTÃO", titulo: <>Seu caminho <br />começa aqui</>, descricao: "Organize seus estudos. Avance no seu ritmo." },
};

/**
 * Moldura das telas de conta: entrar, criar conta, recuperar e redefinir a
 * senha e autorizar um assistente. Entrar e criar têm o texto próprio aqui;
 * as demais passam `cabecalho` e `rodape`. Só o cadastro troca a cena e o
 * lado do formulário — o resto é acesso a uma conta que já existe.
 */
export function Entrada({
  children,
  variante = "entrar",
  cabecalho,
  rodape,
}: {
  children: ReactNode;
  variante?: "entrar" | "criar";
  cabecalho?: Cabecalho;
  rodape?: ReactNode;
}) {
  const criando = variante === "criar";
  const topo = cabecalho ?? CABECALHOS[variante];
  const linhaFinal = rodape === undefined
    ? <>{criando ? "Já tem conta?" : "Ainda não tem conta?"} <Link href={criando ? "/entrar" : "/criar-conta"} className={styles.textLink}>{criando ? "Entre e continue" : "Crie sua conta"} <span aria-hidden="true">↗</span></Link></>
    : rodape;
  return (
    <section className={`${styles.entrance} ${criando ? styles.registration : ""}`} data-entrada>
      <aside className={styles.brand} aria-label="Direito se estuda com direção">
        <div className={styles.brandTop}>
          <Link href="/" aria-label="OABase, página inicial" className={styles.brandLink}>
            <Wordmark tom="claro" />
          </Link>
          <span className={styles.brandEdition}>SEU ESPAÇO DE ESTUDO</span>
        </div>
        <div className={styles.brandBody}>
          <div className={styles.manifesto}>
            <span className={styles.eyebrow}><i />Da primeira prova à OAB</span>
            <h2>Direito se estuda<br />com <span>direção.<svg viewBox="0 0 230 12" fill="none" aria-hidden="true"><path d="M2 9C58 2 141 1 228 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></span></h2>
            <p>{criando ? <>A primeira decisão é começar.<br />O próximo passo, a gente organiza.</> : <>Um passo de cada vez.<br />Todo o seu estudo no mesmo lugar.</>}</p>
          </div>
          {criando ? <Ramificacao /> : <Caminho />}
        </div>
        <div className={styles.brandBottom}>
          <span>Seu ritmo. Seu caminho.</span>
          <MovimentoEntrada />
        </div>
      </aside>

      <div className={styles.access}>
        <header className={styles.accessHeader}>
          <Link href="/" aria-label="OABase, página inicial" className={styles.mobileLogo}><Wordmark /></Link>
          <Link href="/" className={styles.backLink}><span aria-hidden="true">←</span> Voltar ao site</Link>
        </header>
        <div className={styles.formArea}>
          <div className={styles.mobilePath} aria-hidden="true"><span /><span /><span /></div>
          <div className={styles.formHeading}>
            <span className={styles.formEyebrow}>{topo.eyebrow}</span>
            <h1>{topo.titulo}<span>.</span></h1>
            {topo.descricao && <p>{topo.descricao}</p>}
          </div>
          {children}
          {linhaFinal && <p className={styles.createAccount}>{linhaFinal}</p>}
        </div>
        <footer className={styles.footer}>
          <span>OABase · Estudo com direção</span>
          <nav aria-label="Informações legais"><Link href="/privacidade">Privacidade</Link><span aria-hidden="true">·</span><Link href="/termos">Termos</Link></nav>
        </footer>
      </div>
    </section>
  );
}
