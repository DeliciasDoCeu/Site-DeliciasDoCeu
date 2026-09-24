export function fixture() {
  const product = (id, name, stock, extra = {}) => ({ id, name, stock, kind: 'product', description: '', image: '', imageAlt: name, priceCents: 1500, salePriceCents: null, active: true, featured: false, variants: [], components: [], ...extra });
  return [
    product('morango', 'Morango', 5),
    product('cone', 'Cone trufado', null, { priceCents: 1000, variants: [
      { id: 'ninho', name: 'Ninho', priceCents: 1000, salePriceCents: 800, stock: 3, active: true },
      { id: 'nutella', name: 'Nutella', priceCents: 1200, salePriceCents: null, stock: 0, active: true },
      { id: 'maracuja', name: 'Maracujá', priceCents: 1000, salePriceCents: null, stock: 2, active: true }
    ] }),
    product('kit', 'Kit carinho', 4, { kind: 'kit', priceCents: 2500, salePriceCents: 2000, components: [
      { productId: 'morango', variantId: '', quantity: 1 },
      { productId: 'cone', variantId: 'ninho', quantity: 1 }
    ] })
  ];
}
