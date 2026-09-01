/**
 * Modelos de e-mail.
 *
 * HTML escrito à mão, com tabela e estilo em atributo. Não é preguiça nem
 * nostalgia: cliente de e-mail não é navegador. O Outlook renderiza com o
 * motor do Word, o Gmail remove `<style>` de dentro do corpo em boa parte dos
 * casos e ninguém suporta flexbox de forma confiável. Framework de e-mail
 * resolveria isso gerando exatamente este HTML — a um custo de dependência
 * que três mensagens não justificam.
 *
 * Regras que valem para todas:
 *
 * - **Uma mensagem, uma ação.** E-mail com três botões não tem nenhum.
 * - **O assunto diz o que aconteceu**, não o que a marca quer vender.
 * - **Versão em texto sempre**, e escrita, não gerada por remoção de tags.
 * - Nada de imagem carregada de fora: cliente bloqueia por padrão, e um
 *   e-mail que só faz sentido com as imagens ligadas não faz sentido.
 */

import { formatarData } from "@/lib/format";

const ESMERALDA = "#0b6250";
const TINTA = "#16201d";
const CORPO = "#4c5a55";
const SUAVE = "#7c8a85";
const LINHA = "#e3eae6";
const PAPEL = "#f5f8f6";

const FONTE =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function moldura(conteudo: string, rodape: string) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
</head>
<body style="margin:0;padding:0;background:${PAPEL};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPEL};padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid ${LINHA};border-radius:16px;">
      <tr><td style="padding:28px 32px 0 32px;">
        <span style="font-family:${FONTE};font-size:20px;font-weight:800;letter-spacing:-0.6px;color:${TINTA};">OA<span style="color:${ESMERALDA};">Base</span></span>
      </td></tr>
      <tr><td style="padding:20px 32px 28px 32px;font-family:${FONTE};font-size:15px;line-height:1.6;color:${CORPO};">
        ${conteudo}
      </td></tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
      <tr><td style="padding:18px 32px;font-family:${FONTE};font-size:12px;line-height:1.6;color:${SUAVE};">
        ${rodape}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function botao(href: string, rotulo: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px 0;">
  <tr><td style="background:${ESMERALDA};border-radius:999px;">
    <a href="${href}" style="display:inline-block;padding:13px 26px;font-family:${FONTE};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${rotulo}</a>
  </td></tr>
</table>`;
}

function titulo(texto: string) {
  return `<h1 style="margin:0 0 12px 0;font-family:${FONTE};font-size:21px;line-height:1.3;font-weight:700;color:${TINTA};">${texto}</h1>`;
}

const RODAPE_PADRAO = `OABase · legislação e provas da OAB.<br>
Você recebeu este e-mail porque tem uma conta no OABase.`;

/* ------------------------------------------------------------------ */

export type Modelo = { assunto: string; html: string; texto: string };

/**
 * Compra confirmada.
 *
 * Disparado pelo webhook da Asaas, no mesmo instante em que a assinatura
 * nasce. Até existir, alguém pagava e não recebia confirmação nenhuma do
 * OABase — só o comprovante do gateway, que não diz o que foi liberado.
 */
export function compraConfirmada(dados: {
  nome: string;
  plano: string;
  validoAte: string;
  site: string;
}): Modelo {
  const ate = formatarData(dados.validoAte.slice(0, 10));
  const conteudo = `
${titulo("Seu plano está ativo")}
<p style="margin:0 0 12px 0;">Olá, ${dados.nome}. O pagamento foi confirmado e o plano <strong style="color:${TINTA};">${dados.plano}</strong> já está liberado na sua conta.</p>
<p style="margin:0 0 4px 0;">Acesso válido até <strong style="color:${TINTA};">${ate}</strong>. Sem renovação automática — nada é cobrado de novo sem você pedir.</p>
${botao(`${dados.site}/app/questoes`, "Começar a resolver questões")}
<p style="margin:16px 0 0 0;font-size:14px;color:${SUAVE};">Liberou: o banco de questões com gabarito oficial da FGV, o simulado cronometrado, o caderno de erros e a revisão espaçada.</p>`;

  const texto = `Olá, ${dados.nome}.

O pagamento foi confirmado e o plano ${dados.plano} já está liberado na sua conta.
Acesso válido até ${ate}. Sem renovação automática.

Começar a resolver: ${dados.site}/app/questoes

Liberou: banco de questões com gabarito oficial da FGV, simulado cronometrado,
caderno de erros e revisão espaçada.

— OABase`;

  return {
    assunto: `Plano ${dados.plano} ativo até ${ate}`,
    html: moldura(conteudo, RODAPE_PADRAO),
    texto,
  };
}

/**
 * Revisão do dia.
 *
 * A fila de `revisoes` enche sozinha e, sem aviso, só é vista por quem já tem
 * o hábito de abrir o app — que é justamente quem menos precisa do lembrete.
 * O número no assunto é o conteúdo: quem não quiser abrir já sabe o tamanho
 * do que está deixando passar.
 */
export function revisaoDoDia(dados: {
  nome: string;
  questoes: number;
  diasAteProva: number;
  site: string;
}): Modelo {
  const plural = dados.questoes === 1 ? "questão" : "questões";
  const conteudo = `
${titulo(`${dados.questoes} ${plural} para revisar hoje`)}
<p style="margin:0 0 12px 0;">Olá, ${dados.nome}. A repetição espaçada marcou ${dados.questoes} ${plural} para hoje — são as que você errou ou acertou com dificuldade, no intervalo em que a memória começa a falhar.</p>
<p style="margin:0;">Faltam <strong style="color:${TINTA};">${dados.diasAteProva} dias</strong> para a prova.</p>
${botao(`${dados.site}/app/questoes?modo=revisao`, "Revisar agora")}
<p style="margin:16px 0 0 0;font-size:14px;color:${SUAVE};">Acertar afasta a próxima revisão; errar aproxima. Em dez minutos a fila zera.</p>`;

  const texto = `Olá, ${dados.nome}.

A repetição espaçada marcou ${dados.questoes} ${plural} para hoje.
Faltam ${dados.diasAteProva} dias para a prova.

Revisar agora: ${dados.site}/app/questoes?modo=revisao

Acertar afasta a próxima revisão; errar aproxima.

— OABase`;

  return {
    assunto: `${dados.questoes} ${plural} para revisar hoje`,
    html: moldura(
      conteudo,
      `${RODAPE_PADRAO}<br><a href="${dados.site}/app/configuracoes" style="color:${SUAVE};">Desativar os lembretes de revisão</a>`,
    ),
    texto: `${texto}\n\nDesativar lembretes: ${dados.site}/app/configuracoes`,
  };
}

/**
 * Plano acabando.
 *
 * Enviado uma vez, com antecedência suficiente para decidir sem pressa. Não é
 * cobrança: se a prova da pessoa já passou, o certo é ela não renovar, e o
 * texto não finge o contrário.
 */
export function planoAcabando(dados: {
  nome: string;
  plano: string;
  validoAte: string;
  diasRestantes: number;
  site: string;
}): Modelo {
  const ate = formatarData(dados.validoAte.slice(0, 10));
  const conteudo = `
${titulo(`Seu plano acaba em ${dados.diasRestantes} dias`)}
<p style="margin:0 0 12px 0;">Olá, ${dados.nome}. O plano <strong style="color:${TINTA};">${dados.plano}</strong> vale até ${ate}. Depois disso o banco de questões, o simulado e o caderno de erros deixam de abrir.</p>
<p style="margin:0;">Seu histórico não some: respostas, revisões e anotações continuam guardadas e voltam a aparecer se você renovar.</p>
${botao(`${dados.site}/app/assinar`, "Renovar o acesso")}
<p style="margin:16px 0 0 0;font-size:14px;color:${SUAVE};">Se a sua prova já passou, ignore este e-mail — não há cobrança automática, e a legislação comentada do site continua aberta de qualquer forma.</p>`;

  const texto = `Olá, ${dados.nome}.

O plano ${dados.plano} vale até ${ate} — faltam ${dados.diasRestantes} dias.
Depois disso o banco de questões, o simulado e o caderno de erros deixam de abrir.
Seu histórico não some.

Renovar: ${dados.site}/app/assinar

Se a sua prova já passou, ignore este e-mail: não há cobrança automática.

— OABase`;

  return {
    assunto: `Seu plano OABase acaba em ${dados.diasRestantes} dias`,
    html: moldura(conteudo, RODAPE_PADRAO),
    texto,
  };
}
