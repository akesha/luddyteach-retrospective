/* Streamgraph visualization */

async function renderStreamgraph() {
  const raw = await loadJSON("data/streamgraph.json");
  const categories = raw.categories;
  const data = raw.data;

  const container = document.getElementById("stream-chart");
  const width = Math.min(container.clientWidth, 860);
  const height = 360;
  const margin = { top: 20, right: 20, bottom: 40, left: 20 };

  const svg = d3.select("#stream-chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const x = d3.scalePoint()
    .domain(data.map(d => d.period))
    .range([margin.left, width - margin.right]);

  const stack = d3.stack()
    .keys(categories)
    .offset(d3.stackOffsetWiggle)
    .order(d3.stackOrderInsideOut);

  const series = stack(data);

  const y = d3.scaleLinear()
    .domain([
      d3.min(series, s => d3.min(s, d => d[0])),
      d3.max(series, s => d3.max(s, d => d[1]))
    ])
    .range([height - margin.bottom, margin.top]);

  const area = d3.area()
    .x(d => x(d.data.period))
    .y0(d => y(d[0]))
    .y1(d => y(d[1]))
    .curve(d3.curveBasis);

  // Draw streams
  svg.selectAll("path")
    .data(series)
    .join("path")
    .attr("d", area)
    .attr("fill", d => catColor(d.key))
    .attr("opacity", 0.85)
    .attr("stroke", "#fff")
    .attr("stroke-width", 0.5)
    .on("mouseenter", function(event, d) {
      svg.selectAll("path").attr("opacity", 0.3);
      d3.select(this).attr("opacity", 1);
      showTooltip(`${catDot(d.key)}<strong>${d.key}</strong>`, event);
    })
    .on("mousemove", function(event, d) {
      // Find closest data point
      const [mx] = d3.pointer(event);
      const periods = data.map(dd => dd.period);
      const positions = periods.map(p => x(p));
      let closest = 0;
      let minDist = Infinity;
      positions.forEach((pos, i) => {
        const dist = Math.abs(pos - mx);
        if (dist < minDist) { minDist = dist; closest = i; }
      });
      const period = periods[closest];
      const count = data[closest][d.key];
      showTooltip(
        `${catDot(d.key)}<strong>${d.key}</strong><br>${period}: ${count} post${count !== 1 ? 's' : ''}`,
        event
      );
    })
    .on("mouseleave", function() {
      svg.selectAll("path").attr("opacity", 0.85);
      hideTooltip();
    });

  // X axis labels
  svg.selectAll(".period-label")
    .data(data)
    .join("text")
    .attr("class", "period-label")
    .attr("x", d => x(d.period))
    .attr("y", height - 8)
    .attr("text-anchor", "middle")
    .attr("font-size", 11)
    .attr("fill", "#999")
    .text(d => d.period);

  // Legend
  const legend = svg.append("g")
    .attr("transform", `translate(${margin.left + 4}, ${margin.top})`);

  categories.forEach((cat, i) => {
    const g = legend.append("g").attr("transform", `translate(0, ${i * 18})`);
    g.append("rect").attr("width", 10).attr("height", 10).attr("fill", catColor(cat)).attr("rx", 2);
    g.append("text").attr("x", 14).attr("y", 9).attr("font-size", 10).attr("fill", "#666").text(cat);
  });
}
