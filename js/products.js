import { siteConfig } from "./config.js";
import { seedCatalog } from "./catalog-seed.js";
import { effectivePrice, resolveItem, publicCatalog } from "./catalog-core.js";

export const categories = Object.freeze([
  { id: "todos", name: "Todos" },
  { id: "doces", name: "Doces" },
  { id: "kits", name: "Kits" }
]);
let catalog = structuredClone(seedCatalog);
export let products = [];
export const getCatalog = () => catalog;
const localPreview = () => typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname);
export const apiUrl = (path) => `${localPreview() ? '' : siteConfig.catalogApiUrl || ""}${path}`;

function refreshProducts() {
  products = publicCatalog(catalog).map((item) => {
    const choices = item.variants.length ? item.variants : [item];
    const cheapest = choices.reduce((a, b) => effectivePrice(a) <= effectivePrice(b) ? a : b);
    const availableStock = choices.reduce((total, choice) => total + (resolveItem(catalog, item.id, choice === item ? "" : choice.id)?.available || 0), 0);
    return {
      ...item, category: item.kind === "kit" ? "kits" : "doces",
      image: item.image.startsWith("/media/") ? apiUrl(item.image) : item.image,
      price: effectivePrice(cheapest) / 100, originalPrice: cheapest.priceCents / 100,
      available: true, soldOut: availableStock === 0
    };
  });
}
export async function loadCatalog() {
  if (!siteConfig.catalogApiUrl && !["localhost", "127.0.0.1"].includes(location.hostname)) {
    refreshProducts();
    return;
  }
  const response = await fetch(apiUrl("/api/catalog"), { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("Não foi possível atualizar o cardápio. Tente novamente em instantes.");
  const data = await response.json();
  if (!Array.isArray(data.items)) throw new Error("O cardápio está temporariamente indisponível.");
  catalog = data.items;
  refreshProducts();
}
export const getProductById = (id) => products.find((item) => item.id === id);
export const getAvailableProducts = () => products;
export const getFeaturedProducts = () => products.filter((item) => item.featured);
export const getProductsByCategory = (id) => id === "todos" ? products : products.filter((item) => item.category === id);
refreshProducts();
