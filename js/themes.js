/* Horizontal bar chart for category distribution */

async function renderThemeChart() {
  const stats = await loadJSON("data/stats.json");
  const data = Object.entries(stats.categories)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const total = data.reduce((s, d) => s + d.count, 0);

  const container = document.getElementById("theme-chart");
  const width = Math.min(container.clientWidth, 680);
  const barHeight = 36;
  const margin = { top: 8, right: 60, bottom: 8, left: 180 };
  const height = data.length * barHeight + margin.top + margin.bottom;

  const svg = d3.select("#theme-chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const x = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.count)])
    .range([margin.left, width - margin.right]);

  const y = d3.scaleBand()
    .domain(data.map(d => d.name))
    .range([margin.top, height - margin.bottom])
    .padding(0.3);

  // Bars
  svg.selectAll("rect")
    .data(data)
    .join("rect")
    .attr("x", margin.left)
    .attr("y", d => y(d.name))
    .attr("height", y.bandwidth())
    .attr("fill", d => catColor(d.name))
    .attr("rx", 3)
    .attr("width", 0)
    .on("mouseenter", (event, d) => {
      const pct = ((d.count / total) * 100).toFixed(0);
      showTooltip(`${catDot(d.name)}<strong>${d.name}</strong><br>${d.count} posts (${pct}%)`, event);
    })
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip)
    .transition()
    .duration(800)
    .delay((d, i) => i * 80)
    .attr("width", d => x(d.count) - margin.left);

  // Labels
  svg.selectAll(".bar-label")
    .data(data)
    .join("text")
    .attr("class", "bar-label")
    .attr("x", margin.left - 8)
    .attr("y", d => y(d.name) + y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "end")
    .attr("font-size", 13)
    .attr("fill", "#1a1a1a")
    .text(d => d.name);

  // Counts
  svg.selectAll(".bar-count")
    .data(data)
    .join("text")
    .attr("class", "bar-count")
    .attr("y", d => y(d.name) + y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .attr("font-size", 13)
    .attr("fill", "#666")
    .attr("opacity", 0)
    .transition()
    .duration(800)
    .delay((d, i) => i * 80 + 400)
    .attr("opacity", 1)
    .attr("x", d => x(d.count) + 6)
    .tween("text", function(d) {
      const node = this;
      return function(t) {
        node.textContent = Math.round(t * d.count);
      };
    });
}
