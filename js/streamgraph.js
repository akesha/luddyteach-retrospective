/* Interactive streamgraph — SLL-style with clustered toggle buttons, theme timelines, and episode dots */

// Organize categories into conceptual clusters (mirroring SLL's structure)
const STREAM_CLUSTERS = {
  "The Craft": {
    color: "#9B2335",
    categories: ["Teaching Strategies", "Course Design", "Assessment & Feedback"]
  },
  "The People": {
    color: "#C47F29",
    categories: ["Student Engagement", "Inclusion & Accessibility", "Faculty Wellbeing"]
  },
  "The Tech": {
    color: "#2A6496",
    categories: ["AI & Technology"]
  }
};

async function renderStreamgraph() {
  const raw = await loadJSON("data/streamgraph.json");
  const posts = await loadJSON("data/posts.json");
  const categories = raw.categories;
  const data = raw.data;

  const container = document.getElementById("stream-chart");
  const width = Math.min(container.clientWidth, 900);

  // --- Clustered toggle buttons ---
  const toggleArea = document.createElement("div");
  toggleArea.className = "stream-toggles";
  container.appendChild(toggleArea);

  const activeCategories = new Set(categories);
  const allButtons = [];

  // Build cluster rows
  Object.entries(STREAM_CLUSTERS).forEach(([clusterName, cluster]) => {
    const row = document.createElement("div");
    row.className = "stream-cluster-row";

    const label = document.createElement("div");
    label.className = "stream-cluster-label";
    label.style.color = cluster.color;
    label.textContent = clusterName.toUpperCase();
    row.appendChild(label);

    const btnGroup = document.createElement("div");
    btnGroup.className = "stream-cluster-buttons";

    cluster.categories.forEach(cat => {
      const btn = document.createElement("button");
      btn.className = "stream-toggle-btn active";
      btn.style.setProperty("--cat-color", catColor(cat));
      btn.dataset.category = cat;

      // Checkmark + label
      btn.innerHTML = `<span class="stream-btn-check">✓</span>${cat}`;

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
      btnGroup.appendChild(btn);
      allButtons.push(btn);
    });

    row.appendChild(btnGroup);
    toggleArea.appendChild(row);
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
    allButtons.forEach(b => b.classList.add("active"));
    updateAll();
  });
  document.getElementById("stream-remove-all").addEventListener("click", () => {
    activeCategories.clear();
    allButtons.forEach(b => b.classList.remove("active"));
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

  // --- "Back in Time / Forward in Time" labels ---
  const timeLabels = document.createElement("div");
  timeLabels.className = "stream-time-labels";
  timeLabels.innerHTML = `
    <span class="stream-time-label">&larr; Back in Time</span>
    <span class="stream-time-label">Forward in Time &rarr;</span>
  `;
  container.appendChild(timeLabels);

  // --- Timeline section (per-theme areas + episode dots) ---
  const timelineDiv = document.createElement("div");
  timelineDiv.className = "stream-timeline";
  container.appendChild(timelineDiv);

  // Sort posts by date
  const sortedPosts = [...posts].filter(p => p.date).sort((a, b) => a.date.localeCompare(b.date));
  const dateExtent = d3.extent(sortedPosts, d => new Date(d.date));
  const datePad = (dateExtent[1] - dateExtent[0]) * 0.02;
  const timelineLeft = 140;
  const xDate = d3.scaleTime()
    .domain([new Date(dateExtent[0].getTime() - datePad), new Date(dateExtent[1].getTime() + datePad)])
    .range([timelineLeft, width - 20]);

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

      // Category label — positioned as a proper row header
      rowSvg.append("text")
        .attr("x", timelineLeft - 12)
        .attr("y", rowHeight / 2 + 4)
        .attr("text-anchor", "end")
        .attr("font-size", 12)
        .attr("fill", catColor(cat))
        .attr("font-weight", 500)
        .text(cat);

      // Build density with triangle kernel
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
            count += 1 - dist / kernelRadius;
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

    // "All Posts" label — right-aligned to match theme labels
    dotsSvg.append("text")
      .attr("x", timelineLeft - 12)
      .attr("y", 24)
      .attr("text-anchor", "end")
      .attr("font-size", 11)
      .attr("fill", "#bbb")
      .text("All Posts");

    // Year markers
    const years = [...new Set(sortedPosts.map(p => p.date.slice(0, 4)))];
    years.forEach(yr => {
      const firstOfYear = new Date(yr + "-01-01");
      const xPos = xDate(firstOfYear);
      if (xPos >= timelineLeft && xPos <= width - 20) {
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
