/* Novelty lollipop chart */

async function renderNovelty() {
  const data = await loadJSON("data/novelty.json");
  const topNovel = data.slice(0, 10);
  const topTypical = data.slice(-5).reverse();

  const container = document.getElementById("novelty-chart");
  const width = Math.min(container.clientWidth, 680);

  function drawSection(parentEl, items, label, offsetY) {
    const barHeight = 32;
    const margin = { top: 30, right: 60, bottom: 8, left: 320 };
    const height = items.length * barHeight + margin.top + margin.bottom;

    const svg = d3.select(parentEl)
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    // Section label
    svg.append("text")
      .attr("x", margin.left)
      .attr("y", 18)
      .attr("font-size", 13)
      .attr("font-weight", 500)
      .attr("fill", "#1a1a1a")
      .text(label);

    const maxVal = d3.max(items, d => d.novelty);
    const x = d3.scaleLinear()
      .domain([0, maxVal * 1.1])
      .range([margin.left, width - margin.right]);

    const y = d3.scaleBand()
      .domain(items.map(d => d.id))
      .range([margin.top, height - margin.bottom])
      .padding(0.35);

    // Lines
    svg.selectAll(".lollipop-line")
      .data(items)
      .join("line")
      .attr("x1", margin.left)
      .attr("y1", d => y(d.id) + y.bandwidth() / 2)
      .attr("x2", d => x(d.novelty))
      .attr("y2", d => y(d.id) + y.bandwidth() / 2)
      .attr("stroke", d => catColor(d.category))
      .attr("stroke-width", 2)
      .attr("opacity", 0.6);

    // Circles
    svg.selectAll(".lollipop-circle")
      .data(items)
      .join("circle")
      .attr("cx", d => x(d.novelty))
      .attr("cy", d => y(d.id) + y.bandwidth() / 2)
      .attr("r", 6)
      .attr("fill", d => catColor(d.category))
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .on("mouseenter", (event, d) => {
        showTooltip(
          `${catDot(d.category)}<strong>${d.title}</strong><br>Novelty: ${d.novelty.toFixed(3)}`,
          event
        );
      })
      .on("mousemove", moveTooltip)
      .on("mouseleave", hideTooltip);

    // Labels (truncated titles)
    svg.selectAll(".lollipop-label")
      .data(items)
      .join("text")
      .attr("x", margin.left - 8)
      .attr("y", d => y(d.id) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "end")
      .attr("font-size", 11)
      .attr("fill", "#444")
      .text(d => d.title.length > 42 ? d.title.slice(0, 40) + "..." : d.title);

    // Score labels
    svg.selectAll(".lollipop-score")
      .data(items)
      .join("text")
      .attr("x", d => x(d.novelty) + 10)
      .attr("y", d => y(d.id) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("font-size", 11)
      .attr("fill", "#999")
      .text(d => d.novelty.toFixed(2));
  }

  drawSection(container, topNovel, "Most Novel", 0);
  drawSection(container, topTypical, "Most Typical", 0);
}
