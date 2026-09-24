import { siteConfig } from "./config.js";
import {
  getDetailedCartItems,
  getCartTotal,
  isCartEmpty
} from "./cart.js";

/**
 * Formata valores em Real.
 *
 * Exemplo:
 * 15 -> R$ 15,00
 */
export function formatCurrency(value) {
  return new Intl.NumberFormat(siteConfig.locale, {
    style: "currency",
    currency: siteConfig.currency
  }).format(value);
}

/**
 * Remove qualquer caractere que não seja número
 * do telefone do WhatsApp.
 */
function sanitizeWhatsAppNumber(number) {
  return String(number).replace(/\D/g, "");
}

/**
 * Verifica se o número configurado parece válido.
 */
function hasValidWhatsAppNumber() {
  const number = sanitizeWhatsAppNumber(
    siteConfig.whatsappNumber
  );

  return number.length >= 10 && number.length <= 15;
}

/**
 * Cria a mensagem completa do pedido.
 */
export function buildWhatsAppMessage(observations = "", quote = null) {
  if (isCartEmpty()) {
    return "";
  }

  const items = quote ? quote.lines.map((line) => ({
    quantity: line.quantity, subtotal: line.subtotalCents / 100,
    product: { name: line.name + (line.variantName ? ` — ${line.variantName}` : ""), components: line.components }
  })) : getDetailedCartItems();
  const total = quote ? quote.totalCents / 100 : getCartTotal();

  const lines = [];

  lines.push(
    `Olá! Vim pelo site da ${siteConfig.brandName} e gostaria de fazer este pedido:`
  );

  lines.push("");

  items.forEach((item) => {
    lines.push(
      `${item.quantity}x ${item.product.name} — ${formatCurrency(item.subtotal)}`
    );
    if (item.product.components?.length) {
      lines.push("  Composição de cada kit:");
      item.product.components.forEach((part) => lines.push(`  • ${part.quantity}x ${part.name}${part.variantName ? ` — ${part.variantName}` : ""}`));
    }
  });

  lines.push("");
  lines.push(`Total: ${formatCurrency(total)}`);

  const cleanObservations = String(observations).trim();

  if (cleanObservations) {
    lines.push("");
    lines.push("Observações:");
    lines.push(cleanObservations);
  }

  return lines.join("\n");
}

/**
 * Gera a URL que será aberta no WhatsApp.
 */
export function buildWhatsAppUrl(observations = "", quote = null) {
  if (isCartEmpty()) {
    return null;
  }

  if (!hasValidWhatsAppNumber()) {
    console.error(
      "O número do WhatsApp ainda não foi configurado corretamente."
    );

    return null;
  }

  const number = sanitizeWhatsAppNumber(
    siteConfig.whatsappNumber
  );

  const message = buildWhatsAppMessage(observations, quote);

  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/**
 * Abre o WhatsApp com o pedido pronto.
 *
 * Retorna true se conseguiu iniciar a abertura
 * e false caso exista algum problema.
 */
export function openWhatsAppOrder(observations = "", quote = null) {
  const url = buildWhatsAppUrl(observations, quote);

  if (!url) {
    return false;
  }

  // A conferência online é assíncrona; navegar evita bloqueio de pop-ups no celular.
  window.location.assign(url);

  return true;
}
