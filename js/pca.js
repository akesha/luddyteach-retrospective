/* PCA scatter plot */

async function renderPCA() {
  const data = await loadJSON("data/pca.json");
  const points = data.points;

  const container = document.getElementById("pca-chart");
  const size = Math.min(container.clientWidth, 600);
  const margin = { top: 20, right: 20, bottom: 50, left: 50 };

  const svg = d3.select("#pca-chart")
    .append("svg")
    .attr("width", size)
    .attr("height", size);

  const xExtent = d3.extent(points, d => d.x);
  const yExtent = d3.extent(points, d => d.y);
  const xPad = (xExtent[1] - xExtent[0]) * 0.1;
  const yPad = (yExtent[1] - yExtent[0]) * 0.1;

  const x = d3.scaleLinear()
    .domain([xExtent[0] - xPad, xExtent[1] + xPad])
    .range([margin.left, size - margin.right]);

  const y = d3.scaleLinear()
    .domain([yExtent[0] - yPad, yExtent[1] + yPad])
    .range([size - margin.bottom, margin.top]);

  // Grid lines
  svg.append("g")
    .attr("transform", `translate(0, ${size - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(5).tickSize(-(size - margin.top - margin.bottom)))
    .call(g => g.selectAll("line").attr("stroke", "#eee"))
    .call(g => g.selectAll(".domain").remove())
    .call(g => g.selectAll("text").attr("fill", "#999").attr("font-size", 10));

  svg.append("g")
    .attr("transform", `translate(${margin.left}, 0)`)
    .call(d3.axisLeft(y).ticks(5).tickSize(-(size - margin.left - margin.right)))
    .call(g => g.selectAll("line").attr("stroke", "#eee"))
    .call(g => g.selectAll(".domain").remove())
    .call(g => g.selectAll("text").attr("fill", "#999").attr("font-size", 10));

  // Axis labels
  svg.append("text")
    .attr("x", size / 2)
    .attr("y", size - 6)
    .attr("text-anchor", "middle")
    .attr("font-size", 12)
    .attr("fill", "#999")
    .text(`PC1 (${data.explained_variance[0]}%)`);

  svg.append("text")
    .attr("x", -size / 2)
    .attr("y", 14)
    .attr("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .attr("font-size", 12)
    .attr("fill", "#999")
    .text(`PC2 (${data.explained_variance[1]}%)`);

  // Points
  svg.selectAll("circle")
    .data(points)
    .join("circle")
    .attr("cx", d => x(d.x))
    .attr("cy", d => y(d.y))
    .attr("r", 6)
    .attr("fill", d => catColor(d.category))
    .attr("opacity", 0.8)
    .attr("stroke", "#fff")
    .attr("stroke-width", 1)
    .attr("cursor", "pointer")
    .on("mouseenter", function(event, d) {
      d3.select(this).attr("r", 9).attr("opacity", 1);
      showTooltip(
        `${catDot(d.category)}<strong>${d.title}</strong><br>${d.category}`,
        event
      );
    })
    .on("mousemove", moveTooltip)
    .on("mouseleave", function() {
      d3.select(this).attr("r", 6).attr("opacity", 0.8);
      hideTooltip();
    });

  // Update caption with axis interpretations
  const caption = document.getElementById("pca-caption");
  if (caption) {
    caption.textContent = `PC1 (${data.explained_variance[0]}% variance) spans ${data.pc1_label}. PC2 (${data.explained_variance[1]}%) spans ${data.pc2_label}. Together they capture ${(data.explained_variance[0] + data.explained_variance[1]).toFixed(1)}% of the thematic variation.`;
  }
}
