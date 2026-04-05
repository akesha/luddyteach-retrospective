/* Novelty temporal bar chart — SLL-style "Conversations That Broke the Mold" */

async function renderNovelty() {
  const data = await loadJSON("data/novelty.json");

  // Sort by date for timeline
  const sorted = [...data].sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const container = document.getElementById("novelty-chart");
  const containerWidth = Math.min(container.clientWidth, 900);
  const chartWidth = containerWidth > 700 ? containerWidth - 300 : containerWidth;
  const chartHeight = 280;
  const margin = { top: 20, right: 20, bottom: 36, left: 50 };

  const wrapper = document.createElement("div");
  wrapper.className = "novelty-wrapper";
  container.appendChild(wrapper);

  const chartDiv = document.createElement("div");
  chartDiv.className = "novelty-chart-area";
  wrapper.appendChild(chartDiv);

  const panelDiv = document.createElement("div");
  panelDiv.className = "novelty-panel";
  panelDiv.innerHTML = '<div class="pca-panel-empty">Hover over a bar to explore</div>';
  wrapper.appendChild(panelDiv);

  const svg = d3.select(chartDiv)
    .append("svg")
    .attr("width", chartWidth)
    .attr("height", chartHeight);

  const x = d3.scaleBand()
    .domain(sorted.map((_, i) => i))
    .range([margin.left, chartWidth - margin.right])
    .padding(0.15);

  const y = d3.scaleLinear()
    .domain([0, d3.max(sorted, d => d.novelty) * 1.1])
    .range([chartHeight - margin.bottom, margin.top]);

  // Y axis
  svg.append("g")
    .attr("transform", `translate(${margin.left}, 0)`)
    .call(d3.axisLeft(y).ticks(4).tickSize(-chartWidth + margin.left + margin.right))
    .call(g => g.selectAll("line").attr("stroke", "#f0f0f0"))
    .call(g => g.selectAll(".domain").remove())
    .call(g => g.selectAll("text").attr("fill", "#999").attr("font-size", 10));

  // Y label
  svg.append("text")
    .attr("x", -chartHeight / 2)
    .attr("y", 14)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .attr("font-size", 11)
    .attr("fill", "#999")
    .text("Novelty Score");

  // Bars
  svg.selectAll("rect")
    .data(sorted)
    .join("rect")
    .attr("x", (d, i) => x(i))
    .attr("y", d => y(d.novelty))
    .attr("width", x.bandwidth())
    .attr("height", d => chartHeight - margin.bottom - y(d.novelty))
    .attr("fill", d => catColor(d.category))
    .attr("opacity", 0.7)
    .attr("rx", 1)
    .on("mouseenter", function(event, d) {
      d3.select(this).attr("opacity", 1).attr("stroke", "#1a1a1a").attr("stroke-width", 1);
      showPanel(d);
      showTooltip(`<strong>${d.title}</strong><br>Novelty: ${d.novelty.toFixed(2)}`, event);
    })
    .on("mousemove", moveTooltip)
    .on("mouseleave", function() {
      d3.select(this).attr("opacity", 0.7).attr("stroke", "none");
      hideTooltip();
    });

  // X axis — sparse date labels
  const dateLabels = [];
  let lastLabel = "";
  sorted.forEach((d, i) => {
    if (!d.date) return;
    const label = d.date.slice(0, 7); // YYYY-MM
    if (label !== lastLabel && i % Math.max(1, Math.floor(sorted.length / 8)) === 0) {
      dateLabels.push({ i, label });
      lastLabel = label;
    }
  });

  svg.selectAll(".date-label")
    .data(dateLabels)
    .join("text")
    .attr("x", d => x(d.i) + x.bandwidth() / 2)
    .attr("y", chartHeight - 6)
    .attr("text-anchor", "middle")
    .attr("font-size", 10)
    .attr("fill", "#999")
    .text(d => d.label);

  // Top 5 most novel posts cards below chart
  const top5 = data.slice(0, 5);
  const cardsDiv = document.createElement("div");
  cardsDiv.className = "novelty-cards";
  container.appendChild(cardsDiv);

  const cardsTitle = document.createElement("div");
  cardsTitle.className = "panel-section-label";
  cardsTitle.style.marginBottom = "12px";
  cardsTitle.textContent = "TOP 5 MOST SURPRISING POSTS";
  cardsDiv.appendChild(cardsTitle);

  const cardsGrid = document.createElement("div");
  cardsGrid.className = "novelty-cards-grid";
  cardsDiv.appendChild(cardsGrid);

  top5.forEach(d => {
    const card = document.createElement("div");
    card.className = "novelty-card";
    const tags = (d.topThemes || []).map(t =>
      `<span class="theme-tag high">${t.name}</span>`
    ).join("");
    card.innerHTML = `
      <div class="novelty-card-score">Novelty: <strong>${d.novelty.toFixed(2)}</strong></div>
      <div class="novelty-card-title">${d.title}</div>
      <div class="novelty-card-tags">${tags}</div>
    `;
    cardsGrid.appendChild(card);
  });

  function showPanel(d) {
    const tags = (d.topThemes || []).map(t =>
      `<span class="theme-tag high">${t.name}</span>`
    ).join("");
    panelDiv.innerHTML = `
      <div class="pca-panel-content">
        <div class="panel-cluster" style="color:${catColor(d.category)}">${d.category}</div>
        <h3 class="panel-title">${d.title}</h3>
        <p class="panel-summary">${d.summary || ""}</p>
        <div class="panel-section-label">NOVELTY SCORE</div>
        <p class="panel-why"><strong style="color:var(--color-accent)">${d.novelty.toFixed(2)}</strong></p>
        ${tags ? `<div class="panel-section-label">TOP THEMES</div><p class="panel-why">${tags}</p>` : ""}
      </div>
    `;
  }
}
