/* Shannon entropy scatter plot — SLL-style "How Broad Was Each Conversation?" */

async function renderEntropy() {
  const data = await loadJSON("data/entropy.json");
  const sorted = [...data].sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const container = document.getElementById("entropy-chart");
  const width = Math.min(container.clientWidth, 860);
  const height = 320;
  const margin = { top: 20, right: 20, bottom: 40, left: 60 };

  const svg = d3.select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const x = d3.scaleLinear()
    .domain([0, sorted.length - 1])
    .range([margin.left, width - margin.right]);

  const yExtent = d3.extent(sorted, d => d.entropy);
  const yPad = (yExtent[1] - yExtent[0]) * 0.15;
  const y = d3.scaleLinear()
    .domain([Math.max(0, yExtent[0] - yPad), Math.min(1, yExtent[1] + yPad)])
    .range([height - margin.bottom, margin.top]);

  // Grid
  svg.append("g")
    .attr("transform", `translate(${margin.left}, 0)`)
    .call(d3.axisLeft(y).ticks(5).tickSize(-(width - margin.left - margin.right)))
    .call(g => g.selectAll("line").attr("stroke", "#f0f0f0"))
    .call(g => g.selectAll(".domain").remove())
    .call(g => g.selectAll("text").attr("fill", "#999").attr("font-size", 10));

  // Y label
  svg.append("text")
    .attr("x", -(height / 2))
    .attr("y", 16)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .attr("font-size", 11)
    .attr("fill", "#999")
    .text("Thematic Diversity (normalized entropy)");

  // Moving average line
  const windowSize = 7;
  const movingAvg = sorted.map((d, i) => {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(sorted.length, i + Math.ceil(windowSize / 2));
    const slice = sorted.slice(start, end);
    const avg = slice.reduce((s, v) => s + v.entropy, 0) / slice.length;
    return { i, avg };
  });

  const line = d3.line()
    .x(d => x(d.i))
    .y(d => y(d.avg))
    .curve(d3.curveBasis);

  svg.append("path")
    .datum(movingAvg)
    .attr("d", line)
    .attr("fill", "none")
    .attr("stroke", "#c44e52")
    .attr("stroke-width", 2)
    .attr("opacity", 0.7);

  // Dots
  svg.selectAll("circle")
    .data(sorted)
    .join("circle")
    .attr("cx", (d, i) => x(i))
    .attr("cy", d => y(d.entropy))
    .attr("r", 4.5)
    .attr("fill", d => catColor(d.category))
    .attr("opacity", 0.6)
    .attr("stroke", "#fff")
    .attr("stroke-width", 0.5)
    .on("mouseenter", function(event, d) {
      d3.select(this).attr("r", 7).attr("opacity", 1);
      showTooltip(
        `${catDot(d.category)}<strong>${d.title}</strong><br>` +
        `Diversity: <strong>${d.entropy.toFixed(3)}</strong><br>` +
        `Dominant: ${d.dominant}`,
        event
      );
    })
    .on("mousemove", moveTooltip)
    .on("mouseleave", function() {
      d3.select(this).attr("r", 4.5).attr("opacity", 0.6);
      hideTooltip();
    });

  // X axis date labels
  const dateLabels = [];
  let lastLabel = "";
  sorted.forEach((d, i) => {
    if (!d.date) return;
    const label = d.date.slice(0, 7);
    if (label !== lastLabel && i % Math.max(1, Math.floor(sorted.length / 8)) === 0) {
      dateLabels.push({ i, label });
      lastLabel = label;
    }
  });

  svg.selectAll(".date-label")
    .data(dateLabels)
    .join("text")
    .attr("x", d => x(d.i))
    .attr("y", height - 8)
    .attr("text-anchor", "middle")
    .attr("font-size", 10)
    .attr("fill", "#999")
    .text(d => d.label);

  // Update caption
  const avgEntropy = sorted.reduce((s, d) => s + d.entropy, 0) / sorted.length;
  const caption = document.getElementById("entropy-caption");
  if (caption) {
    caption.textContent = `Mean thematic diversity: ${avgEntropy.toFixed(3)} on a 0\u20131 scale. Posts with entropy near 1.0 touch many themes equally; posts near 0 focus intensely on one.`;
  }
}
