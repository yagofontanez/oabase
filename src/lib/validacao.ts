/** Só os dígitos — é assim que a Asaas espera CPF e telefone. */
export function digitos(valor: string) {
  return valor.replace(/\D/g, "");
}

/**
 * Valida CPF pelos dígitos verificadores.
 *
 * Vale conferir aqui mesmo com a Asaas também validando: o erro dela chega
 * depois de uma ida à rede e com texto genérico. Barrar antes dá a mensagem
 * certa no campo certo, na hora em que a pessoa ainda está digitando.
 */
export function cpfValido(entrada: string) {
  const cpf = digitos(entrada);
  if (cpf.length !== 11) return false;
  // Sequências repetidas passam na conta dos dígitos, mas não são CPF.
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digito = (ate: number) => {
    let soma = 0;
    for (let i = 0; i < ate; i++) {
      soma += Number(cpf[i]) * (ate + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

/** Telefone brasileiro com DDD: 10 dígitos (fixo) ou 11 (celular). */
export function telefoneValido(entrada: string) {
  const tel = digitos(entrada);
  if (tel.length !== 10 && tel.length !== 11) return false;
  const ddd = Number(tel.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  // Celular no Brasil começa com 9 depois do DDD.
  if (tel.length === 11 && tel[2] !== "9") return false;
  return true;
}

export function formatarCpf(entrada: string) {
  const d = digitos(entrada).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

export function formatarTelefone(entrada: string) {
  const d = digitos(entrada).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
