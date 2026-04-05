/* PCA scatter plot — SLL-style landscape with clusters, region labels, click-to-lock detail panel */

const CLUSTER_COLORS = ["#C44E52", "#DD8452", "#55A868", "#4C72B0"];

async function renderPCA() {
  const data = await loadJSON("data/pca.json");
  const points = data.points;
  const clusters = data.clusters;

  const container = document.getElementById("pca-chart");
  const containerWidth = Math.min(container.clientWidth, 900);
  const chartWidth = containerWidth > 700 ? containerWidth - 280 : containerWidth;
  const chartHeight = Math.min(chartWidth, 560);
  const margin = { top: 30, right: 30, bottom: 50, left: 50 };

  // Create wrapper with chart + detail panel side by side
  const wrapper = document.createElement("div");
  wrapper.className = "pca-wrapper";
  container.appendChild(wrapper);

  const chartDiv = document.createElement("div");
  chartDiv.className = "pca-chart-area";
  wrapper.appendChild(chartDiv);

  const panelDiv = document.createElement("div");
  panelDiv.className = "pca-panel";
  panelDiv.innerHTML = '<div class="pca-panel-empty">Click any dot to explore a post</div>';
  wrapper.appendChild(panelDiv);

  const svg = d3.select(chartDiv)
    .append("svg")
    .attr("width", chartWidth)
    .attr("height", chartHeight);

  const xExtent = d3.extent(points, d => d.x);
  const yExtent = d3.extent(points, d => d.y);
  const xPad = (xExtent[1] - xExtent[0]) * 0.12;
  const yPad = (yExtent[1] - yExtent[0]) * 0.12;

  const x = d3.scaleLinear()
    .domain([xExtent[0] - xPad, xExtent[1] + xPad])
    .range([margin.left, chartWidth - margin.right]);

  const y = d3.scaleLinear()
    .domain([yExtent[0] - yPad, yExtent[1] + yPad])
    .range([chartHeight - margin.bottom, margin.top]);

  // Subtle grid
  svg.append("g")
    .attr("transform", `translate(0, ${chartHeight - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(5).tickSize(-(chartHeight - margin.top - margin.bottom)))
    .call(g => g.selectAll("line").attr("stroke", "#f0f0f0"))
    .call(g => g.selectAll(".domain").remove())
    .call(g => g.selectAll("text").attr("fill", "#ccc").attr("font-size", 10));

  svg.append("g")
    .attr("transform", `translate(${margin.left}, 0)`)
    .call(d3.axisLeft(y).ticks(5).tickSize(-(chartWidth - margin.left - margin.right)))
    .call(g => g.selectAll("line").attr("stroke", "#f0f0f0"))
    .call(g => g.selectAll(".domain").remove())
    .call(g => g.selectAll("text").attr("fill", "#ccc").attr("font-size", 10));

  // Region labels — large, faded background text at cluster centroids
  svg.selectAll(".region-label")
    .data(clusters)
    .join("text")
    .attr("class", "region-label")
    .attr("x", d => x(d.centroid.x))
    .attr("y", d => y(d.centroid.y))
    .attr("text-anchor", "middle")
    .attr("font-family", "'Cormorant Garamond', serif")
    .attr("font-size", 28)
    .attr("font-weight", 300)
    .attr("fill", "#e0dcd8")
    .attr("pointer-events", "none")
    .text((d, i) => d.name.split(" & ")[0]);

  // Cluster legend
  const legend = svg.append("g")
    .attr("transform", `translate(${margin.left + 8}, ${margin.top + 4})`);

  clusters.forEach((cluster, i) => {
    const g = legend.append("g").attr("transform", `translate(0, ${i * 20})`);
    g.append("circle").attr("cx", 5).attr("cy", 0).attr("r", 5).attr("fill", CLUSTER_COLORS[i]).attr("opacity", 0.8);
    g.append("text").attr("x", 16).attr("y", 4).attr("font-size", 11).attr("fill", "#888").text(cluster.name);
  });

  // Axis labels
  svg.append("text")
    .attr("x", chartWidth / 2)
    .attr("y", chartHeight - 6)
    .attr("text-anchor", "middle")
    .attr("font-size", 11)
    .attr("fill", "#aaa")
    .text(`PC1 (${data.explained_variance[0]}%)`);

  svg.append("text")
    .attr("x", -chartHeight / 2)
    .attr("y", 14)
    .attr("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .attr("font-size", 11)
    .attr("fill", "#aaa")
    .text(`PC2 (${data.explained_variance[1]}%)`);

  // State for click-to-lock
  let lockedId = null;

  // Draw all points — semi-transparent, colored by cluster
  const dots = svg.selectAll(".pca-dot")
    .data(points)
    .join("circle")
    .attr("class", "pca-dot")
    .attr("cx", d => x(d.x))
    .attr("cy", d => y(d.y))
    .attr("r", 5.5)
    .attr("fill", d => CLUSTER_COLORS[d.cluster])
    .attr("opacity", 0.45)
    .attr("stroke", "#fff")
    .attr("stroke-width", 0.8)
    .attr("cursor", "pointer");

  // Hover: highlight + tooltip
  dots.on("mouseenter", function(event, d) {
    if (lockedId) return;
    highlightPoint(d);
    showTooltip(
      `<span class="cat-dot" style="background:${CLUSTER_COLORS[d.cluster]}"></span>` +
      `<strong>${d.title}</strong><br><span style="color:#aaa">${d.category}</span>`,
      event
    );
  })
  .on("mousemove", function(event) {
    if (!lockedId) moveTooltip(event);
  })
  .on("mouseleave", function() {
    if (!lockedId) {
      resetHighlight();
      hideTooltip();
    }
  });

  // Click: lock and show detail panel
  dots.on("click", function(event, d) {
    event.stopPropagation();
    hideTooltip();
    if (lockedId === d.id) {
      // Unlock
      lockedId = null;
      resetHighlight();
      panelDiv.innerHTML = '<div class="pca-panel-empty">Click any dot to explore a post</div>';
      return;
    }
    lockedId = d.id;
    highlightPoint(d);
    showPanel(d);
  });

  // Click background to unlock
  svg.on("click", function() {
    if (lockedId) {
      lockedId = null;
      resetHighlight();
      panelDiv.innerHTML = '<div class="pca-panel-empty">Click any dot to explore a post</div>';
    }
  });

  function highlightPoint(d) {
    dots.attr("opacity", p => p.id === d.id ? 1 : 0.15)
        .attr("r", p => p.id === d.id ? 9 : 4);

    // Also highlight nearest neighbors
    const neighbors = findNeighbors(d, 4);
    const neighborIds = new Set(neighbors.map(n => n.id));
    dots.filter(p => neighborIds.has(p.id))
        .attr("opacity", 0.7)
        .attr("r", 6);
  }

  function resetHighlight() {
    dots.attr("opacity", 0.45).attr("r", 5.5);
  }

  function findNeighbors(point, n) {
    return points
      .filter(p => p.id !== point.id)
      .map(p => ({ ...p, dist: Math.hypot(p.x - point.x, p.y - point.y) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, n);
  }

  function showPanel(d) {
    const neighbors = findNeighbors(d, 3);
    const topHtml = d.topThemes.map(t =>
      `<span class="theme-tag high">${t.name}</span>`
    ).join("");
    const lowHtml = d.lowThemes.map(t =>
      `<span class="theme-tag low">${t.name}</span>`
    ).join("");
    const neighborsHtml = neighbors.map(n =>
      `<div class="neighbor-item" data-id="${n.id}">
        <span class="cat-dot" style="background:${CLUSTER_COLORS[n.cluster]}"></span>
        ${n.title.length > 45 ? n.title.slice(0, 43) + "..." : n.title}
      </div>`
    ).join("");

    panelDiv.innerHTML = `
      <div class="pca-panel-content">
        <div class="panel-cluster" style="color:${CLUSTER_COLORS[d.cluster]}">
          ${d.clusterName}
        </div>
        <h3 class="panel-title">${d.title}</h3>
        <p class="panel-summary">${d.summary}</p>
        <div class="panel-section-label">WHY HERE?</div>
        <p class="panel-why">Scores high on ${topHtml}, low on ${lowHtml}, placing it in the <em>${d.clusterName.split(" & ")[0]}</em> region.</p>
        <div class="panel-section-label">THEMATIC NEIGHBORS</div>
        <div class="panel-neighbors">${neighborsHtml}</div>
      </div>
    `;

    // Click neighbor to navigate
    panelDiv.querySelectorAll(".neighbor-item").forEach(el => {
      el.addEventListener("click", () => {
        const nid = el.dataset.id;
        const nd = points.find(p => p.id === nid);
        if (nd) {
          lockedId = nd.id;
          highlightPoint(nd);
          showPanel(nd);
        }
      });
    });
  }

  // Update caption
  const caption = document.getElementById("pca-caption");
  if (caption) {
    caption.textContent = `PC1 (${data.explained_variance[0]}%) spans ${data.pc1_label}. PC2 (${data.explained_variance[1]}%) spans ${data.pc2_label}. Together they capture ${(data.explained_variance[0] + data.explained_variance[1]).toFixed(1)}% of the thematic variation. Posts are colored by cluster, not category.`;
  }
}
