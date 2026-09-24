import { validateCatalog, resolveItem, effectivePrice, lineKey } from "./catalog-core.js";
const $ = (id) => document.getElementById(id);
const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const currency = (cents) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const amount = (cents) => cents == null ? "" : (cents / 100).toFixed(2).replace(".", ",");
const stockText = (value) => value == null ? "Sob consulta" : value === 0 ? "Esgotado" : `${value} un. disponíveis`;
const photoUrl = (image) => image.startsWith("./images/") ? "https://delicias-do-ceu.pages.dev/" + image.slice(2) : image;
let state = { items: [], revision: 0, storage: {} };
let tab = "product";
let draft = null;
let busy = false;
let dirty = false;
let photoJob = 0;

async function api(path, options = {}) {
  const response = await fetch(`/api/admin/${path}`, { credentials: "same-origin", cache: "no-store", ...options });
  const data = await response.json().catch(() => ({ error: "Sua sessão expirou. Entre novamente no painel." }));
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a operação.");
  return data;
}
function notice(message, isError = false) {
  $("notice").textContent = message;
  $("notice").classList.toggle("error", isError);
  $("notice").hidden = !message;
}
function fail(message) {
  $("formError").textContent = message;
  $("formError").hidden = false;
  $("formError").scrollIntoView({ block: "nearest" });
}
async function load(message = "") {
  state = await api("catalog");
  $("dashboard").hidden = false;
  notice(message || (state.local ? "Prévia local: as alterações desta tela não são publicadas na loja." : ""));
  render();
}
function render() {
  $("productCount").textContent = state.items.filter((item) => item.active && item.kind === "product").length;
  $("kitCount").textContent = state.items.filter((item) => item.active && item.kind === "kit").length;
  $("storageValue").textContent = `${(state.storage.bytes / 1000000).toFixed(1).replace(".", ",")} MB`;
  $("storageProgress").value = state.storage.percent;
  $("storageDetails").textContent = `${state.storage.imageCount} foto(s) · ${state.storage.percent}% do limite de ${state.storage.limit / 1000000} MB reservado ao painel. ${state.storage.unusedCount} foto(s) sem uso podem ser removidas.`;
  $("cleanup").disabled = !state.storage.unusedCount || busy;
  if (state.storage.percent >= 90) notice("O espaço das fotos chegou a 90%. Use a limpeza para remover arquivos antigos sem uso.", true);
  document.querySelectorAll("[data-tab]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.tab === tab)));
  const items = state.items.filter((item) => tab === "inactive" ? !item.active : item.active && item.kind === tab);
  $("catalogList").innerHTML = items.length ? items.map((item) => {
    const activeVariants = item.variants.filter((variant) => variant.active);
    const cheapest = (activeVariants.length ? activeVariants : [item]).reduce((a, b) => effectivePrice(a) <= effectivePrice(b) ? a : b);
    let detail = stockText(item.stock);
    let soldOut = false;
    if (item.variants.length) {
      detail = `${activeVariants.length} sabores ativos · ${activeVariants.map((variant) => `${variant.name}: ${stockText(variant.stock)}`).join(" / ")}`;
      soldOut = !activeVariants.some((variant) => variant.stock === null || variant.stock > 0);
    } else if (item.kind === "kit") {
      const selected = resolveItem(state.items, item.id);
      detail = selected ? `${selected.available} kit(s) possíveis com o estoque atual` : "Um item da composição está inativo";
      soldOut = !selected?.available;
    } else soldOut = item.stock === 0;
    const status = !item.active ? "Inativo" : soldOut ? "Esgotado" : "Ativo";
    return `<article class="catalog-card">${item.image ? `<img src="${escape(photoUrl(item.image))}" alt="${escape(item.name)}">` : '<div class="photo-placeholder" aria-hidden="true">♡</div>'}<div class="catalog-info"><span class="tag ${!item.active ? "" : soldOut ? "soldout" : "active"}">${status}</span><h3>${escape(item.name)}</h3><p>${escape(detail)}</p><div class="card-price">${cheapest.salePriceCents ? `<del>${currency(cheapest.priceCents)}</del>` : ""}<strong>${item.variants.length ? "A partir de " : ""}${currency(effectivePrice(cheapest))}</strong></div><div class="card-actions"><button data-edit="${escape(item.id)}">Editar</button><button data-toggle="${escape(item.id)}">${item.active ? "Inativar" : "Reativar"}</button></div></div></article>`;
  }).join("") : '<p class="empty">Nenhum item nesta lista. Seus cadastros vão aparecer aqui.</p>';
}
function parseMoney(value, optional = false) {
  const input = value.trim();
  if (!input && optional) return null;
  if (!/^\d{1,6}(?:[.,]\d{1,2})?$/.test(input)) throw new Error("Informe os valores no formato 25,00, sem pontos de milhar.");
  return Math.round(Number(input.replace(",", ".")) * 100);
}
function parseStock(value) {
  if (value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 9999) throw new Error("Use uma quantidade inteira de 0 a 9999.");
  return parsed;
}
function readRows() {
  if (!draft) return;
  draft.variants = [...$("variantsList").querySelectorAll("[data-variant]")].map((row) => ({
    id: row.dataset.variant, name: row.querySelector('[data-field="name"]').value,
    priceCents: parseMoney(row.querySelector('[data-field="price"]').value),
    salePriceCents: parseMoney(row.querySelector('[data-field="sale"]').value, true),
    stock: parseStock(row.querySelector('[data-field="stock"]').value), active: row.querySelector('[data-field="active"]').checked
  }));
  draft.components = [...$("componentsList").querySelectorAll("[data-component]")].map((row) => {
    const [productId, variantId = ""] = row.querySelector("select").value.split(":");
    return { productId, variantId, quantity: Number(row.querySelector("input").value) };
  });
}
function collect() {
  readRows();
  return {
    ...draft, name: $("productName").value.trim(), description: $("productDescription").value.trim(),
    imageAlt: $("productName").value.trim(), priceCents: parseMoney($("productPrice").value),
    salePriceCents: parseMoney($("productSale").value, true), stock: draft.variants.length ? null : parseStock($("productStock").value),
    active: $("productActive").checked, featured: $("productFeatured").checked
  };
}
function renderRows() {
  $("variantsSection").hidden = draft.kind === "kit";
  $("componentsSection").hidden = draft.kind !== "kit";
  $("stockField").hidden = draft.variants.length > 0;
  $("variantsList").innerHTML = draft.variants.map((variant, i) => `<div class="variant-row" data-variant="${escape(variant.id)}"><div class="row-heading"><span>Sabor ${i + 1}</span><button class="text-button" type="button" data-remove-variant="${i}">Remover</button></div><label>Nome do sabor<input data-field="name" value="${escape(variant.name)}" maxlength="80" required placeholder="Ex.: Maracujá"></label><div class="field-grid"><label>Preço normal (R$)<input data-field="price" inputmode="decimal" required value="${amount(variant.priceCents)}"></label><label>Preço com desconto (R$)<input data-field="sale" inputmode="decimal" value="${amount(variant.salePriceCents)}" placeholder="Opcional"></label></div><label>Quantidade disponível<input data-field="stock" type="number" min="0" max="9999" step="1" value="${variant.stock ?? ""}"></label><label class="check"><input data-field="active" type="checkbox" ${variant.active ? "checked" : ""}> Sabor ativo</label></div>`).join("");
  const choices = state.items.filter((item) => item.kind === "product").flatMap((item) => item.variants.length ? item.variants.map((variant) => ({ key: lineKey(item.id, variant.id), name: `${item.name} — ${variant.name}${!item.active || !variant.active ? " (inativo)" : ""}` })) : [{ key: item.id, name: item.name + (!item.active ? " (inativo)" : "") }]);
  $("componentsList").innerHTML = draft.components.map((part, i) => `<div class="component-row" data-component="${i}"><div class="row-heading"><span>Item ${i + 1}</span><button type="button" class="text-button" data-remove-component="${i}">Remover</button></div><label>Produto e sabor<select required><option value="">Selecione um produto</option>${choices.map((choice) => `<option value="${escape(choice.key)}" ${choice.key === lineKey(part.productId, part.variantId) ? "selected" : ""}>${escape(choice.name)}</option>`).join("")}</select></label><label>Unidades em cada kit<input type="number" min="1" max="100" step="1" required value="${part.quantity}"></label></div>`).join("");
  updatePricePreview();
}
function updatePricePreview() {
  try {
    const normal = parseMoney($("productPrice").value);
    const sale = parseMoney($("productSale").value, true);
    $("pricePreview").textContent = sale ? `No site: de ${currency(normal)} por ${currency(sale)}` : `No site: ${currency(normal)}`;
  } catch { $("pricePreview").textContent = ""; }
  if (draft?.kind === "kit") {
    try {
      const item = collect();
      const catalog = [...state.items.filter((p) => p.id !== item.id), { ...item, active: true }];
      validateCatalog(catalog);
      const selected = resolveItem(catalog, item.id);
      $("kitCapacity").textContent = selected ? `Com essa composição e os limites informados, podem ser vendidos até ${selected.available} kit(s). Cada kit também utiliza o estoque dos seus componentes.` : "Há um produto ou sabor inativo na composição. O kit ficará indisponível até reativá-lo.";
    } catch { $("kitCapacity").textContent = "Preencha a composição para conferir a disponibilidade do kit."; }
  }
}
function setPhoto(image) {
  draft.image = image;
  $("photoPreview").hidden = !image;
  $("removePhoto").hidden = !image;
  if (image) $("photoPreview").src = photoUrl(image);
  else $("photoPreview").removeAttribute("src");
}
function openEditor(kind, item) {
  if (busy) return;
  draft = item ? structuredClone(item) : { id: `p-${crypto.randomUUID()}`, kind, name: "", description: "", image: "", imageAlt: "", priceCents: null, salePriceCents: null, stock: 0, active: true, featured: false, variants: [], components: [] };
  dirty = false;
  $("productForm").reset();
  $("formError").hidden = true;
  $("editorKind").textContent = kind === "kit" ? "KIT" : "DOCE";
  $("editorTitle").textContent = item ? `Editar ${kind === "kit" ? "kit" : "doce"}` : kind === "kit" ? "Criar kit" : "Adicionar doce";
  $("productName").value = draft.name;
  $("productDescription").value = draft.description;
  $("productPrice").value = amount(draft.priceCents);
  $("productSale").value = amount(draft.salePriceCents);
  $("productStock").value = draft.stock ?? "";
  $("productActive").checked = draft.active;
  $("productFeatured").checked = draft.featured;
  setPhoto(draft.image);
  renderRows();
  $("editor").showModal();
  $("productName").focus();
}
function closeEditor() {
  if (busy) return;
  if (dirty && !confirm("Descartar as alterações que ainda não foram salvas?")) return;
  photoJob++;
  $("editor").close();
  draft = null;
}
async function saveItems(items) {
  const valid = validateCatalog(items);
  const saved = await api("catalog", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: valid, revision: state.revision }) });
  state.items = saved.items;
  state.revision = saved.revision;
}
$("productForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;
  busy = true;
  $("saveProduct").disabled = true;
  $("saveProduct").textContent = "Salvando…";
  $("formError").hidden = true;
  try {
    const item = collect();
    const items = state.items.some((p) => p.id === item.id) ? state.items.map((p) => p.id === item.id ? item : p) : [...state.items, item];
    await saveItems(items);
    dirty = false;
    $("editor").close();
    draft = null;
    await load("Alterações salvas. O cardápio já pode ser atualizado pelos clientes.");
  } catch (cause) { if ($("editor").open) fail(cause.message); else notice(cause.message, true); }
  finally { busy = false; $("saveProduct").disabled = false; $("saveProduct").textContent = "Salvar no site"; render(); }
});
$("catalogList").addEventListener("click", async (event) => {
  const edit = event.target.closest("[data-edit]");
  if (edit) { const item = state.items.find((p) => p.id === edit.dataset.edit); openEditor(item.kind, item); return; }
  const toggle = event.target.closest("[data-toggle]");
  if (!toggle || busy) return;
  busy = true;
  toggle.disabled = true;
  try {
    const item = state.items.find((p) => p.id === toggle.dataset.toggle);
    await saveItems(state.items.map((p) => p.id === item.id ? { ...p, active: !p.active } : p));
    notice(item.active ? "Item inativado. Kits que dependem dele também ficam indisponíveis no site." : "Item reativado.");
    render();
  } catch (cause) { notice(cause.message, true); toggle.disabled = false; }
  finally { busy = false; render(); }
});
document.querySelector(".tabs").addEventListener("click", (event) => { const button = event.target.closest("[data-tab]"); if (button) { tab = button.dataset.tab; render(); } });
$("newProduct").addEventListener("click", () => openEditor("product"));
$("newKit").addEventListener("click", () => openEditor("kit"));
$("closeEditor").addEventListener("click", closeEditor);
$("cancelEditor").addEventListener("click", closeEditor);
$("editor").addEventListener("cancel", (event) => { event.preventDefault(); closeEditor(); });
$("productForm").addEventListener("input", () => { dirty = true; updatePricePreview(); });
window.addEventListener("beforeunload", (event) => { if (dirty && $("editor").open) { event.preventDefault(); event.returnValue = ""; } });
$("addVariant").addEventListener("click", () => {
  try { readRows(); } catch (cause) { fail(cause.message); return; }
  if (draft.variants.length >= 20) { fail("Use até 20 sabores por produto."); return; }
  let price = null, sale = null;
  try { price = parseMoney($("productPrice").value); sale = parseMoney($("productSale").value, true); } catch { /* Pode preencher depois. */ }
  draft.variants.push({ id: `v-${crypto.randomUUID()}`, name: "", priceCents: price, salePriceCents: sale, stock: 0, active: true });
  dirty = true;
  renderRows();
});
$("addComponent").addEventListener("click", () => {
  try { readRows(); } catch (cause) { fail(cause.message); return; }
  if (draft.components.length >= 20) { fail("Use até 20 itens por kit."); return; }
  draft.components.push({ productId: "", variantId: "", quantity: 1 });
  dirty = true;
  renderRows();
});
$("variantsList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-variant]");
  if (!button) return;
  // Remover uma linha incompleta também deve funcionar.
  const row = button.closest("[data-variant]");
  row.remove();
  try { readRows(); renderRows(); } catch { /* Os demais campos continuam editáveis. */ }
  dirty = true;
  $("stockField").hidden = $("variantsList").children.length > 0;
});
$("componentsList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-component]");
  if (!button) return;
  button.closest("[data-component]").remove();
  readRows();
  dirty = true;
  renderRows();
});
$("removePhoto").addEventListener("click", () => { photoJob++; setPhoto(""); $("photoInput").value = ""; dirty = true; });
$("photoInput").addEventListener("change", async () => {
  const file = $("photoInput").files[0];
  if (!file || busy) return;
  const job = ++photoJob;
  busy = true;
  $("saveProduct").disabled = true;
  try {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 20000000) throw new Error("Escolha uma foto JPEG, PNG ou WebP de até 20 MB.");
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    let blob;
    for (const quality of [.84, .7, .55, .4]) {
      blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob?.size <= 350000) break;
    }
    if (!blob || blob.size > 750000) throw new Error("Esta foto ainda está muito grande. Escolha uma imagem menor.");
    const result = await api("images", { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob });
    if (job === photoJob && draft) { setPhoto(result.image); dirty = true; }
  } catch (cause) { fail(cause.message); }
  finally { busy = false; $("saveProduct").disabled = false; }
});
$("cleanup").addEventListener("click", async () => {
  if (busy || !confirm(`Remover ${state.storage.unusedCount} foto(s) antigas sem uso? Produtos e fotos vinculadas serão preservados.`)) return;
  busy = true;
  $("cleanup").disabled = true;
  try {
    const result = await api("images/cleanup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true }) });
    await load(`${result.removed} foto(s) sem uso removidas.`);
  } catch (cause) { notice(cause.message, true); }
  finally { busy = false; render(); }
});
$("logout").addEventListener('click', async () => {
  if (busy) return;
  try {
    const response = await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (!response.ok) throw new Error('Não foi possível sair. Tente novamente.');
    location.replace('/auth/login');
  } catch (cause) { notice(cause.message, true); }
});
load().catch((cause) => notice(cause.message, true));
