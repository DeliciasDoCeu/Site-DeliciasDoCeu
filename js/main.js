import { siteConfig } from "./config.js";

import {
  categories,
  getAvailableProducts,
  getProductsByCategory
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
  isCartEmpty
} from "./cart.js";

import {
  formatCurrency,
  openWhatsAppOrder
} from "./whatsapp.js";


/* =========================================================
   ELEMENTOS DA PÁGINA
========================================================= */

const menuToggle = document.querySelector("#menuToggle");
const mainNavigation = document.querySelector("#mainNavigation");

const categoryFilters = document.querySelector("#categoryFilters");
const productGrid = document.querySelector("#productGrid");
const emptyProducts = document.querySelector("#emptyProducts");

const cartButton = document.querySelector("#cartButton");
const mobileCartButton = document.querySelector("#mobileCartButton");

const cartCount = document.querySelector("#cartCount");
const mobileCartCount = document.querySelector("#mobileCartCount");

const cartDrawer = document.querySelector("#cartDrawer");
const cartOverlay = document.querySelector("#cartOverlay");
const closeCartButton = document.querySelector("#closeCartButton");

const cartEmpty = document.querySelector("#cartEmpty");
const cartItems = document.querySelector("#cartItems");
const cartSummary = document.querySelector("#cartSummary");
const cartTotal = document.querySelector("#cartTotal");

const cartNotes = document.querySelector("#cartNotes");
const checkoutButton = document.querySelector("#checkoutButton");
const clearCartButton = document.querySelector("#clearCartButton");

const emptyCartMenuButton = document.querySelector("#emptyCartMenuButton");

const liveRegion = document.querySelector("#liveRegion");

const footerYear = document.querySelector("#footerYear");


/* =========================================================
   ESTADO DA INTERFACE
========================================================= */

let activeCategory = "todos";
let lastFocusedElement = null;


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
  const number = sanitizeWhatsAppNumber(
    siteConfig.whatsappNumber
  );

  return number.length >= 10 && number.length <= 15;
}


function getCategoryName(categoryId) {
  const category = categories.find(
    (item) => item.id === categoryId
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
      const property = element.dataset.config;

      if (
        property &&
        Object.prototype.hasOwnProperty.call(
          siteConfig,
          property
        )
      ) {
        element.textContent = siteConfig[property];
      }
    });


  const whatsappDisplay =
    document.querySelector("#contactWhatsappDisplay");

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
   LINKS DE WHATSAPP E INSTAGRAM
========================================================= */

function configureContactLinks() {
  const whatsappButtons = [
    document.querySelector("#headerWhatsappButton"),
    document.querySelector("#heroWhatsappButton"),
    document.querySelector("#contactWhatsappButton"),
    document.querySelector("#footerWhatsappLink")
  ].filter(Boolean);


  if (hasValidWhatsAppNumber()) {
    const number = sanitizeWhatsAppNumber(
      siteConfig.whatsappNumber
    );

    const message =
      `Olá! Vim pelo site da ${siteConfig.brandName} e gostaria de mais informações.`;

    const whatsappUrl =
      `https://wa.me/${number}?text=${encodeURIComponent(message)}`;

    whatsappButtons.forEach((button) => {
      button.href = whatsappUrl;

      button.removeAttribute("aria-disabled");
      button.removeAttribute("data-disabled-link");
    });
  } else {
    whatsappButtons.forEach((button) => {
      button.href = "#";

      button.setAttribute(
        "aria-disabled",
        "true"
      );

      button.dataset.disabledLink = "true";
    });
  }


  const instagramLinks = [
    document.querySelector("#instagramLink"),
    document.querySelector("#footerInstagramLink")
  ].filter(Boolean);


  const instagramConfigured =
    typeof siteConfig.instagramUrl === "string" &&
    siteConfig.instagramUrl.startsWith("http") &&
    !siteConfig.instagramUrl.includes(
      "INSTAGRAM"
    );


  instagramLinks.forEach((link) => {
    if (instagramConfigured) {
      link.href = siteConfig.instagramUrl;

      link.removeAttribute("aria-disabled");
      link.removeAttribute("data-disabled-link");
    } else {
      link.href = "#";

      link.setAttribute(
        "aria-disabled",
        "true"
      );

      link.dataset.disabledLink = "true";
    }
  });
}


/* =========================================================
   CATEGORIAS
========================================================= */

function renderCategories() {
  categoryFilters.innerHTML =
    categories
      .map((category) => {
        const active =
          category.id === activeCategory;

        return `
          <button
            type="button"
            class="category-filter ${
              active ? "is-active" : ""
            }"
            data-category="${escapeHTML(category.id)}"
            aria-pressed="${active}"
          >
            ${escapeHTML(category.name)}
          </button>
        `;
      })
      .join("");
}


/* =========================================================
   PRODUTOS
========================================================= */

function createProductImage(product) {
  if (product.image) {
    return `
      <img
        src="${escapeHTML(product.image)}"
        alt="${escapeHTML(product.imageAlt)}"
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
      ${getCategoryEmoji(product.category)}
    </div>
  `;
}


function renderProducts(products) {
  if (!products.length) {
    productGrid.innerHTML = "";
    emptyProducts.hidden = false;
    return;
  }

  emptyProducts.hidden = true;


  productGrid.innerHTML =
    products
      .map((product) => {
        return `
          <article class="product-card">

            <div class="product-image">

              ${createProductImage(product)}

              ${
                product.featured
                  ? `
                    <span class="product-badge">
                      Destaque
                    </span>
                  `
                  : ""
              }

            </div>


            <div class="product-content">

              <span class="product-category">
                ${escapeHTML(
                  getCategoryName(product.category)
                )}
              </span>


              <h3 class="product-name">
                ${escapeHTML(product.name)}
              </h3>


              <p class="product-description">
                ${escapeHTML(product.description)}
              </p>


              <div class="product-footer">

                <span class="product-price">
                  ${formatCurrency(product.price)}
                </span>


                <button
                  type="button"
                  class="add-to-cart-button"
                  data-action="add-to-cart"
                  data-product-id="${escapeHTML(product.id)}"
                  aria-label="Adicionar ${escapeHTML(product.name)} ao carrinho"
                >
                  <span aria-hidden="true">
                    +
                  </span>
                </button>

              </div>

            </div>

          </article>
        `;
      })
      .join("");
}


/* =========================================================
   FILTRAR PRODUTOS
========================================================= */

function selectCategory(categoryId) {
  activeCategory = categoryId;

  renderCategories();

  const filteredProducts =
    getProductsByCategory(categoryId);

  renderProducts(filteredProducts);
}


/* =========================================================
   IMAGENS DO CARRINHO
========================================================= */

function createCartItemImage(product) {
  if (product.image) {
    return `
      <img
        src="${escapeHTML(product.image)}"
        alt="${escapeHTML(product.imageAlt)}"
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
      ${getCategoryEmoji(product.category)}
    </div>
  `;
}


/* =========================================================
   CARRINHO
========================================================= */

function renderCart() {
  const items = getDetailedCartItems();
  const itemCount = getCartItemCount();
  const total = getCartTotal();


  cartCount.textContent = itemCount;
  mobileCartCount.textContent = itemCount;


  const itemText =
    itemCount === 1
      ? "1 item no carrinho"
      : `${itemCount} itens no carrinho`;


  cartCount.setAttribute(
    "aria-label",
    itemText
  );


  cartButton.setAttribute(
    "aria-label",
    `Abrir carrinho, ${itemText}`
  );


  mobileCartButton.setAttribute(
    "aria-label",
    `Abrir carrinho, ${itemText}`
  );


  mobileCartButton.classList.toggle(
    "is-visible",
    itemCount > 0
  );


  if (!items.length) {
    cartEmpty.hidden = false;
    cartSummary.hidden = true;

    cartItems.innerHTML = "";
    cartTotal.textContent =
      formatCurrency(0);

    return;
  }


  cartEmpty.hidden = true;
  cartSummary.hidden = false;


  cartItems.innerHTML =
    items
      .map((item) => {
        const product = item.product;

        return `
          <article
            class="cart-item"
            data-product-id="${escapeHTML(product.id)}"
          >

            <div class="cart-item-image">
              ${createCartItemImage(product)}
            </div>


            <div class="cart-item-info">

              <div class="cart-item-top">

                <div>

                  <h3 class="cart-item-name">
                    ${escapeHTML(product.name)}
                  </h3>

                  <p class="cart-item-price">
                    ${item.quantity} ×
                    ${formatCurrency(product.price)}
                  </p>

                </div>


                <button
                  type="button"
                  class="remove-cart-item"
                  data-action="remove"
                  data-product-id="${escapeHTML(product.id)}"
                  aria-label="Remover ${escapeHTML(product.name)} do carrinho"
                >
                  ×
                </button>

              </div>


              <div class="cart-item-bottom">

                <div
                  class="quantity-control"
                  aria-label="Quantidade de ${escapeHTML(product.name)}"
                >

                  <button
                    type="button"
                    class="quantity-button"
                    data-action="decrease"
                    data-product-id="${escapeHTML(product.id)}"
                    aria-label="Diminuir quantidade de ${escapeHTML(product.name)}"
                  >
                    −
                  </button>


                  <span
                    class="quantity-value"
                    aria-label="Quantidade atual: ${item.quantity}"
                  >
                    ${item.quantity}
                  </span>


                  <button
                    type="button"
                    class="quantity-button"
                    data-action="increase"
                    data-product-id="${escapeHTML(product.id)}"
                    aria-label="Aumentar quantidade de ${escapeHTML(product.name)}"
                  >
                    +
                  </button>

                </div>


                <strong class="cart-item-subtotal">
                  ${formatCurrency(item.subtotal)}
                </strong>

              </div>

            </div>

          </article>
        `;
      })
      .join("");


  cartTotal.textContent =
    formatCurrency(total);
}


/* =========================================================
   ABRIR / FECHAR CARRINHO
========================================================= */

function openCart() {
  lastFocusedElement =
    document.activeElement;

  cartOverlay.hidden = false;

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


  window.requestAnimationFrame(() => {
    cartOverlay.classList.add(
      "is-visible"
    );
  });


  window.setTimeout(() => {
    closeCartButton.focus();
  }, 100);
}


function closeCart() {
  if (
    lastFocusedElement instanceof HTMLElement &&
    document.contains(lastFocusedElement)
  ) {
    lastFocusedElement.focus();
  }


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


  window.setTimeout(() => {
    cartOverlay.hidden = true;
  }, 280);
}


/* =========================================================
   OBSERVAÇÕES DO PEDIDO
========================================================= */

function loadOrderNotes() {
  try {
    return (
      localStorage.getItem(
        siteConfig.storageKeys.orderNotes
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
      siteConfig.storageKeys.orderNotes,
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
      siteConfig.storageKeys.orderNotes
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
   EVENTOS DO CARDÁPIO
========================================================= */

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


productGrid.addEventListener(
  "click",
  (event) => {
    const button =
      event.target.closest(
        '[data-action="add-to-cart"]'
      );

    if (!button) {
      return;
    }


    const productId =
      button.dataset.productId;


    const added =
      addToCart(productId);


    if (!added) {
      announce(
        "Não foi possível adicionar este produto."
      );

      return;
    }


    renderCart();


    const productName =
      button
        .closest(".product-card")
        ?.querySelector(".product-name")
        ?.textContent
        ?.trim();


    announce(
      `${productName ?? "Produto"} adicionado ao carrinho.`
    );
  }
);


/* =========================================================
   EVENTOS DOS ITENS DO CARRINHO
========================================================= */

cartItems.addEventListener(
  "click",
  (event) => {
    const button =
      event.target.closest(
        "[data-action]"
      );

    if (!button) {
      return;
    }


    const action =
      button.dataset.action;

    const productId =
      button.dataset.productId;


    if (!productId) {
      return;
    }


    switch (action) {
      case "increase":
        increaseItem(productId);
        break;

      case "decrease":
        decreaseItem(productId);
        break;

      case "remove":
        removeFromCart(productId);

        announce(
          "Produto removido do carrinho."
        );
        break;

      default:
        return;
    }


    renderCart();
  }
);


/* =========================================================
   EVENTOS DO CARRINHO
========================================================= */

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
      .querySelector("#cardapio")
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
   OBSERVAÇÕES
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

checkoutButton.addEventListener(
  "click",
  () => {
    if (isCartEmpty()) {
      announce(
        "Seu carrinho está vazio."
      );

      return;
    }


    const opened =
      openWhatsAppOrder(
        cartNotes.value
      );


    if (!opened) {
      window.alert(
        "O número do WhatsApp da confeitaria ainda não foi configurado corretamente."
      );
    }
  }
);


/* =========================================================
   LINKS AINDA NÃO CONFIGURADOS
========================================================= */

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
   TECLADO
========================================================= */

document.addEventListener(
  "keydown",
  (event) => {
    if (event.key !== "Escape") {
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
   AJUSTE AO REDIMENSIONAR A TELA
========================================================= */

window.addEventListener(
  "resize",
  () => {
    if (window.innerWidth >= 900) {
      closeMenu();
    }
  }
);


/* =========================================================
   INICIALIZAÇÃO DO SITE
========================================================= */

function init() {
  applySiteConfig();

  configureContactLinks();

  renderCategories();

  renderProducts(
    getAvailableProducts()
  );


  cartNotes.value =
    loadOrderNotes();


  renderCart();
}


init();