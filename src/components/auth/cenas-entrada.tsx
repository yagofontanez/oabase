import styles from "./entrada.module.css";

/**
 * Cenas das telas de conta que não são entrar nem criar. Cada uma conta o que
 * a tela faz, no mesmo vocabulário das outras duas — grade, marcos, luz ouro
 * — e com o mesmo contrato: SVG estático do servidor, movimento só por CSS,
 * parado pelo botão "Pausar movimento" e por `prefers-reduced-motion`.
 */

function Grade({ id }: { id: string }) {
  return (
    <>
      <defs>
        <pattern id={id} width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" stroke="var(--color-brand-200)" strokeOpacity="0.055" />
        </pattern>
      </defs>
      <rect width="520" height="420" fill={`url(#${id})`} />
    </>
  );
}

const pos = (x: number, y: number) => ({ left: `${(x / 520) * 100}%`, top: `${(y / 420) * 100}%` });

/** Recuperar a senha: o link sai do pedido e chega à caixa de entrada. */
const ARCO = "M100 300C170 150 290 90 372 128";

export function CenaEnvio() {
  return (
    <div className={styles.scene} aria-hidden="true">
      <div className={styles.sceneLight} />
      <svg className={styles.map} viewBox="0 0 520 420" fill="none">
        <Grade id="entrada-grade-envio" />
        <path d={ARCO} stroke="var(--color-brand-200)" strokeOpacity="0.14" strokeWidth="10" strokeLinecap="round" />
        <path className={styles.flow} d={ARCO} stroke="var(--color-brand-200)" strokeOpacity="0.55" strokeWidth="1.5" strokeDasharray="3 7" strokeLinecap="round" />
        <circle className={styles.ripple} cx="100" cy="300" r="14" stroke="var(--color-ouro-400)" />
        <circle cx="100" cy="300" r="12" fill="var(--color-brand-900)" stroke="var(--color-ouro-400)" />
        <circle cx="100" cy="300" r="4" fill="var(--color-ouro-400)" />
        <g className={styles.packet} style={{ offsetPath: `path("${ARCO}")` }}>
          <rect x="-9" y="-6.5" width="18" height="13" rx="2.5" fill="var(--color-ouro-200)" />
          <path d="m-8 -5 8 6 8 -6" stroke="var(--color-brand-900)" strokeWidth="1.3" strokeLinejoin="round" />
        </g>
        <g className={styles.mailbox}>
          <rect x="378" y="98" width="76" height="56" rx="10" fill="var(--color-brand-900)" stroke="var(--color-brand-200)" strokeOpacity="0.7" strokeWidth="1.5" />
          <path d="m382 104 34 26 34-26" stroke="var(--color-brand-200)" strokeOpacity="0.7" strokeWidth="1.5" strokeLinejoin="round" />
        </g>
        <circle className={styles.badge} cx="452" cy="100" r="7" fill="var(--color-ouro-400)" stroke="var(--color-brand-900)" strokeWidth="3" />
        <g stroke="var(--color-brand-200)" strokeOpacity="0.35">
          <circle cx="416" cy="222" r="15" />
          <path d="M416 213v9l6 4" strokeLinecap="round" />
        </g>
      </svg>
      <span className={`${styles.annotation} ${styles.origin}`} style={{ top: "calc(300 / 420 * 100% + 22px)", left: "calc(100 / 520 * 100% - 12px)" }}><i />Seu pedido</span>
      <span className={`${styles.annotation} ${styles.branchLabel}`} style={{ ...pos(416, 98), animationDelay: "400ms" }}>Sua caixa de entrada</span>
      <span className={`${styles.annotation} ${styles.sideLabel}`} style={pos(440, 222)}>Link válido por 1 hora</span>
      <span className={styles.sceneCaption}>O LINK CHEGA ONDE VOCÊ ESTÁ</span>
    </div>
  );
}

/** Redefinir: oito pontos acendem em volta do cadeado, e ele fecha. */
const PONTOS = Array.from({ length: 8 }, (_, i) => {
  const angulo = -Math.PI / 2 + (i * Math.PI) / 4;
  return { x: +(260 + 118 * Math.cos(angulo)).toFixed(1), y: +(222 + 118 * Math.sin(angulo)).toFixed(1) };
});

export function CenaChave() {
  return (
    <div className={styles.scene} aria-hidden="true">
      <div className={styles.sceneLight} />
      <svg className={styles.map} viewBox="0 0 520 420" fill="none">
        <Grade id="entrada-grade-chave" />
        <circle cx="260" cy="222" r="118" stroke="var(--color-brand-200)" strokeOpacity="0.12" strokeDasharray="2 6" />
        <circle className={styles.dial} cx="260" cy="222" r="150" stroke="var(--color-brand-200)" strokeOpacity="0.07" strokeDasharray="1 11" />
        {PONTOS.map((p, i) => (
          <circle key={i} className={styles.digit} cx={p.x} cy={p.y} r="6" style={{ animationDelay: `${i * 280}ms` }} />
        ))}
        <path className={styles.shackle} d="M232 206v-26a28 28 0 0 1 56 0v26" stroke="var(--color-brand-200)" strokeWidth="7" strokeLinecap="round" />
        <rect className={styles.lockBody} x="214" y="200" width="92" height="74" rx="14" fill="var(--color-brand-900)" strokeWidth="1.5" />
        <circle cx="260" cy="230" r="7" fill="var(--color-ouro-400)" />
        <path d="M260 234v14" stroke="var(--color-ouro-400)" strokeWidth="5" strokeLinecap="round" />
      </svg>
      <span className={`${styles.annotation} ${styles.branchLabel}`} style={{ ...pos(260, 104), animationDelay: "300ms" }}>8 caracteres ou mais</span>
      <span className={`${styles.annotation} ${styles.origin}`} style={{ ...pos(260, 362), translate: "-50% 0" }}><i />Seu progresso continua aqui</span>
      <span className={styles.sceneCaption}>O MESMO ESTUDO, UMA CHAVE NOVA</span>
    </div>
  );
}

/** Autorizar assistente: os dois lados trocam sinal, e o escudo no meio decide. */
const IDA = "M150 214C205 150 315 150 370 214";
const VOLTA = "M370 246C315 310 205 310 150 246";

export function CenaConexao() {
  return (
    <div className={styles.scene} aria-hidden="true">
      <div className={styles.sceneLight} />
      <svg className={styles.map} viewBox="0 0 520 420" fill="none">
        <Grade id="entrada-grade-conexao" />
        {[IDA, VOLTA].map((d) => (
          <path key={d} className={styles.flow} d={d} stroke="var(--color-brand-200)" strokeOpacity="0.4" strokeWidth="1.25" strokeDasharray="3 7" strokeLinecap="round" />
        ))}
        <circle className={styles.spark} r="3.5" fill="var(--color-ouro-200)" style={{ offsetPath: `path("${IDA}")`, animationDuration: "3.6s", animationDelay: "1s" }} />
        <circle className={styles.spark} r="3.5" fill="var(--color-brand-100)" style={{ offsetPath: `path("${VOLTA}")`, animationDuration: "3.6s", animationDelay: "2.8s" }} />
        <g>
          <rect x="62" y="184" width="88" height="92" rx="20" fill="var(--color-brand-900)" stroke="var(--color-brand-200)" strokeOpacity="0.6" strokeWidth="1.5" />
          <path d="M106 212l4.5 11.5L122 228l-11.5 4.5L106 244l-4.5-11.5L90 228l11.5-4.5Z" fill="var(--color-brand-200)" fillOpacity="0.85" />
        </g>
        <g>
          <rect x="370" y="184" width="88" height="92" rx="20" fill="var(--color-brand-900)" stroke="var(--color-ouro-400)" strokeOpacity="0.8" strokeWidth="1.5" />
          <text x="414" y="237" textAnchor="middle" fill="var(--color-surface)" fontSize="22" fontWeight="800" letterSpacing="-1">OA</text>
        </g>
        <circle className={styles.beacon} cx="260" cy="230" r="34" fill="var(--color-ouro-400)" fillOpacity="0.06" stroke="var(--color-ouro-400)" strokeOpacity="0.18" />
        <path d="M260 208l20 7v14c0 13-8.5 21-20 25-11.5-4-20-12-20-25v-14Z" fill="var(--color-brand-900)" stroke="var(--color-ouro-400)" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="m252 231 6 6 10-12" stroke="var(--color-ouro-200)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={`${styles.annotation} ${styles.underLabel}`} style={pos(106, 290)}>Seu assistente</span>
      <span className={`${styles.annotation} ${styles.underLabel}`} style={pos(414, 290)}>Sua conta OABase</span>
      <span className={`${styles.annotation} ${styles.origin}`} style={{ ...pos(260, 120), translate: "-50% 0" }}><i />Você decide o acesso</span>
      <span className={styles.sceneCaption}>CONECTADO SÓ COM A SUA PERMISSÃO</span>
    </div>
  );
}
