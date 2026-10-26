import { CATEGORIES } from "../shared/categories";
import { api, esc, imageUrl, type Product } from "./api";

const $ = <T extends HTMLElement = HTMLElement>(s: string) =>
  document.querySelector(s) as T;

const PHONE = "917773877757";

let products: Product[] = [];
let loaded = false;
let cur: string | null = null;

function enquiryLink(name: string, cat: string) {
  const m = `Dear Medinova Surgitech Team,

I am interested in: ${name} (${cat}).

Please share the product catalogue, specifications, availability, and best prices for the products I am interested in.

My requirement:

Please contact me with the relevant product details and quotation.

Thank you.

Best regards,
Name:
Hospital / Clinic:`;

  return `https://wa.me/${PHONE}?text=${encodeURIComponent(m)}`;
}

function renderCats() {
  $("#catgrid").innerHTML = CATEGORIES.map((c) => {
    const n = products.filter((p) => p.category === c.id).length;

    return `<button type="button" class="cardc" data-cat="${c.id}">
<h3>${esc(c.name)}</h3>
<small>${n ? `${n} ${n === 1 ? "product" : "products"}` : "Open catalogue"}</small>
</button>`;
  }).join("");
}

function renderPanel() {
  const c = CATEGORIES.find((x) => x.id === cur);

  if (!c) return;

  $("#pt").textContent = c.name;

  if (!loaded) {
    $("#plist").innerHTML =
      '<p class="pempty">Loading products…</p>';
    return;
  }

  const list = products.filter((p) => p.category === cur);

  $("#plist").innerHTML = list.length
    ? list
        .map(
          (p, i) => `<article class="pi" style="animation-delay:${i * 60}ms">
<div class="pimg">${p.imageKey ? `<img src="${imageUrl(p.imageKey, 1120)}" alt="${esc(p.name)}" loading="lazy">` : "<i></i>"}</div>
<div class="pb"><h4>${esc(p.name)}</h4>${p.subtitle ? `<small>${esc(p.subtitle)}</small>` : ""}${p.description ? `<p>${esc(p.description)}</p>` : ""}
<a class="enq" target="_blank" rel="noopener" href="${esc(enquiryLink(p.name, c.name))}">Enquire on WhatsApp</a></div></article>`,
        )
        .join("")
    : '<p class="pempty">Products for this category are coming soon. Please contact us for details.</p>';
}

function openPanel(id: string) {
  cur = id;
  renderPanel();

  const pn = $("#panel");
  const ov = $("#ov");

  pn.hidden = false;
  ov.hidden = false;

  document.body.classList.add("lock");

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      pn.classList.add("on");
      ov.classList.add("on");
    }),
  );

  pn.scrollTop = 0;
  $("#px").focus();
}

function closePanel() {
  const pn = $("#panel");
  const ov = $("#ov");

  pn.classList.remove("on");
  ov.classList.remove("on");

  document.body.classList.remove("lock");

  setTimeout(() => {
    pn.hidden = true;
    ov.hidden = true;
  }, 400);
}

document.addEventListener("click", (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>(
    "button,div.ov",
  );

  if (!t) return;

  if (t.dataset.cat) return openPanel(t.dataset.cat);

  if (t.id === "px" || t.id === "ov") closePanel();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("#panel").hidden) closePanel();
});

renderCats();

api
  .list()
  .then((rows) => {
    products = rows;
  })
  .catch(() => {
    products = [];
  })
  .finally(() => {
    loaded = true;
    renderCats();
    if (cur) renderPanel();
  });
