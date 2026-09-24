import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCatalog, publicCatalog, quoteCart, resolveItem } from '../js/catalog-core.js';
import { fixture } from './fixtures.mjs';

test('desconto, sabor e composição chegam ao pedido em centavos', () => {
  const items = validateCatalog(fixture());
  const quote = quoteCart(items, [{ productId: 'kit', quantity: 2 }, { productId: 'cone', variantId: 'maracuja', quantity: 1 }]);
  assert.equal(quote.totalCents, 5000);
  assert.equal(quote.lines[0].originalPriceCents, 2500);
  assert.equal(quote.lines[0].components[1].variantName, 'Ninho');
  assert.equal(quote.lines[1].variantName, 'Maracujá');
  assert.equal(resolveItem(items, 'kit').available, 3);
  assert.equal(resolveItem(items, 'cone'), null);
});
test('kits e avulsos disputam o mesmo estoque em qualquer ordem', () => {
  const items = fixture();
  const lines = [{ productId: 'kit', quantity: 2 }, { productId: 'cone', variantId: 'ninho', quantity: 2 }];
  assert.throws(() => quoteCart(items, lines), /Estoque insuficiente/);
  assert.throws(() => quoteCart(items, lines.toReversed()), /Estoque insuficiente/);
  assert.throws(() => quoteCart(items, [{ productId: 'cone', variantId: 'nutella', quantity: 1 }]), /Estoque/);
  items[2].components[0].quantity = 2;
  assert.equal(resolveItem(items, 'kit').available, 2);
});
test('inativação preserva cadastro e retira produtos, sabores e kits dependentes da vitrine', () => {
  const items = fixture();
  items[1].variants[0].active = false;
  assert.equal(publicCatalog(items).some((p) => p.id === 'kit'), false);
  assert.deepEqual(publicCatalog(items).find((p) => p.id === 'cone').variants.map((v) => v.id), ['nutella', 'maracuja']);
  assert.throws(() => quoteCart(items, [{ productId: 'kit', quantity: 1 }]), /inativado/);
  items[1].active = false;
  assert.deepEqual(publicCatalog(items).map((p) => p.id), ['morango']);
  assert.equal(items.length, 3);
});
test('rejeita kit aninhado, sabor removido, preço inválido e quantidades adulteradas', () => {
  const bad = (edit, pattern) => { const items = fixture(); edit(items); assert.throws(() => validateCatalog(items), pattern); };
  bad((items) => { items[2].components[0].productId = 'kit'; }, /nunca outro kit/);
  bad((items) => { items[1].variants.shift(); }, /sabor válido/);
  bad((items) => { items[0].salePriceCents = 1600; }, /desconto/);
  bad((items) => { items[0].stock = -1; }, /estoque/);
  bad((items) => { items[0].image = 'javascript:alert(1)'; }, /foto/);
  bad((items) => { items[2].components.push(items[2].components[0]); }, /duas vezes/);
  assert.throws(() => quoteCart(fixture(), [{ productId: 'morango', quantity: 1.5 }]), /Quantidade/);
  assert.throws(() => quoteCart(fixture(), [{ productId: 'morango', quantity: 1 }, { productId: 'morango', quantity: 1 }]), /duplicado/);
});
