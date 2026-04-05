/* Vocabulary / Theme Deep Dive — SLL-style "What Did LuddyTeach Talk About?" */

// Organize 15 dictionaries into 4 conceptual clusters
const THEME_CLUSTERS = {
  "The Craft": {
    color: "#C44E52",
    description: "The day-to-day work of teaching: how courses are built, how learning is assessed, and how feedback reaches students.",
    themes: ["Assessment Design", "Feedback Practices", "Course Setup", "Scaffolding"]
  },
  "The Mission": {
    color: "#DD8452",
    description: "The larger purposes of education: equity, student wellbeing, motivation, and active participation in learning.",
    themes: ["Equity Inclusion", "Student Motivation", "Student Wellbeing", "Active Learning", "Metacognition"]
  },
  "The Tools": {
    color: "#4C72B0",
    description: "The technologies and platforms that enable teaching at scale: AI, LMS, digital tools, and their responsible integration.",
    themes: ["Ai Tools", "Technology Tools"]
  },
  "The Ecosystem": {
    color: "#55A868",
    description: "The people and systems around teaching: faculty development, industry connections, evidence-based practice, and communication.",
    themes: ["Faculty Development", "Industry Connection", "Evidence Based", "Communication"]
  }
};

async function renderVocabulary() {
  const scores = await loadJSON("data/theme_scores.json");
  const themes = scores.themes;

  // Compute average score per theme
  const avgs = {};
  themes.forEach(theme => {
    const key = theme.toLowerCase().replace(/ /g, "_");
    const vals = scores.posts.map(p => p[key] || 0);
    avgs[theme] = vals.reduce((s, v) => s + v, 0) / vals.length;
  });

  // Build cluster-organized ranked data
  const allRanked = Object.entries(avgs)
    .sort((a, b) => b[1] - a[1])
    .map(([name, score]) => {
      let cluster = "Other";
      let clusterColor = "#999";
      for (const [cName, cData] of Object.entries(THEME_CLUSTERS)) {
        if (cData.themes.includes(name)) {
          cluster = cName;
          clusterColor = cData.color;
          break;
        }
      }
      return { name, score, cluster, clusterColor };
    });

  const container = document.getElementById("vocab-chart");

  // --- Cluster cards ---
  const clusterGrid = document.createElement("div");
  clusterGrid.className = "cluster-grid";
  container.appendChild(clusterGrid);

  for (const [name, data] of Object.entries(THEME_CLUSTERS)) {
    const card = document.createElement("div");
    card.className = "cluster-card";
    card.innerHTML = `
      <div class="cluster-card-header" style="color:${data.color}">${name}</div>
      <p class="cluster-card-desc">${data.description}</p>
      <div class="cluster-card-themes">${data.themes.map(t =>
        `<span class="cluster-theme-tag">${t}</span>`
      ).join("")}</div>
    `;
    clusterGrid.appendChild(card);
  }

  // --- Ranked bar chart ---
  const chartDiv = document.createElement("div");
  chartDiv.className = "vocab-bar-chart";
  container.appendChild(chartDiv);

  const width = Math.min(container.clientWidth, 680);
  const barHeight = 30;
  const margin = { top: 16, right: 60, bottom: 8, left: 140 };
  const height = allRanked.length * barHeight + margin.top + margin.bottom;

  const svg = d3.select(chartDiv)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const maxScore = d3.max(allRanked, d => d.score);

  const x = d3.scaleLinear()
    .domain([0, maxScore * 1.1])
    .range([margin.left, width - margin.right]);

  const y = d3.scaleBand()
    .domain(allRanked.map(d => d.name))
    .range([margin.top, height - margin.bottom])
    .padding(0.25);

  // Bars
  svg.selectAll("rect")
    .data(allRanked)
    .join("rect")
    .attr("x", margin.left)
    .attr("y", d => y(d.name))
    .attr("height", y.bandwidth())
    .attr("fill", d => d.clusterColor)
    .attr("rx", 3)
    .attr("opacity", 0.85)
    .attr("width", 0)
    .on("mouseenter", (event, d) => {
      showTooltip(
        `<strong>${d.name}</strong><br>Cluster: ${d.cluster}<br>Average score: ${d.score.toFixed(2)}`,
        event
      );
    })
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip)
    .transition()
    .duration(800)
    .delay((d, i) => i * 50)
    .attr("width", d => x(d.score) - margin.left);

  // Labels
  svg.selectAll(".bar-label")
    .data(allRanked)
    .join("text")
    .attr("x", margin.left - 8)
    .attr("y", d => y(d.name) + y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "end")
    .attr("font-size", 12)
    .attr("fill", "#444")
    .text(d => d.name);

  // Score values
  svg.selectAll(".bar-score")
    .data(allRanked)
    .join("text")
    .attr("y", d => y(d.name) + y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .attr("font-size", 12)
    .attr("fill", "#999")
    .attr("opacity", 0)
    .transition()
    .duration(800)
    .delay((d, i) => i * 50 + 400)
    .attr("opacity", 1)
    .attr("x", d => x(d.score) + 6)
    .tween("text", function(d) {
      const node = this;
      const i = d3.interpolateNumber(0, d.score);
      return function(t) { node.textContent = i(t).toFixed(1); };
    });

  // Cluster legend below chart
  const legendDiv = document.createElement("div");
  legendDiv.className = "vocab-legend";
  chartDiv.appendChild(legendDiv);
  for (const [name, data] of Object.entries(THEME_CLUSTERS)) {
    legendDiv.innerHTML += `<span class="vocab-legend-item"><span class="cat-dot" style="background:${data.color}"></span>${name}</span>`;
  }
}
