/* Main: trigger chart rendering when sections scroll into view */

const rendered = new Set();

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      if (rendered.has(id)) return;
      rendered.add(id);

      switch (id) {
        case "hero": animateCounters(); break;
        case "themes": renderThemeChart(); break;
        case "vocabulary": renderVocabulary(); break;
        case "streams": renderStreamgraph(); break;
        case "landscape": renderPCA(); break;
        case "correlations": renderCorrelations(); break;
        case "diversity": renderEntropy(); break;
        case "novelty": renderNovelty(); break;
      }
    });
  },
  { threshold: 0.05 }
);

document.querySelectorAll(".section").forEach((el) => observer.observe(el));
