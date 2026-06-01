const STORAGE_KEYS = {
  user: "roomGroom:user",
  cart: "roomGroom:cart",
  orders: "roomGroom:orders",
  feedback: "roomGroom:feedback"
};

const localImages = [
  "./assets/service-yorkie.png",
  "./assets/service-corgi-bath.png",
  "./assets/service-pomeranian.png",
  "./assets/service-cat.png"
];

const defaultHistory = [
  {
    id: "demo-2804",
    date: "28.04.2026",
    status: "Выполнено",
    total: 4000,
    items: [{ title: "Йоркширский терьер - комплексный уход", priceLabel: "4 000 ₽" }]
  },
  {
    id: "demo-1503",
    date: "15.03.2026",
    status: "Выполнено",
    total: 1800,
    items: [{ title: "Стрижка когтей и гигиена", priceLabel: "1 800 ₽" }]
  }
];

const state = {
  catalog: null,
  services: [],
  breeds: [],
  user: readStorage(STORAGE_KEYS.user, null),
  cart: readStorage(STORAGE_KEYS.cart, []),
  orders: readStorage(STORAGE_KEYS.orders, []),
  feedback: readStorage(STORAGE_KEYS.feedback, []),
  serviceLimit: 12,
  breedLimit: 18,
  serviceQuery: "",
  serviceType: "all",
  breedQuery: ""
};

const els = {};

document.addEventListener("DOMContentLoaded", async () => {
  bindElements();
  setDefaultDate();
  bindEvents();
  await loadCatalog();
  hydrateProfileForm();
  renderAll();
});

function bindElements() {
  [
    "servicesMetric",
    "breedsMetric",
    "sourceMeta",
    "heroServiceTitle",
    "heroServicePrice",
    "headerPhone",
    "headerCartCount",
    "servicesGrid",
    "showMoreServices",
    "serviceSearch",
    "serviceTypeFilter",
    "breedSearch",
    "breedList",
    "showMoreBreeds",
    "bookingForm",
    "bookingBreed",
    "bookingService",
    "bookingDate",
    "bookingTime",
    "bookingComment",
    "petName",
    "cartList",
    "cartTotal",
    "clearCart",
    "checkoutButton",
    "checkoutHint",
    "authForm",
    "authName",
    "authPhoneInput",
    "authEmail",
    "profileState",
    "logoutButton",
    "historyList",
    "newsletterForm",
    "smsConsent",
    "emailConsent",
    "feedbackForm",
    "feedbackMessage",
    "feedbackStatus",
    "companyAddress",
    "companySchedule",
    "companyPhone",
    "mapRouteLink",
    "toast"
  ].forEach(id => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
  els.serviceSearch.addEventListener("input", event => {
    state.serviceQuery = event.target.value.trim();
    state.serviceLimit = 12;
    renderServices();
  });

  els.serviceTypeFilter.addEventListener("change", event => {
    state.serviceType = event.target.value;
    state.serviceLimit = 12;
    renderServices();
  });

  els.showMoreServices.addEventListener("click", () => {
    state.serviceLimit += 12;
    renderServices();
  });

  els.breedSearch.addEventListener("input", event => {
    state.breedQuery = event.target.value.trim();
    state.breedLimit = 18;
    renderBreeds();
  });

  els.showMoreBreeds.addEventListener("click", () => {
    state.breedLimit += 18;
    renderBreeds();
  });

  els.bookingBreed.addEventListener("change", renderBookingServices);

  els.bookingForm.addEventListener("submit", event => {
    event.preventDefault();
    const service = findService(els.bookingService.value);
    if (!service) {
      showToast("Выберите услугу для записи.");
      return;
    }
    addToCart(service, {
      petName: els.petName.value.trim(),
      breedId: Number(els.bookingBreed.value) || null,
      date: els.bookingDate.value,
      time: els.bookingTime.value,
      comment: els.bookingComment.value.trim()
    });
    els.bookingComment.value = "";
  });

  els.clearCart.addEventListener("click", () => {
    state.cart = [];
    saveStorage(STORAGE_KEYS.cart, state.cart);
    renderCart();
    showToast("Корзина очищена.");
  });

  els.checkoutButton.addEventListener("click", checkout);

  els.authForm.addEventListener("submit", event => {
    event.preventDefault();
    state.user = {
      name: els.authName.value.trim() || "Клиент Room Groom",
      phone: els.authPhoneInput.value.trim(),
      email: els.authEmail.value.trim(),
      smsConsent: els.smsConsent.checked,
      emailConsent: els.emailConsent.checked
    };
    saveStorage(STORAGE_KEYS.user, state.user);
    postDemo("/api/auth/demo", state.user);
    renderProfile();
    showToast("Демо-профиль активирован.");
  });

  els.logoutButton.addEventListener("click", () => {
    state.user = null;
    saveStorage(STORAGE_KEYS.user, state.user);
    hydrateProfileForm();
    renderProfile();
    showToast("Вы вышли из демо-профиля.");
  });

  els.newsletterForm.addEventListener("submit", event => {
    event.preventDefault();
    if (!state.user) {
      showToast("Сначала войдите в профиль.");
      return;
    }
    state.user.smsConsent = els.smsConsent.checked;
    state.user.emailConsent = els.emailConsent.checked;
    saveStorage(STORAGE_KEYS.user, state.user);
    postDemo("/api/profile", state.user, "PUT");
    renderProfile();
    showToast("Настройки рассылок сохранены.");
  });

  els.feedbackForm.addEventListener("submit", event => {
    event.preventDefault();
    const message = els.feedbackMessage.value.trim();
    if (!message) {
      showToast("Напишите сообщение для салона.");
      return;
    }
    const entry = {
      id: createId("feedback"),
      date: formatDate(new Date()),
      message,
      user: state.user ? state.user.name : "Гость"
    };
    state.feedback.unshift(entry);
    saveStorage(STORAGE_KEYS.feedback, state.feedback);
    postDemo("/api/feedback", entry);
    els.feedbackMessage.value = "";
    els.feedbackStatus.textContent = "Последнее сообщение сохранено: " + entry.date;
    showToast("Сообщение сохранено.");
  });

  document.body.addEventListener("click", event => {
    const addButton = event.target.closest("[data-add-service]");
    if (addButton) {
      const service = findService(addButton.dataset.addService);
      if (service) addToCart(service, {});
      return;
    }

    const removeButton = event.target.closest("[data-remove-cart]");
    if (removeButton) {
      state.cart = state.cart.filter(item => item.id !== removeButton.dataset.removeCart);
      saveStorage(STORAGE_KEYS.cart, state.cart);
      renderCart();
      showToast("Услуга убрана из заказа.");
    }
  });
}

async function loadCatalog() {
  document.body.classList.add("is-loading");
  try {
    state.catalog = await getCatalog();
    state.services = state.catalog.services || [];
    state.breeds = state.catalog.breeds || [];
  } catch (error) {
    console.error(error);
    showToast("Не удалось загрузить каталог. Проверьте data/catalog.json.");
  } finally {
    document.body.classList.remove("is-loading");
  }
}

async function getCatalog() {
  const apiResponse = await fetch("/api/catalog", { headers: { accept: "application/json" } }).catch(() => null);
  if (apiResponse && apiResponse.ok) return apiResponse.json();

  const localResponse = await fetch("./data/catalog.json?v=2", { headers: { accept: "application/json" } });
  if (!localResponse.ok) throw new Error("Catalog file not found");
  return localResponse.json();
}

function renderAll() {
  renderCompany();
  renderMetrics();
  renderServices();
  renderBreeds();
  renderBookingBreeds();
  renderCart();
  renderProfile();
}

function renderCompany() {
  const company = state.catalog?.company;
  if (!company) return;

  els.companyAddress.textContent = `${company.city}, ${company.address}`;
  els.companySchedule.textContent = company.schedule.replace(/\u2013/g, "-");
  els.companyPhone.textContent = company.phone;
  els.headerPhone.href = "tel:" + company.phone.replace(/[^\d+]/g, "");
  els.headerPhone.querySelector("span").textContent = company.phone;
  els.headerPhone.querySelector("small").textContent = company.schedule.replace("пн.- вс.:", "").replace(/\u2013/g, "-").trim();

  const coords = `${company.coordinateLat},${company.coordinateLon}`;
  els.mapRouteLink.href = `https://yandex.ru/maps/?rtext=~${coords}&rtt=auto`;
}

function renderMetrics() {
  const stats = state.catalog?.stats || {};
  els.servicesMetric.textContent = stats.services || state.services.length || 0;
  els.breedsMetric.textContent = stats.breeds || state.breeds.length || 0;

  const fetchedAt = state.catalog?.source?.fetchedAt ? new Date(state.catalog.source.fetchedAt) : null;
  els.sourceMeta.textContent = fetchedAt
    ? `Данные обновлены ${fetchedAt.toLocaleDateString("ru-RU")}`
    : "Данные каталога готовы";

  const featured = state.services.find(service => service.categoryType === "breed" && service.priceMin) || state.services[0];
  if (featured) {
    els.heroServiceTitle.textContent = featured.title;
    els.heroServicePrice.textContent = featured.priceLabel;
  }
}

function renderServices() {
  const filtered = getFilteredServices();
  const visible = filtered.slice(0, state.serviceLimit);
  els.servicesGrid.innerHTML = visible.map((service, index) => serviceCardTemplate(service, index)).join("");
  els.showMoreServices.hidden = filtered.length <= visible.length;

  if (!filtered.length) {
    els.servicesGrid.innerHTML = `<div class="cart-empty">По этому запросу услуг не найдено. Попробуйте другую породу или тип ухода.</div>`;
  }
}

function serviceCardTemplate(service, index) {
  const image = service.image || localImages[index % localImages.length];
  const kind = getKindLabel(service.categoryType);
  const description = service.comment || `${service.categoryTitle}. Длительность: ${service.durationMinutes ? service.durationMinutes + " мин" : "уточним при записи"}.`;

  return `
    <article class="service-card">
      <figure>
        ${
          image
            ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(service.title)}" loading="lazy" />`
            : `<span class="service-letter">${escapeHtml(service.title.slice(0, 1))}</span>`
        }
        <span class="service-kind">${escapeHtml(kind)}</span>
      </figure>
      <div class="service-card-content">
        <h3>${escapeHtml(service.title)}</h3>
        <p>${escapeHtml(description)}</p>
        <p>${escapeHtml(service.categoryTitle)}</p>
        <div class="service-card-footer">
          <strong class="price">${escapeHtml(service.priceLabel)}</strong>
          <button class="small-button" type="button" data-add-service="${service.id}">В заказ</button>
        </div>
      </div>
    </article>
  `;
}

function renderBreeds() {
  const filtered = getFilteredBreeds();
  const visible = filtered.slice(0, state.breedLimit);
  els.breedList.innerHTML = visible.map(breed => breedTemplate(breed)).join("");
  els.showMoreBreeds.hidden = filtered.length <= visible.length;

  if (!filtered.length) {
    els.breedList.innerHTML = `<div class="cart-empty">Порода не найдена. Можно выбрать категорию "Метисы" или написать в салон.</div>`;
  }
}

function breedTemplate(breed) {
  const example = breed.examples?.[0];
  return `
    <article class="breed-item">
      <header>
        <b>${escapeHtml(breed.title)}</b>
        <strong>${escapeHtml(breed.fromLabel)}</strong>
      </header>
      <span>${breed.servicesCount} ${plural(breed.servicesCount, ["услуга", "услуги", "услуг"])}</span>
      ${example ? `<span>${escapeHtml(example.title)}: ${escapeHtml(example.priceLabel)}</span>` : ""}
    </article>
  `;
}

function renderBookingBreeds() {
  const preferred = state.breeds.slice(0, 90);
  els.bookingBreed.innerHTML = [
    `<option value="">Выбрать позже</option>`,
    ...preferred.map(breed => `<option value="${breed.id}">${escapeHtml(breed.title)} · ${escapeHtml(breed.fromLabel)}</option>`)
  ].join("");
  renderBookingServices();
}

function renderBookingServices() {
  const breedId = Number(els.bookingBreed.value);
  const services = breedId ? state.services.filter(service => service.categoryId === breedId) : getFilteredServices().slice(0, 80);
  const source = services.length ? services : state.services.slice(0, 80);
  els.bookingService.innerHTML = source
    .map(service => `<option value="${service.id}">${escapeHtml(service.title)} · ${escapeHtml(service.priceLabel)}</option>`)
    .join("");
}

function renderCart() {
  els.headerCartCount.textContent = state.cart.length;

  if (!state.cart.length) {
    els.cartList.innerHTML = `<div class="cart-empty">Добавьте услугу из каталога или формы записи.</div>`;
  } else {
    els.cartList.innerHTML = state.cart.map(cartItemTemplate).join("");
  }

  els.cartTotal.textContent = formatMoney(getCartTotal());
  els.checkoutHint.textContent = state.user
    ? `Заказ будет сохранен в профиль ${state.user.name}.`
    : "Авторизуйтесь в профиле, чтобы сохранить заказ в истории.";
}

function cartItemTemplate(item) {
  const dateText = item.date ? `${formatInputDate(item.date)} в ${item.time || "любое время"}` : "Время выберем при подтверждении";
  return `
    <article class="cart-item">
      <header>
        <b>${escapeHtml(item.title)}</b>
        <button class="remove-button" type="button" data-remove-cart="${escapeAttr(item.id)}">Убрать</button>
      </header>
      <p>${escapeHtml(item.categoryTitle || "Каталог услуг")}</p>
      <p>${escapeHtml(dateText)}</p>
      <strong class="price">${escapeHtml(item.priceLabel)}</strong>
    </article>
  `;
}

function renderProfile() {
  if (state.user) {
    els.profileState.innerHTML = `
      <div class="state-card">
        <b>${escapeHtml(state.user.name)}</b><br />
        ${escapeHtml(state.user.phone || "телефон не указан")}<br />
        ${escapeHtml(state.user.email || "email не указан")}
      </div>
    `;
    els.smsConsent.checked = Boolean(state.user.smsConsent);
    els.emailConsent.checked = Boolean(state.user.emailConsent);
  } else {
    els.profileState.innerHTML = `<div class="state-card">Войдите в демо-профиль, чтобы сохранять заказы и сообщения.</div>`;
  }

  const history = [...state.orders, ...defaultHistory];
  els.historyList.innerHTML = history.length
    ? history.map(historyItemTemplate).join("")
    : `<div class="history-empty">История появится после первого заказа.</div>`;
}

function historyItemTemplate(order) {
  const items = order.items || [];
  const title = items.map(item => item.title).join(", ");
  return `
    <article class="history-item">
      <header>
        <b>${escapeHtml(order.date)}</b>
        <strong class="price">${formatMoney(order.total || sumItems(items))}</strong>
      </header>
      <p>${escapeHtml(order.status || "Заявка создана")}</p>
      <p>${escapeHtml(title || "Услуги Room Groom")}</p>
    </article>
  `;
}

function hydrateProfileForm() {
  if (!state.user) return;
  els.authName.value = state.user.name || "";
  els.authPhoneInput.value = state.user.phone || "";
  els.authEmail.value = state.user.email || "";
  els.smsConsent.checked = Boolean(state.user.smsConsent);
  els.emailConsent.checked = Boolean(state.user.emailConsent);
}

function addToCart(service, details) {
  const item = {
    id: createId("cart"),
    serviceId: service.id,
    title: service.title,
    categoryTitle: service.categoryTitle,
    price: service.priceMin || 0,
    priceLabel: service.priceLabel,
    petName: details.petName || "",
    breedId: details.breedId || service.categoryId,
    date: details.date || "",
    time: details.time || "",
    comment: details.comment || ""
  };
  state.cart.push(item);
  saveStorage(STORAGE_KEYS.cart, state.cart);
  postDemo("/api/cart", item);
  renderCart();
  showToast("Услуга добавлена в заказ.");
}

function checkout() {
  if (!state.cart.length) {
    showToast("Корзина пока пустая.");
    return;
  }
  if (!state.user) {
    location.hash = "profile";
    showToast("Сначала войдите в профиль.");
    return;
  }

  const order = {
    id: createId("order"),
    date: formatDate(new Date()),
    status: "Новая заявка",
    total: getCartTotal(),
    user: state.user,
    items: [...state.cart]
  };
  state.orders.unshift(order);
  state.cart = [];
  saveStorage(STORAGE_KEYS.orders, state.orders);
  saveStorage(STORAGE_KEYS.cart, state.cart);
  postDemo("/api/orders", order);
  renderCart();
  renderProfile();
  showToast("Заказ оформлен и добавлен в историю.");
}

function getFilteredServices() {
  const query = normalize(state.serviceQuery);
  return state.services.filter(service => {
    const typeOk = state.serviceType === "all" || service.categoryType === state.serviceType;
    if (!typeOk) return false;
    if (!query) return true;
    const haystack = normalize([service.title, service.categoryTitle, service.comment].join(" "));
    return haystack.includes(query);
  });
}

function getFilteredBreeds() {
  const query = normalize(state.breedQuery);
  if (!query) return state.breeds;
  return state.breeds.filter(breed => normalize(breed.title).includes(query));
}

function findService(id) {
  return state.services.find(service => String(service.id) === String(id));
}

function getCartTotal() {
  return sumItems(state.cart);
}

function sumItems(items) {
  return items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
}

function setDefaultDate() {
  const date = new Date();
  date.setDate(date.getDate() + 2);
  els.bookingDate.value = date.toISOString().slice(0, 10);
}

function getKindLabel(type) {
  if (type === "cat") return "Кошки";
  if (type === "extra") return "Дополнительно";
  if (type === "other") return "Разное";
  return "Порода";
}

function createId(prefix) {
  if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 10000)}`;
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString("ru-RU")} ₽`;
}

function formatDate(date) {
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatInputDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

function normalize(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function plural(count, forms) {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  if (value === null) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, JSON.stringify(value));
}

async function postDemo(path, payload, method = "POST") {
  try {
    await fetch(path, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch {
    // Static hosting uses localStorage fallback.
  }
}

let toastTimeout;
function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => els.toast.classList.remove("is-visible"), 2600);
}
