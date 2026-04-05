/* Shared navigation — injected into every page */

const NAV_PAGES = [
  { href: "index.html", label: "Home", short: "Home" },
  { href: "themes.html", label: "Themes", short: "Themes" },
  { href: "streams.html", label: "Streams", short: "Streams" },
  { href: "landscape.html", label: "Landscape", short: "Landscape" },
  { href: "correlations.html", label: "Alliances", short: "Alliances" },
  { href: "diversity.html", label: "Diversity", short: "Diversity" },
  { href: "novelty.html", label: "Novelty", short: "Novelty" },
  { href: "methods.html", label: "Methods", short: "Methods" },
];

(function injectNav() {
  const current = location.pathname.split("/").pop() || "index.html";

  // --- Top navigation bar ---
  const nav = document.createElement("nav");
  nav.className = "site-nav";
  nav.innerHTML = `
    <div class="nav-inner">
      <a class="nav-brand" href="index.html">LuddyTeach</a>
      <button class="nav-toggle" aria-label="Toggle navigation">
        <span></span><span></span><span></span>
      </button>
      <div class="nav-links">
        ${NAV_PAGES.slice(1).map(p =>
          `<a href="${p.href}" class="${current === p.href ? 'active' : ''}">${p.label}</a>`
        ).join("")}
      </div>
    </div>
  `;
  document.body.prepend(nav);

  // Hamburger toggle
  const toggle = nav.querySelector(".nav-toggle");
  const links = nav.querySelector(".nav-links");
  toggle.addEventListener("click", () => {
    links.classList.toggle("open");
    toggle.classList.toggle("open");
  });

  // Close menu on link click (mobile)
  links.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", () => {
      links.classList.remove("open");
      toggle.classList.remove("open");
    });
  });

  // --- Previous / Next links ---
  const idx = NAV_PAGES.findIndex(p => p.href === current);
  if (idx > 0) {
    const prevNext = document.createElement("div");
    prevNext.className = "prev-next";
    const prev = idx > 0 ? NAV_PAGES[idx - 1] : null;
    const next = idx < NAV_PAGES.length - 1 ? NAV_PAGES[idx + 1] : null;
    prevNext.innerHTML = `
      ${prev ? `<a class="prev-next-link prev" href="${prev.href}">&larr; ${prev.label}</a>` : '<span></span>'}
      ${next ? `<a class="prev-next-link next" href="${next.href}">${next.label} &rarr;</a>` : '<span></span>'}
    `;
    // Insert before footer
    const footer = document.querySelector(".footer");
    if (footer) {
      footer.parentNode.insertBefore(prevNext, footer);
    } else {
      document.body.appendChild(prevNext);
    }
  }
})();
