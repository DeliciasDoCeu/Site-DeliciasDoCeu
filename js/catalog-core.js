// Regras compartilhadas pelo site e pela API. Valores monetários em centavos.
export const MAX_ITEMS = 40;
export const MAX_QUANTITY = 9999;
export const lineKey = (id, variantId = "") => variantId ? `${id}:${variantId}` : id;
export const effectivePrice = (item) => item.salePriceCents ?? item.priceCents;
const byId = (items, id) => items.find((item) => item.id === id);
const cap = (stock) => stock === null ? MAX_QUANTITY : stock;

export function validateCatalog(input) {
  const fail = (message) => { throw new Error(message); };
  const text = (value, label, max, optional = false) => {
    if (typeof value !== "string" || (!optional && !value.trim()) || value.length > max) fail(`${label}: preencha um texto válido (até ${max} caracteres).`);
    return value.trim();
  };
  const id = (value) => {
    if (typeof value !== "string" || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(value)) fail("Identificador inválido.");
    return value;
  };
  const stock = (value) => {
    if (value === null) return null;
    if (!Number.isInteger(value) || value < 0 || value > MAX_QUANTITY) fail("O estoque deve ser um número inteiro de 0 a 9999.");
    return value;
  };
  const prices = (item) => {
    if (!Number.isInteger(item.priceCents) || item.priceCents <= 0 || item.priceCents > 10000000) fail("Informe um preço maior que zero.");
    const sale = item.salePriceCents ?? null;
    if (sale !== null && (!Number.isInteger(sale) || sale <= 0 || sale >= item.priceCents)) fail("O preço com desconto deve ser maior que zero e menor que o preço normal.");
    return { priceCents: item.priceCents, salePriceCents: sale };
  };
  if (!Array.isArray(input) || input.length > MAX_ITEMS) fail(`O catálogo comporta até ${MAX_ITEMS} produtos e kits.`);
  const ids = new Set();
  const result = input.map((item) => {
    if (!item || typeof item !== "object") fail("Produto inválido.");
    const itemId = id(item.id);
    if (ids.has(itemId)) fail("Há produtos com o mesmo identificador.");
    ids.add(itemId);
    if (!["product", "kit"].includes(item.kind)) fail("Tipo de produto inválido.");
    const image = text(item.image ?? "", "Foto", 300, true);
    if (image && !/^\/media\/[a-f0-9-]{36}$/.test(image) && !/^\.\/images\/products\/[a-z0-9-]+\.(png|jpe?g|webp)$/.test(image)) fail("Selecione uma foto enviada pelo painel.");
    const variants = item.variants ?? [];
    const components = item.components ?? [];
    if (!Array.isArray(variants) || variants.length > 20 || !Array.isArray(components) || components.length > 20) fail("Use até 20 sabores ou itens na composição.");
    const variantIds = new Set();
    const variantNames = new Set();
    const normalizedVariants = variants.map((variant) => {
      const variantId = id(variant.id);
      const name = text(variant.name, "Sabor", 80);
      if (variantIds.has(variantId) || variantNames.has(name.toLocaleLowerCase("pt-BR"))) fail("Não repita sabores no mesmo produto.");
      variantIds.add(variantId);
      variantNames.add(name.toLocaleLowerCase("pt-BR"));
      return { id: variantId, name, ...prices(variant), stock: stock(variant.stock), active: variant.active !== false };
    });
    if (item.kind === "kit" && normalizedVariants.length) fail("Escolha os sabores nos itens do kit.");
    if (item.kind === "product" && components.length) fail("Somente kits podem ter uma composição.");
    if (item.kind === "kit" && !components.length) fail("Adicione pelo menos um produto ao kit.");
    return {
      id: itemId, kind: item.kind, name: text(item.name, "Nome", 100),
      description: text(item.description ?? "", "Descrição", 1000, true), image,
      imageAlt: text(item.imageAlt || item.name, "Descrição da foto", 160),
      ...prices(item), stock: stock(item.stock), active: item.active !== false,
      featured: item.featured === true, variants: normalizedVariants,
      components: components.map((part) => {
        if (!Number.isInteger(part.quantity) || part.quantity < 1 || part.quantity > 100) fail("A quantidade de cada item do kit deve estar entre 1 e 100.");
        return { productId: id(part.productId), variantId: part.variantId ? id(part.variantId) : "", quantity: part.quantity };
      })
    };
  });
  for (const item of result) {
    const parts = new Set();
    for (const part of item.components) {
      const product = byId(result, part.productId);
      if (!product || product.kind !== "product") fail(`O kit ${item.name} deve conter apenas produtos cadastrados, nunca outro kit.`);
      if (product.variants.length ? !byId(product.variants, part.variantId) : !!part.variantId) fail(`Escolha um sabor válido de ${product.name} no kit ${item.name}.`);
      const key = lineKey(part.productId, part.variantId);
      if (parts.has(key)) fail(`O kit ${item.name} contém o mesmo item duas vezes; ajuste sua quantidade.`);
      parts.add(key);
    }
  }
  return result;
}

export function resolveItem(items, productId, variantId = "") {
  const product = byId(items, productId);
  if (!product || !product.active) return null;
  const variant = variantId ? byId(product.variants, variantId) : null;
  if (product.variants.length ? !variant?.active : !!variantId) return null;
  const selected = variant || product;
  const components = [];
  let available = cap(selected.stock);
  const needs = [{ key: lineKey(productId, variantId), quantity: 1, stock: selected.stock }];
  for (const part of product.components) {
    const component = byId(items, part.productId);
    const flavor = part.variantId ? component?.variants.find((v) => v.id === part.variantId) : null;
    if (!component?.active || (part.variantId && !flavor?.active)) return null;
    const componentStock = (flavor || component).stock;
    available = Math.min(available, Math.floor(cap(componentStock) / part.quantity));
    needs.push({ key: lineKey(part.productId, part.variantId), quantity: part.quantity, stock: componentStock });
    components.push({ name: component.name, variantName: flavor?.name || "", quantity: part.quantity });
  }
  return {
    productId, variantId, key: lineKey(productId, variantId),
    name: product.name, variantName: variant?.name || "", kind: product.kind,
    image: product.image, imageAlt: product.imageAlt, description: product.description,
    priceCents: effectivePrice(selected), originalPriceCents: selected.priceCents,
    available, components, needs
  };
}

export function quoteCart(items, lines) {
  if (!Array.isArray(lines) || lines.length > 100) throw new Error("Carrinho inválido.");
  const seen = new Set();
  const demand = new Map();
  const quoted = lines.map((line) => {
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_QUANTITY) throw new Error("Quantidade inválida no carrinho.");
    const selected = resolveItem(items, line.productId, line.variantId || "");
    if (!selected) throw new Error("Um item do carrinho foi inativado ou teve seu sabor alterado. Remova-o para continuar.");
    if (seen.has(selected.key)) throw new Error("Item duplicado no carrinho.");
    seen.add(selected.key);
    for (const need of selected.needs) {
      const quantity = (demand.get(need.key) || 0) + need.quantity * line.quantity;
      if (quantity > cap(need.stock)) throw new Error(`Estoque insuficiente para ${selected.name}${selected.variantName ? ` — ${selected.variantName}` : ""}. Confira as quantidades, incluindo os kits.`);
      demand.set(need.key, quantity);
    }
    const { needs, ...publicItem } = selected;
    return { ...publicItem, quantity: line.quantity, subtotalCents: selected.priceCents * line.quantity };
  });
  return { lines: quoted, totalCents: quoted.reduce((sum, line) => sum + line.subtotalCents, 0) };
}

export function publicCatalog(items) {
  return items.filter((item) => item.active).map((item) => ({
    ...item,
    variants: item.variants.filter((variant) => variant.active)
  })).filter((item) => {
    if (item.kind === "kit") return !!resolveItem(items, item.id);
    return !byId(items, item.id).variants.length || item.variants.length > 0;
  });
}
