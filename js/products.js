export const categories = Object.freeze([
  {
    id: "todos",
    name: "Todos"
  },
  {
    id: "doces",
    name: "Doces"
  }
]);


export const products = [
  {
    id: "morango-cravejado",

    name: "Morango Cravejado",

    description:
      "Morango cravejado preparado artesanalmente, com acabamento caprichado e uma apresentação irresistível. Uma opção especial para adoçar o dia ou presentear alguém.",

    price: 15,

    category: "doces",

    image: "",

    imageAlt:
      "Morango Cravejado da Delicias Do Ceu",

    featured: true,

    available: true
  }
];


export function getProductById(productId) {
  return products.find(
    (product) => product.id === productId
  );
}


export function getAvailableProducts() {
  return products.filter(
    (product) => product.available
  );
}


export function getFeaturedProducts() {
  return products.filter(
    (product) =>
      product.available &&
      product.featured
  );
}


export function getProductsByCategory(categoryId) {
  if (categoryId === "todos") {
    return getAvailableProducts();
  }

  return products.filter(
    (product) =>
      product.available &&
      product.category === categoryId
  );
}