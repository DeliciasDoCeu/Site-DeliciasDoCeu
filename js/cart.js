import { siteConfig } from "./config.js";
import { getCatalog, apiUrl } from "./products.js";
import { lineKey, resolveItem, quoteCart } from "./catalog-core.js";

let cart = loadCart();
let lastError = "";
function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(siteConfig.storageKeys.cart) || "[]");
    if (!Array.isArray(saved)) return [];
    const merged = new Map();
    for (const item of saved.slice(0, 100)) {
      if (typeof item.productId !== "string" || !Number.isInteger(item.quantity) || item.quantity <= 0) continue;
      const variantId = typeof item.variantId === "string" ? item.variantId : "";
      const key = lineKey(item.productId, variantId);
      const previous = merged.get(key);
      merged.set(key, { productId: item.productId, variantId, quantity: Math.min(9999, item.quantity + (previous?.quantity || 0)), name: typeof item.name === "string" ? item.name : "Produto indisponível" });
    }
    return [...merged.values()];
  } catch { return []; }
}
function saveCart() {
  try { localStorage.setItem(siteConfig.storageKeys.cart, JSON.stringify(cart)); } catch { /* Carrinho segue disponível nesta sessão. */ }
}
function apply(next) {
  try {
    quoteCart(getCatalog(), next);
    cart = next;
    lastError = "";
    saveCart();
    return true;
  } catch (error) { lastError = error.message; return false; }
}
export const getCart = () => cart.map((line) => ({ ...line }));
export const getLastCartError = () => lastError;
export function getCartError() {
  try { quoteCart(getCatalog(), cart); return ""; } catch (error) { return error.message; }
}
export function addToCart(productId, quantity = 1, variantId = "") {
  const selected = resolveItem(getCatalog(), productId, variantId);
  if (!selected) { lastError = "Escolha um sabor disponível para adicionar este produto."; return false; }
  const safeQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
  const next = getCart();
  const existing = next.find((line) => lineKey(line.productId, line.variantId) === selected.key);
  if (existing) existing.quantity += safeQuantity;
  else next.push({ productId, variantId, quantity: safeQuantity, name: selected.name + (selected.variantName ? ` — ${selected.variantName}` : "") });
  return apply(next);
}
export function setItemQuantity(key, quantity) {
  const value = Math.floor(Number(quantity));
  if (!Number.isFinite(value)) return false;
  if (value <= 0) return removeFromCart(key);
  const next = getCart();
  const item = next.find((line) => lineKey(line.productId, line.variantId) === key);
  if (!item) return false;
  item.quantity = value;
  return apply(next);
}
export function increaseItem(key) {
  const item = cart.find((line) => lineKey(line.productId, line.variantId) === key);
  return item ? setItemQuantity(key, item.quantity + 1) : false;
}
export function decreaseItem(key) {
  const item = cart.find((line) => lineKey(line.productId, line.variantId) === key);
  if (!item) return false;
  if (item.quantity <= 1) return removeFromCart(key);
  item.quantity -= 1;
  saveCart();
  return true;
}
export function removeFromCart(key) {
  const previous = cart.length;
  cart = cart.filter((line) => lineKey(line.productId, line.variantId) !== key);
  saveCart();
  return cart.length !== previous;
}
export function clearCart() { cart = []; lastError = ""; saveCart(); }
export function getDetailedCartItems() {
  return cart.map((line) => {
    const selected = resolveItem(getCatalog(), line.productId, line.variantId);
    return {
      ...line, key: lineKey(line.productId, line.variantId), unavailable: !selected,
      product: selected ? {
        ...selected, name: selected.name + (selected.variantName ? ` — ${selected.variantName}` : ""),
        image: selected.image.startsWith("/media/") ? apiUrl(selected.image) : selected.image,
        price: selected.priceCents / 100, category: selected.kind === "kit" ? "kits" : "doces"
      } : { name: line.name || "Produto indisponível", price: 0, image: "", imageAlt: "", category: "doces", components: [] },
      subtotal: selected ? selected.priceCents * line.quantity / 100 : 0
    };
  });
}
export const getCartItemCount = () => cart.reduce((sum, line) => sum + line.quantity, 0);
export const getCartTotal = () => getDetailedCartItems().reduce((sum, line) => sum + Math.round(line.subtotal * 100), 0) / 100;
export const isCartEmpty = () => cart.length === 0;
