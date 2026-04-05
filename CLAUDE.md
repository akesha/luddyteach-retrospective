# LuddyTeach Retrospective

Data-driven interactive retrospective of the LuddyTeach blog — 77 posts analyzed through six analytical methods.

## Deployment

- **Live URL:** https://akesha.github.io/luddyteach-retrospective/
- **GitHub Pages** deployed via GitHub Actions on push to `main`

## Folder Structure

```
luddyteach-retrospective/
├── index.html              # Single-page site with all sections
├── css/style.css           # All styles (typography, layout, responsive)
├── js/
│   ├── utils.js            # Shared colors, tooltip, data loading
│   ├── hero.js             # Counter animations
│   ├── themes.js           # Horizontal bar chart (D3)
│   ├── streamgraph.js      # Streamgraph visualization (D3)
│   ├── pca.js              # PCA scatter plot (D3)
│   ├── correlations.js     # Correlation heatmap (D3)
│   ├── novelty.js          # Lollipop chart (D3)
│   └── main.js             # IntersectionObserver for scroll-triggered rendering
├── data/                   # Generated JSON (from analysis pipeline)
│   ├── posts.json          # 77 posts with metadata and plain text
│   ├── theme_scores.json   # 77 × 15 scoring matrix
│   ├── pca.json            # 2D PCA coordinates
│   ├── correlations.json   # 15 × 15 correlation matrix
│   ├── novelty.json        # Per-post novelty scores
│   ├── streamgraph.json    # Time-binned category data
│   └── stats.json          # Aggregate stats for hero
├── analysis/               # Python analysis pipeline (run locally)
│   ├── extract_posts.py    # Parse TS files + fetch WP dates
│   ├── analyze.py          # Score, PCA, correlations, novelty
│   ├── dictionaries.json   # 15 keyword dictionaries
│   └── requirements.txt    # pandas, scikit-learn, etc.
└── .github/workflows/pages.yml
```

## Regenerating Data

1. Ensure cs-faculty-hub repo is cloned at `/tmp/cs-faculty-hub/`
2. `pip install -r analysis/requirements.txt`
3. `python3 analysis/extract_posts.py` — extracts posts, fetches WP dates
4. `python3 analysis/analyze.py` — runs all analysis, outputs JSON to `data/`

## Design

- Typography: Cormorant Garamond (headings) + Inter (body)
- Color palette: Tableau 10 (colorblind-safe)
- Visualizations: D3.js v7
- Analysis: Python (pandas, scikit-learn, scipy)
