const STORAGE_KEY = "meu-carrinho-v1";

// Estado da aplicação
let products = [];
let sortMode = "insertion";
let insertionOrder = [];
let manualOrder = [];
let deletedProduct = null;

// Elementos
const form = document.querySelector("#product-form");
const nameInput = document.querySelector("#name");
const priceInput = document.querySelector("#price");
const promoInput = document.querySelector("#promo");
const quantityInput = document.querySelector("#quantity");
const categoryInput = document.querySelector("#category");
const editingIdInput = document.querySelector("#editing-id");

const productList = document.querySelector("#product-list");
const sortSelect = document.querySelector("#sort-mode");
const errorElement = document.querySelector("#form-error");

const money = value =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);

const parseMoney = value => {
  if (!value.trim()) return null;

  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(/R\$/gi, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const number = Number(normalized);

  return Number.isFinite(number) ? number : NaN;
};

const effectivePrice = product =>
  product.promotionalPrice ?? product.price;

const getProductTotal = product =>
  effectivePrice(product) * product.quantity;

const getProductDiscount = product => {
  if (
    product.price === null ||
    product.promotionalPrice === null
  ) {
    return 0;
  }

  return Math.max(
    0,
    product.price - product.promotionalPrice
  ) * product.quantity;
};

const getProductSubtotal = product =>
  (product.price ?? product.promotionalPrice) *
  product.quantity;

// Persistência
function save() {
  const data = {
    products,
    sortMode,
    insertionOrder,
    manualOrder
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Não foi possível salvar a lista:", error);
    alert("Não foi possível salvar os dados neste navegador.");
  }
}

function load() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) return;

    const data = JSON.parse(saved);

    products = Array.isArray(data.products)
      ? data.products
      : [];

    insertionOrder = Array.isArray(data.insertionOrder)
      ? data.insertionOrder
      : products.map(product => product.id);

    manualOrder = Array.isArray(data.manualOrder)
      ? data.manualOrder
      : [...insertionOrder];

    const validModes = [
      "insertion",
      "manual",
      "alphabetical",
      "category"
    ];

    sortMode = validModes.includes(data.sortMode)
      ? data.sortMode
      : "insertion";

    syncOrders();
  } catch (error) {
    console.error("Erro ao carregar dados:", error);
    products = [];
    insertionOrder = [];
    manualOrder = [];
  }
}

function syncOrders() {
  const ids = new Set(products.map(product => product.id));

  insertionOrder = insertionOrder.filter(id => ids.has(id));
  manualOrder = manualOrder.filter(id => ids.has(id));

  products.forEach(product => {
    if (!insertionOrder.includes(product.id)) {
      insertionOrder.push(product.id);
    }

    if (!manualOrder.includes(product.id)) {
      manualOrder.push(product.id);
    }
  });
}

// Ordenação
function getOrderedProducts() {
  const byId = new Map(products.map(product => [product.id, product]));

  if (sortMode === "insertion") {
    return insertionOrder
      .map(id => byId.get(id))
      .filter(Boolean);
  }

  if (sortMode === "manual") {
    return manualOrder
      .map(id => byId.get(id))
      .filter(Boolean);
  }

  const result = [...products];

  if (sortMode === "alphabetical") {
    return result.sort((a, b) =>
      (a.name || "Sem nome").localeCompare(
        b.name || "Sem nome",
        "pt-BR",
        { sensitivity: "base" }
      )
    );
  }

  if (sortMode === "category") {
    return result.sort((a, b) => {
      const categoryA = a.category || "zzz";
      const categoryB = b.category || "zzz";

      const comparison = categoryA.localeCompare(
        categoryB,
        "pt-BR",
        { sensitivity: "base" }
      );

      if (comparison !== 0) return comparison;

      return (a.name || "").localeCompare(
        b.name || "",
        "pt-BR",
        { sensitivity: "base" }
      );
    });
  }

  return result;
}

// Resumo financeiro
function renderSummary() {
  const subtotal = products.reduce(
    (sum, product) => sum + getProductSubtotal(product),
    0
  );

  const discounts = products.reduce(
    (sum, product) => sum + getProductDiscount(product),
    0
  );

  const total = products.reduce(
    (sum, product) => sum + getProductTotal(product),
    0
  );

  const quantity = products.reduce(
    (sum, product) => sum + product.quantity,
    0
  );

  document.querySelector("#subtotal").textContent = money(subtotal);
  document.querySelector("#discounts").textContent = money(discounts);
  document.querySelector("#total").textContent = money(total);

  document.querySelector("#item-count").textContent =
    `${products.length} ${products.length === 1 ? "produto" : "produtos"} · ${quantity} ${quantity === 1 ? "unidade" : "unidades"}`;
}

function renderProducts() {
  productList.replaceChildren();

  const ordered = getOrderedProducts();

  document.querySelector("#list-description").textContent =
    `${products.length} ${products.length === 1 ? "produto cadastrado" : "produtos cadastrados"}`;

  if (ordered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `
      <span class="empty-icon">🛒</span>
      <strong>Seu carrinho está vazio</strong>
      <p>Adicione seu primeiro produto acima.</p>
    `;
    productList.appendChild(empty);
    return;
  }

  let previousCategory = null;

  ordered.forEach(product => {
    if (sortMode === "category") {
      const category = product.category || "Sem categoria";

      if (category !== previousCategory) {
        const heading = document.createElement("div");
        heading.className = "category-heading";
        heading.textContent = category;
        productList.appendChild(heading);
        previousCategory = category;
      }
    }

    productList.appendChild(createProductRow(product));
  });
}

function createProductRow(product) {
  const row = document.createElement("div");
  row.className = "product-row";
  row.dataset.id = product.id;
  row.draggable = false;

  const handle = document.createElement("div");
  handle.className = "drag-handle";
  handle.textContent = "⠿";
  handle.title = "Arraste para reordenar";
  handle.setAttribute("aria-label", "Arrastar para reordenar");

  const info = document.createElement("div");
  info.className = "product-info";

  const productName = document.createElement("div");
  productName.className = "product-name";
  productName.textContent = product.name || "Produto sem nome";

  const meta = document.createElement("div");
  meta.className = "product-meta";

  const quantity = document.createElement("span");
  quantity.textContent = `${product.quantity} un.`;
  meta.appendChild(quantity);

  if (product.category) {
    const category = document.createElement("span");
    category.className = "category-tag";
    category.textContent = product.category;
    meta.appendChild(category);
  }

  if (product.price !== null && product.promotionalPrice !== null) {
    const saving = document.createElement("span");
    saving.textContent = `Economia de ${money(
      product.price - product.promotionalPrice
    )}/un.`;
    meta.appendChild(saving);
  }

  info.append(productName, meta);

  const price = document.createElement("div");
  price.className = "product-price";

  const currentPrice = document.createElement("strong");
  currentPrice.textContent = money(getProductTotal(product));

  price.appendChild(currentPrice);

  if (
    product.price !== null &&
    product.promotionalPrice !== null
  ) {
    const oldPrice = document.createElement("del");
    oldPrice.textContent = money(product.price * product.quantity);
    price.appendChild(oldPrice);
  }

  const actions = document.createElement("div");
  actions.className = "product-actions";

  const editButton = document.createElement("button");
  editButton.className = "icon-button";
  editButton.type = "button";
  editButton.textContent = "✎";
  editButton.title = "Editar produto";
  editButton.setAttribute("aria-label", "Editar produto");
  editButton.dataset.action = "edit";

  const deleteButton = document.createElement("button");
  deleteButton.className = "icon-button delete";
  deleteButton.type = "button";
  deleteButton.textContent = "×";
  deleteButton.title = "Remover produto";
  deleteButton.setAttribute("aria-label", "Remover produto");
  deleteButton.dataset.action = "delete";

  actions.append(editButton, deleteButton);
  row.append(handle, info, price, actions);

  return row;
}

function render() {
  renderSummary();
  renderProducts();
  renderCategorySuggestions();
}

// Sugestões de categorias
function renderCategorySuggestions() {
  const categories = [...new Set(
    products
      .map(product => product.category)
      .filter(Boolean)
  )];

  const datalist = document.querySelector("#category-suggestions");
  datalist.replaceChildren();

  categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category;
    datalist.appendChild(option);
  });
}

// Cadastro e edição
function resetForm() {
  form.reset();
  editingIdInput.value = "";
  quantityInput.value = "1";

  document.querySelector("#form-title").textContent = "Adicionar produto";
  document.querySelector("#submit-label").textContent = "+ Adicionar produto";

  document.querySelector("#cancel-edit").classList.add("hidden");
  errorElement.textContent = "";
}

form.addEventListener("submit", event => {
  event.preventDefault();

  errorElement.textContent = "";

  const name = nameInput.value.trim();
  const price = parseMoney(priceInput.value);
  const promo = parseMoney(promoInput.value);
  const quantity = Number(quantityInput.value);
  const category = categoryInput.value.trim();

  if (price === null && promo === null) {
    errorElement.textContent =
      "Informe pelo menos o preço cheio ou o promocional.";
    priceInput.focus();
    return;
  }

  if (
    (price !== null && (!Number.isFinite(price) || price < 0)) ||
    (promo !== null && (!Number.isFinite(promo) || promo < 0))
  ) {
    errorElement.textContent = "Informe preços válidos.";
    return;
  }

  if (price === 0 && promo === 0) {
    errorElement.textContent = "O preço deve ser maior que zero.";
    return;
  }

  if (price !== null && promo !== null && promo > price) {
    errorElement.textContent =
      "O preço promocional não pode ser maior que o preço cheio.";
    promoInput.focus();
    return;
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    errorElement.textContent = "Informe uma quantidade válida.";
    quantityInput.focus();
    return;
  }

  const editingId = editingIdInput.value;

  if (editingId) {
    const index = products.findIndex(product => product.id === editingId);

    if (index !== -1) {
      products[index] = {
        ...products[index],
        name,
        price,
        promotionalPrice: promo,
        quantity,
        category
      };
    }
  } else {
    const product = {
      id: crypto.randomUUID(),
      name,
      price,
      promotionalPrice: promo,
      quantity,
      category,
      createdAt: Date.now()
    };

    products.push(product);
    insertionOrder.push(product.id);
    manualOrder.push(product.id);
  }

  save();
  resetForm();
  render();
  nameInput.focus();
});

// Edição e exclusão
productList.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const row = button.closest(".product-row");
  if (!row) return;

  const product = products.find(item => item.id === row.dataset.id);
  if (!product) return;

  if (button.dataset.action === "edit") {
    editProduct(product);
  }

  if (button.dataset.action === "delete") {
    deleteProduct(product);
  }
});

function editProduct(product) {
  nameInput.value = product.name;
  priceInput.value = product.price === null
    ? ""
    : product.price.toFixed(2).replace(".", ",");

  promoInput.value = product.promotionalPrice === null
    ? ""
    : product.promotionalPrice.toFixed(2).replace(".", ",");

  quantityInput.value = product.quantity;
  categoryInput.value = product.category;
  editingIdInput.value = product.id;

  document.querySelector("#form-title").textContent = "Editar produto";
  document.querySelector("#submit-label").textContent = "Salvar alterações";
  document.querySelector("#cancel-edit").classList.remove("hidden");

  errorElement.textContent = "";

  window.scrollTo({ top: 0, behavior: "smooth" });
  nameInput.focus();
}

function deleteProduct(product) {
  deletedProduct = {
    product,
    insertionIndex: insertionOrder.indexOf(product.id),
    manualIndex: manualOrder.indexOf(product.id)
  };

  products = products.filter(item => item.id !== product.id);
  insertionOrder = insertionOrder.filter(id => id !== product.id);
  manualOrder = manualOrder.filter(id => id !== product.id);

  save();
  render();

  document.querySelector("#undo-container").classList.remove("hidden");
}

function undoDelete() {
  if (!deletedProduct) return;

  const { product, insertionIndex, manualIndex } = deletedProduct;

  products.push(product);

  insertionOrder.splice(
    Math.max(0, insertionIndex),
    0,
    product.id
  );

  manualOrder.splice(
    Math.max(0, manualIndex),
    0,
    product.id
  );

  deletedProduct = null;

  document.querySelector("#undo-container").classList.add("hidden");

  save();
  render();
}

document.querySelector("#cancel-edit").addEventListener("click", () => {
  resetForm();
  nameInput.focus();
});

document.querySelector("#undo-btn").addEventListener("click", undoDelete);

// Ordenação
sortSelect.value = sortMode;

sortSelect.addEventListener("change", () => {
  sortMode = sortSelect.value;
  save();
  renderProducts();
});

// Limpar lista
document.querySelector("#clear-btn").addEventListener("click", () => {
  if (products.length === 0) return;

  const confirmed = confirm(
    "Tem certeza que deseja remover todos os produtos da lista?"
  );

  if (!confirmed) return;

  products = [];
  insertionOrder = [];
  manualOrder = [];
  deletedProduct = null;

  document.querySelector("#undo-container").classList.add("hidden");

  resetForm();
  save();
  render();
});

// Drag and drop com suporte a mouse e toque
let draggingId = null;
let dragTargetId = null;
let dragPointerId = null;

function startDragging(event) {
  const handle = event.target.closest(".drag-handle");
  if (!handle) return;

  if (event.button !== undefined && event.button !== 0) return;

  const row = handle.closest(".product-row");
  if (!row) return;

  event.preventDefault();

  draggingId = row.dataset.id;
  dragPointerId = event.pointerId;
  dragTargetId = draggingId;

  handle.setPointerCapture(event.pointerId);
  row.classList.add("dragging");
}

function moveDragging(event) {
  if (!draggingId || event.pointerId !== dragPointerId) return;

  event.preventDefault();

  document.querySelectorAll(".product-row").forEach(row => {
    row.classList.remove("drag-over");
  });

  const target = document.elementFromPoint(
    event.clientX,
    event.clientY
  )?.closest(".product-row");

  if (!target || target.dataset.id === draggingId) return;

  dragTargetId = target.dataset.id;
  target.classList.add("drag-over");
}

function finishDragging(event) {
  if (!draggingId || event.pointerId !== dragPointerId) return;

  const sourceId = draggingId;
  const targetId = dragTargetId;

  document.querySelectorAll(".product-row").forEach(row => {
    row.classList.remove("dragging", "drag-over");
  });

  draggingId = null;
  dragTargetId = null;
  dragPointerId = null;

  if (!targetId || sourceId === targetId) return;

  const currentIds = getOrderedProducts().map(product => product.id);

  const sourceIndex = currentIds.indexOf(sourceId);
  const targetIndex = currentIds.indexOf(targetId);

  if (sourceIndex === -1 || targetIndex === -1) return;

  currentIds.splice(sourceIndex, 1);
  currentIds.splice(targetIndex, 0, sourceId);

  manualOrder = currentIds;
  sortMode = "manual";
  sortSelect.value = "manual";

  save();
  renderProducts();
}

productList.addEventListener("pointerdown", startDragging);
productList.addEventListener("pointermove", moveDragging);
productList.addEventListener("pointerup", finishDragging);
productList.addEventListener("pointercancel", finishDragging);

// Inicialização
load();
sortSelect.value = sortMode;
render();
