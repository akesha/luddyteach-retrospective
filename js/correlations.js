/* Force-directed network graph — SLL-style Alliances & Rivalries */

async function renderCorrelations() {
  const data = await loadJSON("data/correlations.json");
  const { nodes, links, alliances, rivalries, summary } = data;

  const container = document.getElementById("corr-chart");
  const containerWidth = Math.min(container.clientWidth, 900);
  const chartWidth = containerWidth > 700 ? containerWidth - 300 : containerWidth;
  const chartHeight = 480;

  const wrapper = document.createElement("div");
  wrapper.className = "corr-wrapper";
  container.appendChild(wrapper);

  const chartDiv = document.createElement("div");
  chartDiv.className = "corr-chart-area";
  wrapper.appendChild(chartDiv);

  // Side panel with alliances & rivalries
  const panelDiv = document.createElement("div");
  panelDiv.className = "corr-panel";
  wrapper.appendChild(panelDiv);

  // Build panel content
  const allianceHtml = alliances.map(a =>
    `<div class="corr-pair"><span class="corr-pair-name">${a.pair}</span><span class="corr-r alliance">r = +${Math.abs(a.r).toFixed(2)}</span></div>`
  ).join("");
  const rivalryHtml = rivalries.map(r =>
    `<div class="corr-pair"><span class="corr-pair-name">${r.pair}</span><span class="corr-r rivalry">r = ${r.r.toFixed(2)}</span></div>`
  ).join("");

  panelDiv.innerHTML = `
    <div class="panel-section-label" style="color:#2d6a2d">STRONGEST ALLIANCES</div>
    ${allianceHtml}
    <div class="panel-section-label" style="color:#8b3a3a;margin-top:20px">STRONGEST RIVALRIES</div>
    ${rivalryHtml}
    <p class="corr-summary">${summary}</p>
  `;

  const svg = d3.select(chartDiv)
    .append("svg")
    .attr("width", chartWidth)
    .attr("height", chartHeight);

  // Color nodes by connectivity
  const maxConn = d3.max(nodes, d => d.connections);
  const nodeColor = d3.scaleSequential(d3.interpolateWarm)
    .domain([0, maxConn]);

  // Node size by connections
  const nodeRadius = d3.scaleSqrt()
    .domain([0, maxConn])
    .range([12, 28]);

  // Link width by strength
  const linkWidth = d3.scaleLinear()
    .domain([0.15, 0.35])
    .range([1, 3.5])
    .clamp(true);

  // Force simulation
  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(120).strength(d => Math.abs(d.r) * 0.8))
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(chartWidth / 2, chartHeight / 2))
    .force("collision", d3.forceCollide().radius(d => nodeRadius(d.connections) + 6));

  // Draw links
  const link = svg.append("g")
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke", d => d.type === "alliance" ? "#4a9e4a" : "#c44e52")
    .attr("stroke-width", d => linkWidth(Math.abs(d.r)))
    .attr("stroke-opacity", 0.5)
    .attr("stroke-dasharray", d => d.type === "rivalry" ? "6,4" : "none");

  // Draw nodes
  const node = svg.append("g")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .attr("cursor", "pointer")
    .call(d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended));

  node.append("circle")
    .attr("r", d => nodeRadius(d.connections))
    .attr("fill", d => nodeColor(d.connections))
    .attr("stroke", "#fff")
    .attr("stroke-width", 2)
    .attr("opacity", 0.85);

  node.append("text")
    .text(d => d.id.length > 16 ? d.id.slice(0, 14) + "..." : d.id)
    .attr("text-anchor", "middle")
    .attr("dy", d => nodeRadius(d.connections) + 14)
    .attr("font-size", 10)
    .attr("fill", "#666");

  // Hover: highlight connections
  node.on("mouseenter", function(event, d) {
    const connected = new Set();
    links.forEach(l => {
      const src = typeof l.source === "object" ? l.source.id : l.source;
      const tgt = typeof l.target === "object" ? l.target.id : l.target;
      if (src === d.id) connected.add(tgt);
      if (tgt === d.id) connected.add(src);
    });

    node.select("circle").attr("opacity", n => n.id === d.id || connected.has(n.id) ? 1 : 0.15);
    node.select("text").attr("opacity", n => n.id === d.id || connected.has(n.id) ? 1 : 0.15);
    link.attr("stroke-opacity", l => {
      const src = typeof l.source === "object" ? l.source.id : l.source;
      const tgt = typeof l.target === "object" ? l.target.id : l.target;
      return src === d.id || tgt === d.id ? 0.9 : 0.05;
    });

    // Build allies/rivals list
    const allies = [];
    const rivs = [];
    links.forEach(l => {
      const src = typeof l.source === "object" ? l.source.id : l.source;
      const tgt = typeof l.target === "object" ? l.target.id : l.target;
      if (src === d.id || tgt === d.id) {
        const other = src === d.id ? tgt : src;
        if (l.type === "alliance") allies.push(other);
        else rivs.push(other);
      }
    });

    const html = `<strong>${d.id}</strong><br>` +
      (allies.length ? `Allies: ${allies.join(", ")}<br>` : "") +
      (rivs.length ? `Rivals: ${rivs.join(", ")}` : "");
    showTooltip(html, event);
  })
  .on("mousemove", moveTooltip)
  .on("mouseleave", function() {
    node.select("circle").attr("opacity", 0.85);
    node.select("text").attr("opacity", 1);
    link.attr("stroke-opacity", 0.5);
    hideTooltip();
  });

  // Legend
  const legend = svg.append("g").attr("transform", `translate(${chartWidth - 160}, ${chartHeight - 40})`);
  legend.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 30).attr("y2", 0).attr("stroke", "#4a9e4a").attr("stroke-width", 2);
  legend.append("text").attr("x", 36).attr("y", 4).attr("font-size", 10).attr("fill", "#666").text("Alliance");
  legend.append("line").attr("x1", 0).attr("y1", 18).attr("x2", 30).attr("y2", 18).attr("stroke", "#c44e52").attr("stroke-width", 2).attr("stroke-dasharray", "6,4");
  legend.append("text").attr("x", 36).attr("y", 22).attr("font-size", 10).attr("fill", "#666").text("Rivalry");

  // Tick
  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);
    node.attr("transform", d => `translate(${d.x},${d.y})`);
  });

  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x; d.fy = d.y;
  }
  function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null; d.fy = null;
  }
}
