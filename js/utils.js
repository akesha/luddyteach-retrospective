/* Shared utilities */

const COLORS = {
  "AI & Technology": "#4E79A7",
  "Teaching Strategies": "#F28E2B",
  "Assessment & Feedback": "#E15759",
  "Student Engagement": "#76B7B2",
  "Course Design": "#59A14F",
  "Inclusion & Accessibility": "#EDC948",
  "Faculty Wellbeing": "#B07AA1",
};

const tooltip = document.getElementById("tooltip");

function showTooltip(html, event) {
  tooltip.innerHTML = html;
  tooltip.classList.add("active");
  positionTooltip(event);
}

function moveTooltip(event) {
  positionTooltip(event);
}

function hideTooltip() {
  tooltip.classList.remove("active");
}

function positionTooltip(event) {
  const pad = 12;
  let x = event.clientX + pad;
  let y = event.clientY + pad;
  const rect = tooltip.getBoundingClientRect();
  if (x + rect.width > window.innerWidth - pad) x = event.clientX - rect.width - pad;
  if (y + rect.height > window.innerHeight - pad) y = event.clientY - rect.height - pad;
  tooltip.style.left = x + "px";
  tooltip.style.top = y + "px";
}

function catColor(category) {
  return COLORS[category] || "#999";
}

function catDot(category) {
  return `<span class="cat-dot" style="background:${catColor(category)}"></span>`;
}

async function loadJSON(path) {
  const resp = await fetch(path);
  return resp.json();
}
