/* Interactive streamgraph — SLL-style with toggle buttons, theme timelines, and episode dots */

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
      updateAll();
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
    updateAll();
  });
  document.getElementById("stream-remove-all").addEventListener("click", () => {
    activeCategories.clear();
    toggleGrid.querySelectorAll(".stream-toggle-btn").forEach(b => b.classList.remove("active"));
    updateAll();
  });

  // --- Streamgraph area ---
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

  // --- Timeline section (per-theme areas + episode dots) ---
  const timelineDiv = document.createElement("div");
  timelineDiv.className = "stream-timeline";
  container.appendChild(timelineDiv);

  // Sort posts by date
  const sortedPosts = [...posts].filter(p => p.date).sort((a, b) => a.date.localeCompare(b.date));
  const dateExtent = d3.extent(sortedPosts, d => new Date(d.date));
  // Pad the extent slightly
  const datePad = (dateExtent[1] - dateExtent[0]) * 0.02;
  const xDate = d3.scaleTime()
    .domain([new Date(dateExtent[0].getTime() - datePad), new Date(dateExtent[1].getTime() + datePad)])
    .range([60, width - 20]);

  function updateAll() {
    updateStreamgraph();
    updateTimeline();
  }

  function updateStreamgraph() {
    svg.selectAll("*").remove();

    const activeCats = categories.filter(c => activeCategories.has(c));

    if (activeCats.length === 0) {
      svg.append("text")
        .attr("x", width / 2).attr("y", chartHeight / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", 14).attr("fill", "#ccc")
        .text("Select a category above to see its stream");
      return;
    }

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

  function updateTimeline() {
    timelineDiv.innerHTML = "";

    const activeCats = categories.filter(c => activeCategories.has(c));

    // Build a per-category density area for each active category
    // Count posts per week for smoother curves
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const startDate = xDate.domain()[0].getTime();
    const endDate = xDate.domain()[1].getTime();

    activeCats.forEach(cat => {
      const catPosts = sortedPosts.filter(p => p.category === cat);
      if (catPosts.length === 0) return;

      const rowHeight = 50;
      const areaHeight = 30;
      const rowSvg = d3.select(timelineDiv)
        .append("svg")
        .attr("width", width)
        .attr("height", rowHeight);

      // Category label
      rowSvg.append("text")
        .attr("x", 4)
        .attr("y", rowHeight / 2 + 4)
        .attr("font-size", 10)
        .attr("fill", catColor(cat))
        .attr("font-weight", 500)
        .text(cat.length > 18 ? cat.slice(0, 16) + "…" : cat);

      // Build density: count posts in sliding windows
      const numBins = 40;
      const binWidth = (endDate - startDate) / numBins;
      const kernelRadius = binWidth * 2;
      const density = [];
      for (let i = 0; i <= numBins; i++) {
        const t = startDate + i * binWidth;
        let count = 0;
        catPosts.forEach(p => {
          const pt = new Date(p.date).getTime();
          const dist = Math.abs(pt - t);
          if (dist < kernelRadius) {
            count += 1 - dist / kernelRadius; // triangle kernel
          }
        });
        density.push({ t: new Date(t), v: count });
      }

      const yArea = d3.scaleLinear()
        .domain([0, d3.max(density, d => d.v) || 1])
        .range([rowHeight - 5, rowHeight - 5 - areaHeight]);

      const areaGen = d3.area()
        .x(d => xDate(d.t))
        .y0(rowHeight - 5)
        .y1(d => yArea(d.v))
        .curve(d3.curveBasis);

      rowSvg.append("path")
        .datum(density)
        .attr("d", areaGen)
        .attr("fill", catColor(cat))
        .attr("opacity", 0.3);

      rowSvg.append("path")
        .datum(density)
        .attr("d", d3.line().x(d => xDate(d.t)).y(d => yArea(d.v)).curve(d3.curveBasis))
        .attr("fill", "none")
        .attr("stroke", catColor(cat))
        .attr("stroke-width", 1.5)
        .attr("opacity", 0.7);
    });

    // --- All Posts dots row ---
    const dotsHeight = 50;
    const dotsSvg = d3.select(timelineDiv)
      .append("svg")
      .attr("width", width)
      .attr("height", dotsHeight);

    // "All Posts" label
    dotsSvg.append("text")
      .attr("x", 4)
      .attr("y", 24)
      .attr("font-size", 10)
      .attr("fill", "#bbb")
      .text("All Posts");

    // Year markers
    const years = [...new Set(sortedPosts.map(p => p.date.slice(0, 4)))];
    years.forEach(yr => {
      const firstOfYear = new Date(yr + "-01-01");
      const xPos = xDate(firstOfYear);
      if (xPos >= 60 && xPos <= width - 20) {
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

    // Draw episode dots — colored if active, gray if not
    dotsSvg.selectAll(".ep-dot")
      .data(sortedPosts)
      .join("circle")
      .attr("class", "ep-dot")
      .attr("cx", d => xDate(new Date(d.date)))
      .attr("cy", 24)
      .attr("r", 4)
      .attr("fill", d => activeCategories.has(d.category) ? catColor(d.category) : "#ddd")
      .attr("stroke", d => activeCategories.has(d.category) ? "#fff" : "#ccc")
      .attr("stroke-width", 0.8)
      .attr("cursor", "pointer")
      .on("mouseenter", function(event, d) {
        d3.select(this).attr("r", 7);
        showTooltip(
          `${catDot(d.category)}<strong>${d.title}</strong><br>` +
          `<span style="color:#aaa">${d.category}</span><br>${d.date}`,
          event
        );
      })
      .on("mousemove", moveTooltip)
      .on("mouseleave", function() {
        d3.select(this).attr("r", 4);
        hideTooltip();
      });
  }

  updateAll();
}
