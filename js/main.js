/* Main: single observer for visibility + chart rendering */

const rendered = new Set();

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      // Fade in the section
      entry.target.classList.add("visible");

      // Render chart once
      const id = entry.target.id;
      if (rendered.has(id)) return;
      rendered.add(id);

      switch (id) {
        case "hero":
          animateCounters();
          break;
        case "themes":
          renderThemeChart();
          break;
        case "vocabulary":
          renderVocabulary();
          break;
        case "streams":
          renderStreamgraph();
          break;
        case "landscape":
          renderPCA();
          break;
        case "correlations":
          renderCorrelations();
          break;
        case "diversity":
          renderEntropy();
          break;
        case "novelty":
          renderNovelty();
          break;
      }
    });
  },
  { threshold: 0.05, rootMargin: "0px 0px -50px 0px" }
);

document.querySelectorAll(".section").forEach((el) => observer.observe(el));
