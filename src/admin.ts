import {
  AuthError,
  getUser,
  handleAuthCallback,
  login,
  logout,
  requestPasswordRecovery,
  signup,
  updateUser,
} from "@netlify/identity";
import { CATEGORIES } from "../shared/categories";
import { api, esc, imageUrl, type Product, type ProductInput } from "./api";

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const catName = (id: string) => CATEGORIES.find((c) => c.id === id)?.name ?? "Uncategorised";

type Mode = "login" | "forgot" | "setup" | "reset";
let mode: Mode = "login";
let products: Product[] = [];
let editing: Product | null = null;
let imageKey: string | null = null;
let pendingDelete: Product | null = null;
let tt: ReturnType<typeof setTimeout>;

function toast(m: string) {
  const t = $("#toast");
  t.textContent = m;
  clearTimeout(tt);
  tt = setTimeout(() => (t.textContent = ""), 4000);
}

function show(view: "loading" | "auth" | "denied" | "dash") {
  document.querySelectorAll<HTMLElement>(".view").forEach((v) => (v.hidden = v.id !== `v-${view}`));
}

function authMessage(err: unknown) {
  if (err instanceof AuthError) {
    if (err.status === 401 || err.status === 400) return "Invalid email or password.";
    if (err.status === 403) return "This email is not allowed to create an admin account.";
    if (err.status === 422) return "Check your email and use a password of at least 8 characters.";
    return err.message;
  }
  return err instanceof Error ? err.message : "Something went wrong. Please try again.";
}

/* ---------- Sign-in screens ---------- */

const MODES: Record<Mode, { title: string; hint: string; submit: string; email: boolean; pw: boolean }> = {
  login: { title: "Sign in", hint: "Enter your admin email and password to manage the product catalogue.", submit: "Sign in", email: true, pw: true },
  forgot: { title: "Reset password", hint: "Enter your admin email and we’ll send you a link to set a new password.", submit: "Send reset link", email: true, pw: false },
  setup: { title: "Create admin password", hint: "One-time setup for the owner email. You’ll receive an email to confirm the account.", submit: "Create account", email: true, pw: true },
  reset: { title: "Set a new password", hint: "Choose a new password for your admin account.", submit: "Save password", email: false, pw: true },
};

function setMode(m: Mode) {
  mode = m;
  const c = MODES[m];
  $("#auth-title").textContent = c.title;
  $("#auth-hint").textContent = c.hint;
  $("#auth-submit").textContent = c.submit;
  $("#email-row").hidden = !c.email;
  $("#pw-row").hidden = !c.pw;
  $<HTMLInputElement>("#password").autocomplete = m === "login" ? "current-password" : "new-password";
  $("#auth-err").textContent = "";
  $("#auth-links").innerHTML =
    m === "login"
      ? '<button type="button" class="link" data-mode="forgot">Forgot password?</button><button type="button" class="link" data-mode="setup">First time? Create your admin password</button>'
      : m === "reset"
        ? ""
        : '<button type="button" class="link" data-mode="login">← Back to sign in</button>';
  show("auth");
}

$("#auth-links").addEventListener("click", (e) => {
  const m = (e.target as HTMLElement).closest<HTMLElement>("[data-mode]")?.dataset.mode as Mode | undefined;
  if (m) setMode(m);
});

$("#auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $<HTMLInputElement>("#email").value.trim();
  const password = $<HTMLInputElement>("#password").value;
  const btn = $<HTMLButtonElement>("#auth-submit");
  const err = $("#auth-err");
  err.textContent = "";
  if (MODES[mode].email && !email) return void (err.textContent = "Enter your email.");
  if (MODES[mode].pw && password.length < 8) return void (err.textContent = "Password must be at least 8 characters.");
  btn.disabled = true;
  try {
    if (mode === "login") {
      await login(email, password);
      await enter();
    } else if (mode === "forgot") {
      await requestPasswordRecovery(email);
      setMode("login");
      toast("If that email is registered, a reset link is on its way.");
    } else if (mode === "setup") {
      const user = await signup(email, password);
      if (user.confirmedAt) await enter();
      else {
        setMode("login");
        toast("Check your inbox and click the confirmation link to finish setup.");
      }
    } else {
      await updateUser({ password });
      toast("Password updated.");
      await enter();
    }
  } catch (x) {
    err.textContent = authMessage(x);
  } finally {
    btn.disabled = false;
  }
});

async function signOut() {
  try { await logout(); } catch { /* already signed out */ }
  $("#who").hidden = true;
  $<HTMLInputElement>("#password").value = "";
  setMode("login");
}
$("#logout").addEventListener("click", signOut);
document.querySelector("[data-logout]")?.addEventListener("click", signOut);

/* ---------- Dashboard ---------- */

async function enter() {
  show("loading");
  const s = await fetch("/api/session", { credentials: "same-origin" }).then((r) => r.json()).catch(() => null);
  if (!s?.signedIn) return setMode("login");
  $("#whoemail").textContent = s.email ?? "";
  $("#who").hidden = false;
  if (!s.admin) return show("denied");
  show("dash");
  await load();
}

async function load() {
  $("#list").innerHTML = '<p class="hint">Loading products…</p>';
  try {
    products = await api.list();
  } catch (x) {
    products = [];
    toast(authMessage(x));
  }
  render();
}

function render() {
  const f = $<HTMLSelectElement>("#filter").value;
  const q = $<HTMLInputElement>("#search").value.trim().toLowerCase();
  const withPhoto = products.filter((p) => p.imageKey).length;
  const usedCats = new Set(products.map((p) => p.category)).size;
  $("#stats").innerHTML = `<div><b>${products.length}</b><span>Products</span></div><div><b>${usedCats}/${CATEGORIES.length}</b><span>Categories in use</span></div><div><b>${withPhoto}</b><span>With photos</span></div>`;

  const list = products.filter(
    (p) => (!f || p.category === f) && (!q || `${p.name} ${p.subtitle} ${p.description}`.toLowerCase().includes(q)),
  );
  $("#list").innerHTML = list.length
    ? list
        .map(
          (p, i) => `<article class="row" style="animation-delay:${Math.min(i, 12) * 30}ms">
<div class="th">${p.imageKey ? `<img src="${imageUrl(p.imageKey, 200)}" alt="" loading="lazy">` : "<i></i>"}</div>
<div><span class="meta">${esc(catName(p.category))}${p.subtitle ? ` • ${esc(p.subtitle)}` : ""}</span><h4>${esc(p.name)}</h4>${p.description ? `<p>${esc(p.description)}</p>` : ""}</div>
<div class="act"><button type="button" data-e="${p.id}">Edit</button><button type="button" class="del" data-d="${p.id}">Delete</button></div></article>`,
        )
        .join("")
    : `<div class="blank">${products.length ? "No products match this filter." : "No products yet. Click <b>+ Add product</b> to create the first one."}</div>`;
}

const catOptions = CATEGORIES.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
$("#filter").innerHTML = `<option value="">All categories</option>${catOptions}`;
$("#fcat").innerHTML = catOptions;
$("#filter").addEventListener("change", render);
$("#search").addEventListener("input", render);

/* ---------- Add / edit form ---------- */

function setPreview(key: string | null, src?: string) {
  imageKey = key;
  $("#pvwrap").hidden = !key;
  if (key) $<HTMLImageElement>("#pv").src = src ?? imageUrl(key, 800);
}

function updateCount() {
  $("#fdc").textContent = `${$<HTMLTextAreaElement>("#fd").value.length}/2000`;
}

function openForm(p: Product | null) {
  editing = p;
  $("#dt").textContent = p ? "Edit product" : "Add product";
  $<HTMLSelectElement>("#fcat").value = p?.category ?? ($<HTMLSelectElement>("#filter").value || CATEGORIES[0].id);
  $<HTMLInputElement>("#fn").value = p?.name ?? "";
  $<HTMLInputElement>("#fc").value = p?.subtitle ?? "";
  $<HTMLTextAreaElement>("#fd").value = p?.description ?? "";
  $<HTMLInputElement>("#ff").value = "";
  $("#ferr").textContent = "";
  setPreview(p?.imageKey ?? null);
  updateCount();
  $<HTMLDialogElement>("#dlg").showModal();
  $("#fn").focus();
}

$("#fd").addEventListener("input", updateCount);
$("#addb").addEventListener("click", () => openForm(null));
$("#cn").addEventListener("click", () => $<HTMLDialogElement>("#dlg").close());
$("#rmimg").addEventListener("click", () => { setPreview(null); $<HTMLInputElement>("#ff").value = ""; });

$("#ff").addEventListener("change", async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const sv = $<HTMLButtonElement>("#sv");
  sv.disabled = true;
  $("#ferr").textContent = "";
  try {
    // Downscale large photos in the browser before uploading.
    const bm = await createImageBitmap(file);
    const k = Math.min(1, 1600 / Math.max(bm.width, bm.height));
    const cv = document.createElement("canvas");
    cv.width = Math.round(bm.width * k);
    cv.height = Math.round(bm.height * k);
    cv.getContext("2d")!.drawImage(bm, 0, 0, cv.width, cv.height);
    const blob = await new Promise<Blob>((r, j) => cv.toBlob((b) => (b ? r(b) : j(new Error("Could not read image"))), "image/jpeg", 0.85));
    const { key } = await api.upload(blob);
    setPreview(key, URL.createObjectURL(blob));
  } catch (x) {
    $("#ferr").textContent = x instanceof Error ? x.message : "Could not upload the photo.";
  } finally {
    sv.disabled = false;
  }
});

$("#pform").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input: ProductInput = {
    category: $<HTMLSelectElement>("#fcat").value,
    name: $<HTMLInputElement>("#fn").value.trim(),
    subtitle: $<HTMLInputElement>("#fc").value.trim(),
    description: $<HTMLTextAreaElement>("#fd").value.trim(),
    imageKey,
  };
  if (!input.name) return void ($("#ferr").textContent = "Enter a product name.");
  const sv = $<HTMLButtonElement>("#sv");
  sv.disabled = true;
  try {
    if (editing) {
      const row = await api.update(editing.id, input);
      products = products.map((p) => (p.id === row.id ? row : p));
      toast("Product updated.");
    } else {
      products.push(await api.create(input));
      toast("Product added.");
    }
    $<HTMLDialogElement>("#dlg").close();
    render();
  } catch (x) {
    $("#ferr").textContent = x instanceof Error ? x.message : "Could not save.";
  } finally {
    sv.disabled = false;
  }
});

/* ---------- Edit / delete actions ---------- */

$("#list").addEventListener("click", (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>("button");
  if (!t) return;
  const find = (id?: string) => products.find((p) => String(p.id) === id) ?? null;
  if (t.dataset.e) openForm(find(t.dataset.e));
  if (t.dataset.d) {
    pendingDelete = find(t.dataset.d);
    if (!pendingDelete) return;
    $("#confirm-text").textContent = `“${pendingDelete.name}” will be removed from the public catalogue. This cannot be undone.`;
    $<HTMLDialogElement>("#confirm").showModal();
  }
});

$("#confirm-no").addEventListener("click", () => $<HTMLDialogElement>("#confirm").close());
$("#confirm-yes").addEventListener("click", async () => {
  const p = pendingDelete;
  if (!p) return;
  const btn = $<HTMLButtonElement>("#confirm-yes");
  btn.disabled = true;
  try {
    await api.remove(p.id);
    products = products.filter((x) => x.id !== p.id);
    render();
    toast("Product deleted.");
    $<HTMLDialogElement>("#confirm").close();
  } catch (x) {
    toast(x instanceof Error ? x.message : "Could not delete.");
  } finally {
    btn.disabled = false;
  }
});

/* ---------- Boot ---------- */

(async () => {
  try {
    const cb = await handleAuthCallback();
    if (cb?.type === "recovery") return setMode("reset");
    if (cb?.type === "confirmation") toast("Email confirmed. You are signed in.");
  } catch (x) {
    toast(authMessage(x));
  }
  if (await getUser()) await enter();
  else setMode("login");
})();
