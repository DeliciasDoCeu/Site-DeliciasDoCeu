export const categories = Object.freeze([
  {
    id: "todos",
    name: "Todos"
  },
  {
    id: "brigadeiros",
    name: "Brigadeiros"
  },
  {
    id: "brownies",
    name: "Brownies"
  },
  {
    id: "bolos",
    name: "Bolos"
  },
  {
    id: "doces",
    name: "Doces"
  },
  {
    id: "kits",
    name: "Kits"
  },
  {
    id: "presentes",
    name: "Presentes"
  },
  {
    id: "promocoes",
    name: "Promoções"
  }
]);

export const products = [
  {
    id: "brigadeiro-tradicional",
    name: "Brigadeiro Tradicional",
    description:
      "Brigadeiro artesanal preparado com ingredientes selecionados e muito carinho.",
    price: 3.5,
    category: "brigadeiros",
    image: "",
    imageAlt: "Brigadeiro tradicional da Delícias do Céu",
    featured: true,
    available: true
  },

  {
    id: "brigadeiro-gourmet",
    name: "Brigadeiro Gourmet",
    description:
      "Brigadeiro gourmet com sabor intenso e acabamento especial.",
    price: 4.5,
    category: "brigadeiros",
    image: "",
    imageAlt: "Brigadeiro gourmet da Delícias do Céu",
    featured: false,
    available: true
  },

  {
    id: "brownie-tradicional",
    name: "Brownie Tradicional",
    description:
      "Brownie macio por dentro, com casquinha delicada e sabor marcante de chocolate.",
    price: 8,
    category: "brownies",
    image: "",
    imageAlt: "Brownie tradicional da Delícias do Céu",
    featured: true,
    available: true
  },

  {
    id: "bolo-cenoura",
    name: "Bolo de Cenoura",
    description:
      "Bolo de cenoura fofinho com cobertura cremosa de chocolate.",
    price: 45,
    category: "bolos",
    image: "",
    imageAlt: "Bolo de cenoura com chocolate da Delícias do Céu",
    featured: true,
    available: true
  },

  {
    id: "doce-especial",
    name: "Doce Especial",
    description:
      "Uma opção artesanal preparada especialmente para adoçar o seu dia.",
    price: 12,
    category: "doces",
    image: "",
    imageAlt: "Doce artesanal da Delícias do Céu",
    featured: false,
    available: true
  },

  {
    id: "kit-presente",
    name: "Kit Presente",
    description:
      "Seleção especial de doces para presentear alguém especial.",
    price: 39.9,
    category: "presentes",
    image: "",
    imageAlt: "Kit presente com doces da Delícias do Céu",
    featured: false,
    available: true
  }
];

export function getProductById(productId) {
  return products.find((product) => product.id === productId);
}

export function getAvailableProducts() {
  return products.filter((product) => product.available);
}

export function getFeaturedProducts() {
  return products.filter(
    (product) => product.available && product.featured
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