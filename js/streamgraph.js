/* Interactive streamgraph — SLL-style with toggle buttons, episode dots, and stream areas */

async function renderStreamgraph() {
  const raw = await loadJSON("data/streamgraph.json");
  const posts = await loadJSON("data/posts.json");
  const categories = raw.categories;
  const data = raw.data;

  const container = document.getElementById("stream-chart");
  const width = Math.min(container.clientWidth, 900);

  // --- Category toggle buttons ---
  const toggleArea = document.createElement("div");
  toggleArea.className = "stream-toggles";
  container.appendChild(toggleArea);

  const activeCategories = new Set(categories);

  // Build toggle grid
  const toggleGrid = document.createElement("div");
  toggleGrid.className = "stream-toggle-grid";
  toggleArea.appendChild(toggleGrid);

  categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "stream-toggle-btn active";
    btn.style.setProperty("--cat-color", catColor(cat));
    btn.innerHTML = cat;
    btn.dataset.category = cat;
    btn.addEventListener("click", () => {
      if (activeCategories.has(cat)) {
        activeCategories.delete(cat);
        btn.classList.remove("active");
      } else {
        activeCategories.add(cat);
        btn.classList.add("active");
      }
      updateChart();
    });
    toggleGrid.appendChild(btn);
  });

  // Show All / Remove All buttons
  const controlRow = document.createElement("div");
  controlRow.className = "stream-controls";
  controlRow.innerHTML = `
    <button class="stream-control-btn" id="stream-show-all">Show All</button>
    <button class="stream-control-btn" id="stream-remove-all">Remove All</button>
  `;
  toggleArea.appendChild(controlRow);

  document.getElementById("stream-show-all").addEventListener("click", () => {
    categories.forEach(c => activeCategories.add(c));
    toggleGrid.querySelectorAll(".stream-toggle-btn").forEach(b => b.classList.add("active"));
    updateChart();
  });
  document.getElementById("stream-remove-all").addEventListener("click", () => {
    activeCategories.clear();
    toggleGrid.querySelectorAll(".stream-toggle-btn").forEach(b => b.classList.remove("active"));
    updateChart();
  });

  // --- Chart area ---
  const chartHeight = 320;
  const margin = { top: 20, right: 20, bottom: 40, left: 20 };

  const chartDiv = document.createElement("div");
  chartDiv.className = "stream-chart-area";
  container.appendChild(chartDiv);

  const svg = d3.select(chartDiv)
    .append("svg")
    .attr("width", width)
    .attr("height", chartHeight);

  const x = d3.scalePoint()
    .domain(data.map(d => d.period))
    .range([margin.left, width - margin.right]);

  // --- Episode dots timeline ---
  const dotsHeight = 60;
  const dotsDiv = document.createElement("div");
  dotsDiv.className = "stream-dots-area";
  container.appendChild(dotsDiv);

  const dotsSvg = d3.select(dotsDiv)
    .append("svg")
    .attr("width", width)
    .attr("height", dotsHeight);

  // Parse dates for dot placement
  const sortedPosts = [...posts].filter(p => p.date).sort((a, b) => a.date.localeCompare(b.date));
  const dateExtent = d3.extent(sortedPosts, d => new Date(d.date));
  const xDate = d3.scaleTime()
    .domain(dateExtent)
    .range([margin.left + 20, width - margin.right - 20]);

  // "All Episodes" label
  dotsSvg.append("text")
    .attr("x", 4)
    .attr("y", 28)
    .attr("font-size", 10)
    .attr("fill", "#bbb")
    .text("All Posts");

  // Date axis
  const dateGroups = {};
  sortedPosts.forEach(p => {
    const yearMonth = p.date.slice(0, 7);
    if (!dateGroups[yearMonth]) dateGroups[yearMonth] = [];
    dateGroups[yearMonth].push(p);
  });

  // Year markers
  const years = [...new Set(sortedPosts.map(p => p.date.slice(0, 4)))];
  years.forEach(yr => {
    const firstOfYear = new Date(yr + "-01-01");
    const xPos = xDate(firstOfYear);
    if (xPos >= margin.left && xPos <= width - margin.right) {
      dotsSvg.append("line")
        .attr("x1", xPos).attr("y1", 0)
        .attr("x2", xPos).attr("y2", dotsHeight)
        .attr("stroke", "#e0e0e0")
        .attr("stroke-dasharray", "3,3");
      dotsSvg.append("text")
        .attr("x", xPos + 4).attr("y", 12)
        .attr("font-size", 11).attr("fill", "#999")
        .text(yr);
    }
  });

  // Draw episode dots
  const dots = dotsSvg.selectAll(".ep-dot")
    .data(sortedPosts)
    .join("circle")
    .attr("class", "ep-dot")
    .attr("cx", d => xDate(new Date(d.date)))
    .attr("cy", 28)
    .attr("r", 3.5)
    .attr("fill", d => catColor(d.category))
    .attr("stroke", "#fff")
    .attr("stroke-width", 0.5)
    .attr("opacity", 0.8)
    .on("mouseenter", (event, d) => {
      showTooltip(`${catDot(d.category)}<strong>${d.title}</strong><br>${d.date}`, event);
    })
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip);

  function updateChart() {
    svg.selectAll("*").remove();

    const activeCats = categories.filter(c => activeCategories.has(c));

    if (activeCats.length === 0) {
      svg.append("text")
        .attr("x", width / 2).attr("y", chartHeight / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", 14).attr("fill", "#ccc")
        .text("Select a category above to see its stream");

      // Dim all dots
      dots.attr("opacity", 0.15);
      return;
    }

    // Update dot opacity
    dots.attr("opacity", d => activeCategories.has(d.category) ? 0.8 : 0.15);

    const stack = d3.stack()
      .keys(activeCats)
      .offset(d3.stackOffsetWiggle)
      .order(d3.stackOrderInsideOut);

    const series = stack(data);

    const y = d3.scaleLinear()
      .domain([
        d3.min(series, s => d3.min(s, d => d[0])),
        d3.max(series, s => d3.max(s, d => d[1]))
      ])
      .range([chartHeight - margin.bottom, margin.top]);

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

    // Stream labels when few categories selected
    if (activeCats.length <= 3) {
      series.forEach(s => {
        const midIdx = Math.floor(s.length / 2);
        const midY = (s[midIdx][0] + s[midIdx][1]) / 2;
        svg.append("text")
          .attr("x", x(data[midIdx].period))
          .attr("y", y(midY))
          .attr("text-anchor", "middle")
          .attr("dy", "0.35em")
          .attr("font-size", 12)
          .attr("font-weight", 500)
          .attr("fill", catColor(s.key))
          .attr("opacity", 0.9)
          .attr("pointer-events", "none")
          .text(s.key);
      });
    }

    // X axis labels
    svg.selectAll(".period-label")
      .data(data)
      .join("text")
      .attr("class", "period-label")
      .attr("x", d => x(d.period))
      .attr("y", chartHeight - 8)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .attr("fill", "#999")
      .text(d => d.period);
  }

  updateChart();
}
