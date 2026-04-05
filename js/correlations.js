/* Correlation heatmap */

async function renderCorrelations() {
  const data = await loadJSON("data/correlations.json");
  const themes = data.themes;
  const matrix = data.matrix;
  const n = themes.length;

  const container = document.getElementById("corr-chart");
  const size = Math.min(container.clientWidth, 620);
  const margin = { top: 120, right: 20, bottom: 20, left: 120 };
  const cellSize = (size - margin.left - margin.right) / n;

  const svg = d3.select("#corr-chart")
    .append("svg")
    .attr("width", size)
    .attr("height", size);

  const color = d3.scaleDiverging()
    .domain([-0.5, 0, 0.5])
    .interpolator(d3.interpolateRdBu);

  // Build significant pairs lookup
  const sigPairs = new Set();
  data.significant_pairs.forEach(p => {
    sigPairs.add(`${p.theme1}|${p.theme2}`);
    sigPairs.add(`${p.theme2}|${p.theme1}`);
  });

  // Cells
  const cells = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      cells.push({ i, j, r: matrix[i][j], sig: sigPairs.has(`${themes[i]}|${themes[j]}`) });
    }
  }

  svg.selectAll("rect")
    .data(cells)
    .join("rect")
    .attr("x", d => margin.left + d.j * cellSize)
    .attr("y", d => margin.top + d.i * cellSize)
    .attr("width", cellSize - 1)
    .attr("height", cellSize - 1)
    .attr("fill", d => d.i === d.j ? "#f5f5f5" : color(d.r))
    .attr("stroke", d => d.sig && d.i !== d.j ? "#1a1a1a" : "none")
    .attr("stroke-width", d => d.sig ? 1.5 : 0)
    .attr("rx", 2)
    .on("mouseenter", (event, d) => {
      if (d.i === d.j) return;
      const sig = d.sig ? " (significant)" : "";
      showTooltip(
        `<strong>${themes[d.i]}</strong> &times; <strong>${themes[d.j]}</strong><br>r = ${d.r.toFixed(3)}${sig}`,
        event
      );
    })
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip);

  // Row labels
  svg.selectAll(".row-label")
    .data(themes)
    .join("text")
    .attr("class", "row-label")
    .attr("x", margin.left - 6)
    .attr("y", (d, i) => margin.top + i * cellSize + cellSize / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "end")
    .attr("font-size", 10)
    .attr("fill", "#666")
    .text(d => d);

  // Column labels (rotated)
  svg.selectAll(".col-label")
    .data(themes)
    .join("text")
    .attr("class", "col-label")
    .attr("x", 0)
    .attr("y", 0)
    .attr("transform", (d, i) =>
      `translate(${margin.left + i * cellSize + cellSize / 2}, ${margin.top - 6}) rotate(-45)`
    )
    .attr("text-anchor", "start")
    .attr("font-size", 10)
    .attr("fill", "#666")
    .text(d => d);

  // Color legend
  const legendWidth = 160;
  const legendHeight = 10;
  const legendX = margin.left;
  const legendY = margin.top + n * cellSize + 16;

  const defs = svg.append("defs");
  const gradient = defs.append("linearGradient").attr("id", "corr-gradient");
  gradient.append("stop").attr("offset", "0%").attr("stop-color", color(-0.5));
  gradient.append("stop").attr("offset", "50%").attr("stop-color", color(0));
  gradient.append("stop").attr("offset", "100%").attr("stop-color", color(0.5));

  svg.append("rect")
    .attr("x", legendX)
    .attr("y", legendY)
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .attr("fill", "url(#corr-gradient)")
    .attr("rx", 3);

  svg.append("text").attr("x", legendX).attr("y", legendY + 22).attr("font-size", 10).attr("fill", "#999").text("-0.5");
  svg.append("text").attr("x", legendX + legendWidth / 2).attr("y", legendY + 22).attr("text-anchor", "middle").attr("font-size", 10).attr("fill", "#999").text("0");
  svg.append("text").attr("x", legendX + legendWidth).attr("y", legendY + 22).attr("text-anchor", "end").attr("font-size", 10).attr("fill", "#999").text("+0.5");
}
