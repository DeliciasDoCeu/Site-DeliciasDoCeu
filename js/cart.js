import { siteConfig } from "./config.js";
import { getProductById } from "./products.js";

let cart = loadCart();

/**
 * Carrega o carrinho salvo no navegador.
 * Se não existir ou estiver corrompido, retorna um carrinho vazio.
 */
function loadCart() {
  try {
    const savedCart = localStorage.getItem(siteConfig.storageKeys.cart);

    if (!savedCart) {
      return [];
    }

    const parsedCart = JSON.parse(savedCart);

    if (!Array.isArray(parsedCart)) {
      return [];
    }

    return parsedCart.filter((item) => {
      return (
        typeof item.productId === "string" &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0
      );
    });
  } catch (error) {
    console.error("Não foi possível carregar o carrinho:", error);
    return [];
  }
}

/**
 * Salva o carrinho no navegador.
 */
function saveCart() {
  try {
    localStorage.setItem(
      siteConfig.storageKeys.cart,
      JSON.stringify(cart)
    );
  } catch (error) {
    console.error("Não foi possível salvar o carrinho:", error);
  }
}

/**
 * Retorna uma cópia simples do estado atual do carrinho.
 */
export function getCart() {
  return cart.map((item) => ({ ...item }));
}

/**
 * Adiciona um produto ao carrinho.
 */
export function addToCart(productId, quantity = 1) {
  const product = getProductById(productId);

  if (!product || !product.available) {
    return false;
  }

  const safeQuantity = Math.max(
    1,
    Math.floor(Number(quantity) || 1)
  );

  const existingItem = cart.find(
    (item) => item.productId === productId
  );

  if (existingItem) {
    existingItem.quantity += safeQuantity;
  } else {
    cart.push({
      productId,
      quantity: safeQuantity
    });
  }

  saveCart();

  return true;
}

/**
 * Define uma quantidade específica para um produto.
 */
export function setItemQuantity(productId, quantity) {
  const numericQuantity = Math.floor(Number(quantity));

  if (!Number.isFinite(numericQuantity)) {
    return false;
  }

  if (numericQuantity <= 0) {
    removeFromCart(productId);
    return true;
  }

  const item = cart.find(
    (cartItem) => cartItem.productId === productId
  );

  if (!item) {
    return false;
  }

  item.quantity = numericQuantity;

  saveCart();

  return true;
}

/**
 * Aumenta a quantidade de um produto em uma unidade.
 */
export function increaseItem(productId) {
  const item = cart.find(
    (cartItem) => cartItem.productId === productId
  );

  if (!item) {
    return false;
  }

  item.quantity += 1;

  saveCart();

  return true;
}

/**
 * Diminui a quantidade de um produto em uma unidade.
 * Se chegar a zero, remove o produto.
 */
export function decreaseItem(productId) {
  const item = cart.find(
    (cartItem) => cartItem.productId === productId
  );

  if (!item) {
    return false;
  }

  if (item.quantity <= 1) {
    removeFromCart(productId);
    return true;
  }

  item.quantity -= 1;

  saveCart();

  return true;
}

/**
 * Remove um produto completamente do carrinho.
 */
export function removeFromCart(productId) {
  const originalLength = cart.length;

  cart = cart.filter(
    (item) => item.productId !== productId
  );

  if (cart.length === originalLength) {
    return false;
  }

  saveCart();

  return true;
}

/**
 * Remove todos os produtos do carrinho.
 */
export function clearCart() {
  cart = [];
  saveCart();
}

/**
 * Retorna os itens do carrinho já combinados
 * com as informações dos produtos.
 */
export function getDetailedCartItems() {
  return cart
    .map((item) => {
      const product = getProductById(item.productId);

      if (!product || !product.available) {
        return null;
      }

      return {
        ...item,
        product,
        subtotal: product.price * item.quantity
      };
    })
    .filter(Boolean);
}

/**
 * Retorna a quantidade total de unidades no carrinho.
 *
 * Exemplo:
 * 2 brownies + 3 brigadeiros = 5 itens
 */
export function getCartItemCount() {
  return getDetailedCartItems().reduce(
    (total, item) => total + item.quantity,
    0
  );
}

/**
 * Calcula o valor total do carrinho.
 */
export function getCartTotal() {
  return getDetailedCartItems().reduce(
    (total, item) => total + item.subtotal,
    0
  );
}

/**
 * Verifica se o carrinho está vazio.
 */
export function isCartEmpty() {
  return getDetailedCartItems().length === 0;
}