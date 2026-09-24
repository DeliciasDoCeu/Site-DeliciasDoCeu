import { siteConfig } from "./config.js";
import { resolveItem } from "./catalog-core.js";

import {
  categories,
  getAvailableProducts,
  getProductsByCategory,
  getProductById,
  getCatalog,
  loadCatalog,
  apiUrl
} from "./products.js";

import {
  addToCart,
  increaseItem,
  decreaseItem,
  removeFromCart,
  clearCart,
  getDetailedCartItems,
  getCartItemCount,
  getCartTotal,
  isCartEmpty,
  getCart,
  getCartError,
  getLastCartError
} from "./cart.js";

import {
  formatCurrency,
  openWhatsAppOrder
} from "./whatsapp.js";


/* =========================================================
   ELEMENTOS DA PÁGINA
========================================================= */

const menuToggle =
  document.querySelector("#menuToggle");

const mainNavigation =
  document.querySelector("#mainNavigation");

const categoryFilters =
  document.querySelector("#categoryFilters");

const productGrid =
  document.querySelector("#productGrid");

const emptyProducts =
  document.querySelector("#emptyProducts");


const cartButton =
  document.querySelector("#cartButton");

const mobileCartButton =
  document.querySelector("#mobileCartButton");

const cartCount =
  document.querySelector("#cartCount");

const mobileCartCount =
  document.querySelector("#mobileCartCount");

const cartDrawer =
  document.querySelector("#cartDrawer");

const cartOverlay =
  document.querySelector("#cartOverlay");

const closeCartButton =
  document.querySelector("#closeCartButton");

const cartEmpty =
  document.querySelector("#cartEmpty");

const cartItems =
  document.querySelector("#cartItems");

const cartSummary =
  document.querySelector("#cartSummary");

const cartTotal =
  document.querySelector("#cartTotal");

const cartNotes =
  document.querySelector("#cartNotes");

const checkoutButton =
  document.querySelector("#checkoutButton");

const clearCartButton =
  document.querySelector("#clearCartButton");

const emptyCartMenuButton =
  document.querySelector("#emptyCartMenuButton");

const liveRegion =
  document.querySelector("#liveRegion");

const footerYear =
  document.querySelector("#footerYear");


/* =========================================================
   MODAL DE DETALHES DO PRODUTO
========================================================= */

const productDialog =
  document.querySelector("#productDialog");

const productDialogClose =
  document.querySelector("#productDialogClose");

const productDialogImage =
  document.querySelector("#productDialogImage");

const productDialogCategory =
  document.querySelector("#productDialogCategory");

const productDialogTitle =
  document.querySelector("#productDialogTitle");

const productDialogDescription =
  document.querySelector("#productDialogDescription");

const productDialogPrice =
  document.querySelector("#productDialogPrice");

const productQuantityDecrease =
  document.querySelector("#productQuantityDecrease");

const productQuantityIncrease =
  document.querySelector("#productQuantityIncrease");

const productQuantityValue =
  document.querySelector("#productQuantityValue");

const productDialogAdd =
  document.querySelector("#productDialogAdd");


/* =========================================================
   ESTADO DA INTERFACE
========================================================= */

let activeCategory = "todos";

let lastFocusedElement = null;

let selectedProductId = null;

let selectedProductQuantity = 1;


/* =========================================================
   UTILITÁRIOS
========================================================= */

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function announce(message) {
  if (!liveRegion) {
    return;
  }

  liveRegion.textContent = "";

  window.setTimeout(() => {
    liveRegion.textContent = message;
  }, 50);
}


function sanitizeWhatsAppNumber(number) {
  return String(number).replace(/\D/g, "");
}


function hasValidWhatsAppNumber() {
  const number =
    sanitizeWhatsAppNumber(
      siteConfig.whatsappNumber
    );

  return (
    number.length >= 10 &&
    number.length <= 15
  );
}


function getCategoryName(categoryId) {
  const category =
    categories.find(
      (item) =>
        item.id === categoryId
    );

  return category?.name ?? "Doces";
}


function getCategoryEmoji(categoryId) {
  const emojis = {
    brigadeiros: "🍬",
    brownies: "🍫",
    bolos: "🍰",
    doces: "🧁",
    kits: "🎁",
    presentes: "🎁",
    promocoes: "✨"
  };

  return emojis[categoryId] ?? "🍰";
}


/* =========================================================
   CONFIGURAÇÕES DA CONFEITARIA
========================================================= */

function applySiteConfig() {
  document
    .querySelectorAll("[data-config]")
    .forEach((element) => {
      const property =
        element.dataset.config;

      if (
        property &&
        Object.prototype.hasOwnProperty.call(
          siteConfig,
          property
        )
      ) {
        element.textContent =
          siteConfig[property];
      }
    });


  const whatsappDisplay =
    document.querySelector(
      "#contactWhatsappDisplay"
    );

  if (whatsappDisplay) {
    whatsappDisplay.textContent =
      siteConfig.whatsappDisplay;
  }


  if (footerYear) {
    footerYear.textContent =
      new Date().getFullYear();
  }
}


/* =========================================================
   WHATSAPP E INSTAGRAM
========================================================= */

function configureContactLinks() {
  const whatsappButtons = [
    document.querySelector(
      "#headerWhatsappButton"
    ),

    document.querySelector(
      "#heroWhatsappButton"
    ),

    document.querySelector(
      "#contactWhatsappButton"
    ),

    document.querySelector(
      "#footerWhatsappLink"
    )
  ].filter(Boolean);


  if (hasValidWhatsAppNumber()) {
    const number =
      sanitizeWhatsAppNumber(
        siteConfig.whatsappNumber
      );

    const message =
      `Olá! Vim pelo site da ${siteConfig.brandName} e gostaria de mais informações.`;

    const whatsappUrl =
      `https://wa.me/${number}?text=${encodeURIComponent(message)}`;


    whatsappButtons.forEach(
      (button) => {
        button.href =
          whatsappUrl;

        button.removeAttribute(
          "aria-disabled"
        );

        button.removeAttribute(
          "data-disabled-link"
        );
      }
    );
  } else {
    whatsappButtons.forEach(
      (button) => {
        button.href = "#";

        button.setAttribute(
          "aria-disabled",
          "true"
        );

        button.dataset.disabledLink =
          "true";
      }
    );
  }


  const instagramLinks = [
    document.querySelector(
      "#instagramLink"
    ),

    document.querySelector(
      "#footerInstagramLink"
    )
  ].filter(Boolean);


  const instagramConfigured =
    typeof siteConfig.instagramUrl ===
      "string" &&
    siteConfig.instagramUrl.startsWith(
      "http"
    ) &&
    !siteConfig.instagramUrl.includes(
      "INSTAGRAM"
    );


  instagramLinks.forEach(
    (link) => {
      if (instagramConfigured) {
        link.href =
          siteConfig.instagramUrl;

        link.removeAttribute(
          "aria-disabled"
        );

        link.removeAttribute(
          "data-disabled-link"
        );
      } else {
        link.href = "#";

        link.setAttribute(
          "aria-disabled",
          "true"
        );

        link.dataset.disabledLink =
          "true";
      }
    }
  );
}


/* =========================================================
   CATEGORIAS
========================================================= */

function renderCategories() {
  categoryFilters.innerHTML =
    categories
      .map((category) => {
        const active =
          category.id ===
          activeCategory;

        return `
          <button
            type="button"
            class="category-filter ${
              active
                ? "is-active"
                : ""
            }"
            data-category="${escapeHTML(
              category.id
            )}"
            aria-pressed="${active}"
          >
            ${escapeHTML(
              category.name
            )}
          </button>
        `;
      })
      .join("");
}


/* =========================================================
   IMAGEM DOS PRODUTOS
========================================================= */

function createProductImage(product) {
  if (product.image) {
    return `
      <img
        src="${escapeHTML(
          product.image
        )}"
        alt="${escapeHTML(
          product.imageAlt
        )}"
        loading="lazy"
        decoding="async"
      >
    `;
  }

  return `
    <div
      class="product-image-placeholder"
      aria-hidden="true"
    >
      ${getCategoryEmoji(
        product.category
      )}
    </div>
  `;
}


/* =========================================================
   PRODUTOS
========================================================= */


function priceMarkup(product) {
  return (product.variants?.length ? '<span class="price-prefix">A partir de</span>' : '') +
    (product.originalPrice > product.price ? '<del>' + formatCurrency(product.originalPrice) + '</del>' : '') +
    formatCurrency(product.price);
}
function renderProducts(products) {
  emptyProducts.hidden = products.length > 0;
  productGrid.innerHTML = products.map((product) => `<article class="product-card" data-product-id="${escapeHTML(product.id)}">
    <div class="product-image">${createProductImage(product)}${product.featured ? '<span class="product-badge">Destaque</span>' : ''}</div>
    <div class="product-content"><span class="product-category">${escapeHTML(getCategoryName(product.category))}</span>
    <h3 class="product-name">${escapeHTML(product.name)}</h3><p class="product-description">${escapeHTML(product.description)}</p>
    ${product.soldOut ? '<p class="product-sold-out">Esgotado</p>' : ''}
    <button type="button" class="product-details-button" data-action="view-details" data-product-id="${escapeHTML(product.id)}">${product.variants.length ? 'Escolher sabor' : 'Ver detalhes'}</button>
    <div class="product-footer"><span class="product-price">${priceMarkup(product)}</span><button type="button" class="add-to-cart-button" data-action="add-to-cart" data-product-id="${escapeHTML(product.id)}" aria-label="Adicionar ${escapeHTML(product.name)} ao carrinho" ${product.soldOut ? 'disabled' : ''}><span aria-hidden="true">+</span></button></div></div></article>`).join('');
}


function selectCategory(categoryId) {
  activeCategory =
    categoryId;

  renderCategories();


  const filteredProducts =
    getProductsByCategory(
      categoryId
    );


  renderProducts(
    filteredProducts
  );
}


/* =========================================================
   IMAGENS DO CARRINHO
========================================================= */

function createCartItemImage(product) {
  if (product.image) {
    return `
      <img
        src="${escapeHTML(
          product.image
        )}"
        alt="${escapeHTML(
          product.imageAlt
        )}"
        loading="lazy"
        decoding="async"
      >
    `;
  }

  return `
    <div
      class="cart-item-image-placeholder"
      aria-hidden="true"
    >
      ${getCategoryEmoji(
        product.category
      )}
    </div>
  `;
}


/* =========================================================
   CARRINHO
========================================================= */


function renderCart() {
  const items = getDetailedCartItems();
  const count = getCartItemCount();
  cartCount.textContent = count;
  mobileCartCount.textContent = count;
  const label = count === 1 ? '1 item no carrinho' : count + ' itens no carrinho';
  cartCount.setAttribute('aria-label',label);
  cartButton.setAttribute('aria-label','Abrir carrinho, ' + label);
  mobileCartButton.setAttribute('aria-label','Abrir carrinho, ' + label);
  mobileCartButton.classList.toggle('is-visible',count>0);
  cartEmpty.hidden = items.length > 0;
  cartSummary.hidden = items.length === 0;
  const warning = getCartError();
  const feedback = document.getElementById('cartFeedback');
  feedback.hidden = !warning;
  feedback.textContent = warning;
  checkoutButton.disabled = !!warning || !items.length;
  cartItems.innerHTML = items.map((item)=> `<article class="cart-item" data-product-id="${escapeHTML(item.key)}">
    <div class="cart-item-image">${createCartItemImage(item.product)}</div>
    <div class="cart-item-info"><div class="cart-item-top"><div><h3 class="cart-item-name">${escapeHTML(item.product.name)}</h3><p class="cart-item-price">${item.unavailable ? 'Indisponível — remova para continuar' : item.quantity + ' × ' + formatCurrency(item.product.price)}</p></div>
    <button type="button" class="remove-cart-item" data-action="remove" data-product-id="${escapeHTML(item.key)}" aria-label="Remover ${escapeHTML(item.product.name)} do carrinho">×</button></div>
    ${item.product.components.length ? '<p class="cart-item-components">' + item.product.components.map(part=>escapeHTML(part.quantity + '× ' + part.name + (part.variantName ? ' — ' + part.variantName : ''))).join('<br>') + '</p>' : ''}
    <div class="cart-item-bottom"><div class="quantity-control" aria-label="Quantidade de ${escapeHTML(item.product.name)}"><button type="button" class="quantity-button" data-action="decrease" data-product-id="${escapeHTML(item.key)}" aria-label="Diminuir quantidade de ${escapeHTML(item.product.name)}">−</button><span class="quantity-value">${item.quantity}</span><button type="button" class="quantity-button" data-action="increase" data-product-id="${escapeHTML(item.key)}" aria-label="Aumentar quantidade de ${escapeHTML(item.product.name)}" ${item.unavailable ? 'disabled' : ''}>+</button></div><strong class="cart-item-subtotal">${formatCurrency(item.subtotal)}</strong></div></div></article>`).join('');
  cartTotal.textContent = formatCurrency(getCartTotal());
}


function openCart() {
  lastFocusedElement =
    document.activeElement;


  cartOverlay.hidden =
    false;


  document.body.classList.add(
    "cart-open"
  );


  cartDrawer.classList.add(
    "is-open"
  );


  cartDrawer.setAttribute(
    "aria-hidden",
    "false"
  );


  window.requestAnimationFrame(
    () => {
      cartOverlay.classList.add(
        "is-visible"
      );
    }
  );


  window.setTimeout(
    () => {
      closeCartButton.focus();
    },
    100
  );
}


/* =========================================================
   FECHAR CARRINHO
========================================================= */

function closeCart() {
  cartDrawer.classList.remove(
    "is-open"
  );

  cartOverlay.classList.remove(
    "is-visible"
  );


  cartDrawer.setAttribute(
    "aria-hidden",
    "true"
  );


  document.body.classList.remove(
    "cart-open"
  );


  window.setTimeout(
    () => {
      cartOverlay.hidden =
        true;
    },
    280
  );


  if (
    lastFocusedElement
      instanceof HTMLElement &&
    document.contains(
      lastFocusedElement
    )
  ) {
    lastFocusedElement.focus();
  }
}


/* =========================================================
   OBSERVAÇÕES DO PEDIDO
========================================================= */

function loadOrderNotes() {
  try {
    return (
      localStorage.getItem(
        siteConfig.storageKeys
          .orderNotes
      ) ?? ""
    );
  } catch (error) {
    console.error(
      "Não foi possível carregar as observações:",
      error
    );

    return "";
  }
}


function saveOrderNotes(value) {
  try {
    localStorage.setItem(
      siteConfig.storageKeys
        .orderNotes,
      value
    );
  } catch (error) {
    console.error(
      "Não foi possível salvar as observações:",
      error
    );
  }
}


function clearOrderNotes() {
  try {
    localStorage.removeItem(
      siteConfig.storageKeys
        .orderNotes
    );
  } catch (error) {
    console.error(
      "Não foi possível limpar as observações:",
      error
    );
  }


  cartNotes.value = "";
}


/* =========================================================
   MENU MOBILE
========================================================= */

function openMenu() {
  mainNavigation.classList.add(
    "is-open"
  );

  menuToggle.classList.add(
    "is-active"
  );

  menuToggle.setAttribute(
    "aria-expanded",
    "true"
  );

  menuToggle.setAttribute(
    "aria-label",
    "Fechar menu"
  );
}


function closeMenu() {
  mainNavigation.classList.remove(
    "is-open"
  );

  menuToggle.classList.remove(
    "is-active"
  );

  menuToggle.setAttribute(
    "aria-expanded",
    "false"
  );

  menuToggle.setAttribute(
    "aria-label",
    "Abrir menu"
  );
}


function toggleMenu() {
  const isOpen =
    mainNavigation.classList.contains(
      "is-open"
    );


  if (isOpen) {
    closeMenu();
  } else {
    openMenu();
  }
}


/* =========================================================
   DETALHES DO PRODUTO
========================================================= */


function updateProductDialogQuantity() {
  productQuantityValue.textContent = selectedProductQuantity;
  const variantId = document.getElementById('productVariant').value;
  const selected = selectedProductId ? resolveItem(getCatalog(), selectedProductId, variantId) : null;
  productQuantityDecrease.disabled = selectedProductQuantity <= 1;
  productQuantityIncrease.disabled = !selected || selectedProductQuantity >= selected.available;
  productDialogAdd.disabled = !selected || selected.available < selectedProductQuantity;
  const stock = document.getElementById('productStockStatus');
  stock.textContent = !selected ? 'Escolha um sabor disponível.' : selected.available === 0 ? 'Este produto está esgotado.' : selected.available >= 9999 ? 'Disponibilidade a confirmar no WhatsApp.' : selected.available + ' unidade(s) disponíveis.';
  if (selected) productDialogPrice.innerHTML = (selected.originalPriceCents > selected.priceCents ? '<del>' + formatCurrency(selected.originalPriceCents/100) + '</del>' : '') + formatCurrency(selected.priceCents/100);
}
function openProductDetails(productId) {
  const product = getProductById(productId);
  if (!product) return;
  selectedProductId = product.id;
  selectedProductQuantity = 1;
  productDialogCategory.textContent = getCategoryName(product.category);
  productDialogTitle.textContent = product.name;
  productDialogDescription.textContent = product.description;
  productDialogPrice.innerHTML = priceMarkup(product);
  productDialogImage.innerHTML = createProductImage(product);
  const select = document.getElementById('productVariant');
  document.getElementById('productVariantField').hidden = !product.variants.length;
  select.innerHTML = product.variants.length ? '<option value="">Selecione o sabor</option>' + product.variants.map(variant=> {
    const choice = resolveItem(getCatalog(),product.id,variant.id);
    return '<option value="' + escapeHTML(variant.id) + '"' + (!choice?.available ? ' disabled' : '') + '>' + escapeHTML(variant.name) + ' — ' + formatCurrency((variant.salePriceCents ?? variant.priceCents)/100) + (!choice?.available ? ' (esgotado)' : '') + '</option>';
  }).join('') : '';
  const details = resolveItem(getCatalog(),product.id);
  const contents = document.getElementById('productKitContents');
  contents.hidden = !details?.components.length;
  contents.innerHTML = details?.components.map(part=>'<li>' + escapeHTML(part.quantity + '× ' + part.name + (part.variantName ? ' — ' + part.variantName : '')) + '</li>').join('') || '';
  updateProductDialogQuantity();
  if (!productDialog.open) productDialog.showModal();
}
function closeProductDetails() {
  if (productDialog.open) productDialog.close();
  selectedProductId = null;
  selectedProductQuantity = 1;
}
document.getElementById('productVariant').addEventListener('change',()=>{ selectedProductQuantity=1; updateProductDialogQuantity(); });


categoryFilters.addEventListener(
  "click",
  (event) => {
    const button =
      event.target.closest(
        "[data-category]"
      );


    if (!button) {
      return;
    }


    selectCategory(
      button.dataset.category
    );
  }
);


/* =========================================================
   EVENTOS DOS PRODUTOS
========================================================= */


productGrid.addEventListener('click',(event)=>{
  const add = event.target.closest('[data-action="add-to-cart"]');
  if (add) {
    const product = getProductById(add.dataset.productId);
    if (!product || product.soldOut) return;
    if (product.variants.length) { openProductDetails(product.id); return; }
    if (!addToCart(product.id)) { announce(getLastCartError()); window.alert(getLastCartError()); return; }
    renderCart(); announce('Produto adicionado ao carrinho.'); return;
  }
  const card = event.target.closest('[data-product-id]');
  if (card) openProductDetails(card.dataset.productId);
});



cartItems.addEventListener('click',(event)=>{
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const key = button.dataset.productId;
  if (button.dataset.action === 'increase') {
    if (!increaseItem(key)) { announce(getLastCartError()); window.alert(getLastCartError()); }
  } else if (button.dataset.action === 'decrease') decreaseItem(key);
  else if (button.dataset.action === 'remove') { removeFromCart(key); announce('Produto removido do carrinho.'); }
  renderCart();
});


cartButton.addEventListener(
  "click",
  openCart
);


mobileCartButton.addEventListener(
  "click",
  openCart
);


closeCartButton.addEventListener(
  "click",
  closeCart
);


cartOverlay.addEventListener(
  "click",
  closeCart
);


emptyCartMenuButton.addEventListener(
  "click",
  () => {
    closeCart();


    document
      .querySelector(
        "#cardapio"
      )
      ?.scrollIntoView({
        behavior: "smooth"
      });
  }
);


/* =========================================================
   LIMPAR CARRINHO
========================================================= */

clearCartButton.addEventListener(
  "click",
  () => {
    if (isCartEmpty()) {
      return;
    }


    const confirmed =
      window.confirm(
        "Deseja realmente remover todos os produtos do carrinho?"
      );


    if (!confirmed) {
      return;
    }


    clearCart();

    clearOrderNotes();

    renderCart();


    announce(
      "Carrinho limpo."
    );
  }
);


/* =========================================================
   SALVAR OBSERVAÇÕES
========================================================= */

cartNotes.addEventListener(
  "input",
  (event) => {
    saveOrderNotes(
      event.target.value
    );
  }
);


/* =========================================================
   FINALIZAR PELO WHATSAPP
========================================================= */


checkoutButton.addEventListener('click',async()=>{
  if (isCartEmpty() || getCartError()) return;
  checkoutButton.disabled = true;
  const oldText = checkoutButton.textContent;
  checkoutButton.textContent = 'Conferindo pedido…';
  try {
    const configured = siteConfig.catalogApiUrl || ['localhost','127.0.0.1'].includes(location.hostname);
    let quote = null;
    if (configured) {
      const response = await fetch(apiUrl('/api/quote'), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({lines:getCart()}), signal:AbortSignal.timeout(15000) });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 400) { await loadCatalog(); renderProducts(getProductsByCategory(activeCategory)); renderCart(); }
        throw new Error(data.error || 'Confira os produtos e as quantidades antes de continuar.');
      }
      quote = data;
      if (Math.round(getCartTotal()*100) !== quote.totalCents) {
        await loadCatalog(); renderProducts(getProductsByCategory(activeCategory)); renderCart();
        throw new Error('Os preços foram atualizados. Confira o novo total e finalize novamente.');
      }
    }
    if (!openWhatsAppOrder(cartNotes.value, quote)) throw new Error('Não foi possível abrir o WhatsApp. Tente novamente.');
  } catch(error) { const feedback=document.getElementById('cartFeedback'); feedback.hidden=false; feedback.textContent=error.message; announce(error.message); }
  finally { checkoutButton.textContent=oldText; checkoutButton.disabled=!!getCartError() || isCartEmpty(); }
});


document.addEventListener(
  "click",
  (event) => {
    const disabledLink =
      event.target.closest(
        '[data-disabled-link="true"]'
      );


    if (!disabledLink) {
      return;
    }


    event.preventDefault();


    announce(
      "Esta informação ainda será configurada."
    );
  }
);


/* =========================================================
   MENU
========================================================= */

menuToggle.addEventListener(
  "click",
  toggleMenu
);


mainNavigation.addEventListener(
  "click",
  (event) => {
    if (
      event.target.closest("a")
    ) {
      closeMenu();
    }
  }
);


/* =========================================================
   MODAL - FECHAR
========================================================= */

productDialogClose.addEventListener(
  "click",
  closeProductDetails
);


/* =========================================================
   MODAL - DIMINUIR QUANTIDADE
========================================================= */

productQuantityDecrease.addEventListener(
  "click",
  () => {
    if (
      selectedProductQuantity >
      1
    ) {
      selectedProductQuantity -=
        1;


      updateProductDialogQuantity();
    }
  }
);


/* =========================================================
   MODAL - AUMENTAR QUANTIDADE
========================================================= */


productQuantityIncrease.addEventListener('click',()=>{
  const selected = resolveItem(getCatalog(),selectedProductId,document.getElementById('productVariant').value);
  if (selected && selectedProductQuantity < selected.available) selectedProductQuantity++;
  updateProductDialogQuantity();
});
productDialogAdd.addEventListener('click',()=>{
  if (!selectedProductId) return;
  const variantId = document.getElementById('productVariant').value;
  if (!addToCart(selectedProductId,selectedProductQuantity,variantId)) { announce(getLastCartError()); window.alert(getLastCartError()); return; }
  renderCart(); closeProductDetails(); openCart(); announce('Produto adicionado ao carrinho.');
});


productDialog.addEventListener(
  "click",
  (event) => {
    if (
      event.target ===
      productDialog
    ) {
      closeProductDetails();
    }
  }
);


/* =========================================================
   TECLADO
========================================================= */

document.addEventListener(
  "keydown",
  (event) => {
    if (
      event.key !== "Escape"
    ) {
      return;
    }


    if (productDialog.open) {
      closeProductDetails();
      return;
    }


    if (
      cartDrawer.classList.contains(
        "is-open"
      )
    ) {
      closeCart();
      return;
    }


    closeMenu();
  }
);


/* =========================================================
   AJUSTE AO REDIMENSIONAR
========================================================= */

window.addEventListener(
  "resize",
  () => {
    if (
      window.innerWidth >=
      900
    ) {
      closeMenu();
    }
  }
);


/* =========================================================
   INICIALIZAÇÃO
========================================================= */


async function init() {
  applySiteConfig(); configureContactLinks();
  productGrid.textContent = 'Carregando cardápio…';
  checkoutButton.disabled = true;
  cartNotes.value = loadOrderNotes();
  try {
    await loadCatalog(); renderCategories(); renderProducts(getAvailableProducts()); renderCart();
    const hero = document.querySelector('.hero-product-image');
    const photo = getAvailableProducts().find((item) => item.featured && item.image) || getAvailableProducts().find((item) => item.image);
    if (hero && photo) { hero.src = photo.image; hero.alt = photo.imageAlt; }
    else if (hero) hero.hidden = true;
  }
  catch(error) { productGrid.textContent = error.message; announce(error.message); }
}


init();
