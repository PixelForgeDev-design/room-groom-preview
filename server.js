const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = __dirname;
const port = Number(process.env.PORT || 8027);
const catalogPath = path.join(root, "data", "catalog.json");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

const demoState = {
  profile: null,
  cart: [],
  orders: [],
  feedback: []
};

function readCatalog() {
  return JSON.parse(fs.readFileSync(catalogPath, "utf8"));
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(data));
}

function sendStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(url.pathname);
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(root, requested));

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "content-type": mimeTypes[ext] || "application/octet-stream",
      "cache-control": ext === ".html" ? "no-store" : "public, max-age=120"
    });
    res.end(content);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function total(items) {
  return items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
}

function serviceById(id) {
  return readCatalog().services.find(service => String(service.id) === String(id));
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const route = url.pathname;

  try {
    if (req.method === "GET" && route === "/api/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && route === "/api/catalog") {
      sendJson(res, 200, readCatalog());
      return;
    }

    if (req.method === "GET" && route === "/api/services") {
      sendJson(res, 200, readCatalog().services);
      return;
    }

    if (req.method === "GET" && route === "/api/breeds") {
      sendJson(res, 200, readCatalog().breeds);
      return;
    }

    if (req.method === "POST" && route === "/api/auth/demo") {
      const body = await readBody(req);
      demoState.profile = {
        name: body.name || "Клиент Room Groom",
        phone: body.phone || "",
        email: body.email || "",
        smsConsent: Boolean(body.smsConsent),
        emailConsent: Boolean(body.emailConsent)
      };
      sendJson(res, 200, { profile: demoState.profile, cart: demoState.cart, orders: demoState.orders });
      return;
    }

    if (req.method === "GET" && route === "/api/profile") {
      sendJson(res, 200, { profile: demoState.profile, orders: demoState.orders, feedback: demoState.feedback });
      return;
    }

    if ((req.method === "PUT" || req.method === "PATCH") && route === "/api/profile") {
      const body = await readBody(req);
      demoState.profile = { ...(demoState.profile || {}), ...body };
      sendJson(res, 200, { profile: demoState.profile });
      return;
    }

    if (req.method === "GET" && route === "/api/cart") {
      sendJson(res, 200, { items: demoState.cart, total: total(demoState.cart) });
      return;
    }

    if (req.method === "POST" && route === "/api/cart") {
      const body = await readBody(req);
      const service = body.serviceId ? serviceById(body.serviceId) : null;
      const item = {
        id: body.id || crypto.randomUUID(),
        serviceId: body.serviceId || service?.id || null,
        title: body.title || service?.title || "Услуга Room Groom",
        categoryTitle: body.categoryTitle || service?.categoryTitle || "",
        price: Number(body.price || service?.priceMin || 0),
        priceLabel: body.priceLabel || service?.priceLabel || "0 ₽",
        petName: body.petName || "",
        date: body.date || "",
        time: body.time || "",
        comment: body.comment || ""
      };
      demoState.cart.push(item);
      sendJson(res, 201, { item, items: demoState.cart, total: total(demoState.cart) });
      return;
    }

    if (req.method === "DELETE" && route.startsWith("/api/cart/")) {
      const id = route.split("/").pop();
      demoState.cart = demoState.cart.filter(item => item.id !== id);
      sendJson(res, 200, { items: demoState.cart, total: total(demoState.cart) });
      return;
    }

    if (req.method === "GET" && route === "/api/orders") {
      sendJson(res, 200, demoState.orders);
      return;
    }

    if (req.method === "POST" && route === "/api/orders") {
      const body = await readBody(req);
      const items = Array.isArray(body.items) && body.items.length ? body.items : demoState.cart;
      const order = {
        id: body.id || crypto.randomUUID(),
        date: body.date || new Date().toLocaleDateString("ru-RU"),
        status: body.status || "Новая заявка",
        user: body.user || demoState.profile,
        items,
        total: Number(body.total || total(items))
      };
      demoState.orders.unshift(order);
      demoState.cart = [];
      sendJson(res, 201, order);
      return;
    }

    if (req.method === "POST" && route === "/api/feedback") {
      const body = await readBody(req);
      const entry = {
        id: body.id || crypto.randomUUID(),
        date: body.date || new Date().toLocaleDateString("ru-RU"),
        user: body.user || demoState.profile?.name || "Гость",
        message: body.message || ""
      };
      demoState.feedback.unshift(entry);
      sendJson(res, 201, entry);
      return;
    }

    sendJson(res, 404, { error: "API route not found" });
  } catch (error) {
    sendJson(res, 400, { error: error.message });
  }
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    handleApi(req, res);
    return;
  }
  sendStatic(req, res);
});

server.listen(port, () => {
  console.log(`Room Groom prototype running on http://127.0.0.1:${port}`);
});
