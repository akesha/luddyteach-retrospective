#!/usr/bin/env python3
"""Analyze LuddyTeach posts: scoring, PCA, correlations, novelty, streamgraph."""

import json
import os
import math
import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics.pairwise import cosine_distances
from scipy import stats

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")


def load_data():
    with open(os.path.join(DATA_DIR, "posts.json"), "r") as f:
        posts = json.load(f)
    with open(os.path.join(os.path.dirname(__file__), "dictionaries.json"), "r") as f:
        dictionaries = json.load(f)
    return posts, dictionaries


def score_posts(posts, dictionaries):
    """Score each post against all dictionaries using TF-IDF-like weighting."""
    themes = list(dictionaries.keys())
    n_posts = len(posts)

    # Compute document frequency for each term
    doc_freq = {}
    for theme, terms in dictionaries.items():
        for term in terms:
            count = sum(1 for p in posts if term.lower() in p["content_plain"].lower())
            doc_freq[term] = count

    # Score each post
    matrix = np.zeros((n_posts, len(themes)))
    for i, post in enumerate(posts):
        text = post["content_plain"].lower()
        word_count = max(post["word_count"], 1)
        for j, theme in enumerate(themes):
            score = 0
            for term in dictionaries[theme]:
                term_lower = term.lower()
                # Count occurrences
                tf = text.count(term_lower)
                if tf > 0:
                    # IDF weighting: log(N / df)
                    df = max(doc_freq.get(term, 1), 1)
                    idf = math.log(n_posts / df)
                    score += (tf / word_count * 100) * idf
            matrix[i, j] = score

    return matrix, themes


def run_pca(matrix, posts, themes):
    """Run PCA on z-scored theme matrix with clustering."""
    scaler = StandardScaler()
    z_scored = scaler.fit_transform(matrix)

    pca = PCA(n_components=2)
    coords = pca.fit_transform(z_scored)

    # Cluster posts into 4 groups (like SLL's Landscape/Vision/Enablers/Dynamics)
    kmeans = KMeans(n_clusters=4, random_state=42, n_init=10)
    clusters = kmeans.fit_predict(z_scored)

    # Name clusters by their dominant themes
    cluster_names = []
    for c in range(4):
        mask = clusters == c
        mean_scores = matrix[mask].mean(axis=0)
        top_themes = mean_scores.argsort()[::-1][:2]
        name = " & ".join(themes[t].replace("_", " ").title() for t in top_themes)
        cluster_names.append(name)

    # Compute cluster centroids in PCA space for region labels
    cluster_centroids = []
    for c in range(4):
        mask = clusters == c
        cx = float(coords[mask, 0].mean())
        cy = float(coords[mask, 1].mean())
        cluster_centroids.append({"x": round(cx, 2), "y": round(cy, 2), "name": cluster_names[c]})

    # Get loadings for axis labels
    loadings = pd.DataFrame(
        pca.components_.T,
        columns=["PC1", "PC2"],
        index=themes
    )
    pc1_top = loadings["PC1"].abs().nlargest(3).index.tolist()
    pc2_top = loadings["PC2"].abs().nlargest(3).index.tolist()

    result = {
        "explained_variance": [round(v * 100, 1) for v in pca.explained_variance_ratio_],
        "pc1_label": " / ".join(t.replace("_", " ").title() for t in pc1_top),
        "pc2_label": " / ".join(t.replace("_", " ").title() for t in pc2_top),
        "clusters": [{"name": cluster_names[i], "centroid": cluster_centroids[i]} for i in range(4)],
        "points": []
    }

    for i, post in enumerate(posts):
        # Get top 3 and bottom 2 theme scores for "WHY HERE?" panel
        scores = matrix[i]
        sorted_idx = scores.argsort()[::-1]
        top_themes = [{"name": themes[j].replace("_", " ").title(), "score": round(float(scores[j]), 2)} for j in sorted_idx[:3]]
        low_themes = [{"name": themes[j].replace("_", " ").title(), "score": round(float(scores[j]), 2)} for j in sorted_idx[-2:]]

        result["points"].append({
            "id": post["id"],
            "title": post["title"],
            "summary": post["summary"],
            "category": post["category"],
            "cluster": int(clusters[i]),
            "clusterName": cluster_names[int(clusters[i])],
            "x": round(float(coords[i, 0]), 4),
            "y": round(float(coords[i, 1]), 4),
            "date": post["date"],
            "topThemes": top_themes,
            "lowThemes": low_themes,
        })

    return result, z_scored


def compute_correlations(matrix, themes):
    """Compute correlations and generate network graph data."""
    n_themes = len(themes)
    theme_names = [t.replace("_", " ").title() for t in themes]

    corr_matrix = np.corrcoef(matrix.T)

    # Compute connection count per theme (how many significant links)
    connections = {t: 0 for t in theme_names}

    # Build edges (links) for network graph
    links = []
    alliances = []
    rivalries = []
    for i in range(n_themes):
        for j in range(i + 1, n_themes):
            r = float(corr_matrix[i, j])
            n = matrix.shape[0]
            t_stat = r * math.sqrt((n - 2) / (1 - r**2 + 1e-10))
            p_value = 2 * (1 - stats.t.cdf(abs(t_stat), n - 2))
            if abs(r) > 0.15:
                link_type = "alliance" if r > 0 else "rivalry"
                links.append({
                    "source": theme_names[i],
                    "target": theme_names[j],
                    "r": round(r, 3),
                    "type": link_type,
                })
                connections[theme_names[i]] += 1
                connections[theme_names[j]] += 1
                if link_type == "alliance":
                    alliances.append({"pair": f"{theme_names[i]} & {theme_names[j]}", "r": round(r, 3)})
                else:
                    rivalries.append({"pair": f"{theme_names[i]} & {theme_names[j]}", "r": round(r, 3)})

    alliances.sort(key=lambda x: -x["r"])
    rivalries.sort(key=lambda x: x["r"])

    # Build nodes
    nodes = []
    for i, name in enumerate(theme_names):
        # Mean score across all posts for sizing
        mean_score = float(matrix[:, i].mean())
        nodes.append({
            "id": name,
            "connections": connections[name],
            "meanScore": round(mean_score, 3),
        })

    n_alliances = len(alliances)
    n_rivalries = len(rivalries)

    result = {
        "themes": theme_names,
        "matrix": [[round(float(corr_matrix[i, j]), 3) for j in range(n_themes)] for i in range(n_themes)],
        "nodes": nodes,
        "links": links,
        "alliances": alliances[:5],
        "rivalries": rivalries[:5],
        "summary": f"{len(links)} connections ({n_alliances} alliances, {n_rivalries} rivalries)",
        "significant_pairs": alliances[:3] + rivalries[:3],
    }
    return result


def compute_novelty(z_scored, posts, matrix, themes):
    """Compute novelty score for each post with theme breakdown."""
    centroid = z_scored.mean(axis=0)
    centroid_dists = np.sqrt(((z_scored - centroid) ** 2).sum(axis=1))
    cos_dist_matrix = cosine_distances(z_scored)
    mean_cos_dists = cos_dist_matrix.mean(axis=1)

    def normalize(arr):
        mn, mx = arr.min(), arr.max()
        return np.zeros_like(arr) if mx == mn else (arr - mn) / (mx - mn)

    novelty = (normalize(centroid_dists) + normalize(mean_cos_dists)) / 2

    # Sort by date for temporal ordering
    dated = [(i, posts[i]) for i in range(len(posts)) if posts[i].get("date")]
    dated.sort(key=lambda x: x[1]["date"])

    result = []
    for i, post in enumerate(posts):
        # Get top themes for this post
        scores = matrix[i]
        sorted_idx = scores.argsort()[::-1]
        top = [{"name": themes[j].replace("_", " ").title(), "score": round(float(scores[j]), 2)} for j in sorted_idx[:3] if scores[j] > 0]

        result.append({
            "id": post["id"],
            "title": post["title"],
            "summary": post["summary"],
            "category": post["category"],
            "novelty": round(float(novelty[i]), 4),
            "date": post["date"],
            "topThemes": top,
        })

    result.sort(key=lambda x: -x["novelty"])
    return result


def compute_entropy(matrix, posts, themes):
    """Compute Shannon entropy for each post — measures thematic breadth."""
    n_themes = len(themes)
    max_entropy = math.log2(n_themes)

    result = []
    for i, post in enumerate(posts):
        scores = matrix[i]
        # Normalize to probability distribution
        total = scores.sum()
        if total == 0:
            entropy = 0
        else:
            probs = scores / total
            entropy = 0
            for p in probs:
                if p > 0:
                    entropy -= p * math.log2(p)

        # Normalize to 0-1
        norm_entropy = entropy / max_entropy if max_entropy > 0 else 0

        # Dominant theme
        dominant_idx = scores.argmax()
        dominant = themes[dominant_idx].replace("_", " ").title()

        result.append({
            "id": post["id"],
            "title": post["title"],
            "category": post["category"],
            "entropy": round(float(norm_entropy), 4),
            "dominant": dominant,
            "date": post["date"],
        })

    return result


def generate_streamgraph(posts):
    """Generate time-binned category data for streamgraph."""
    categories = sorted(set(p["category"] for p in posts))

    # Bin by bi-month for better granularity
    bins = {}
    for post in posts:
        if not post["date"]:
            continue
        year = post["date"][:4]
        month = int(post["date"][5:7])
        bimonth = (month - 1) // 2
        month_labels = ["Jan-Feb", "Mar-Apr", "May-Jun", "Jul-Aug", "Sep-Oct", "Nov-Dec"]
        period = f"{year} {month_labels[bimonth]}"
        bins.setdefault(period, {cat: 0 for cat in categories})
        bins[period][post["category"]] += 1

    # Sort chronologically
    periods = sorted(bins.keys())
    result = []
    for period in periods:
        entry = {"period": period}
        entry.update(bins[period])
        result.append(entry)

    return {"categories": categories, "data": result}


def generate_stats(posts, matrix, themes):
    """Generate summary statistics for the hero section."""
    total_words = sum(p["word_count"] for p in posts)
    dates = [p["date"] for p in posts if p["date"]]
    categories = set(p["category"] for p in posts)

    # Top themes by average score
    avg_scores = matrix.mean(axis=0)
    top_theme_idx = avg_scores.argsort()[::-1][:3]

    return {
        "total_posts": len(posts),
        "total_words": total_words,
        "num_categories": len(categories),
        "date_range": {
            "start": min(dates) if dates else None,
            "end": max(dates) if dates else None,
        },
        "avg_word_count": total_words // len(posts),
        "categories": {p["category"]: 0 for p in posts},
        "top_cross_cutting_themes": [
            themes[i].replace("_", " ").title() for i in top_theme_idx
        ],
    }


def main():
    print("Loading data...")
    posts, dictionaries = load_data()
    print(f"  {len(posts)} posts, {len(dictionaries)} dictionaries")

    print("Scoring posts...")
    matrix, themes = score_posts(posts, dictionaries)
    print(f"  Matrix shape: {matrix.shape}")

    # Save theme scores
    theme_scores = {
        "themes": [t.replace("_", " ").title() for t in themes],
        "posts": []
    }
    for i, post in enumerate(posts):
        entry = {"id": post["id"], "title": post["title"], "category": post["category"]}
        for j, theme in enumerate(themes):
            entry[theme] = round(float(matrix[i, j]), 4)
        theme_scores["posts"].append(entry)

    with open(os.path.join(DATA_DIR, "theme_scores.json"), "w") as f:
        json.dump(theme_scores, f, indent=2)
    print("  Saved theme_scores.json")

    print("Running PCA...")
    pca_result, z_scored = run_pca(matrix, posts, themes)
    with open(os.path.join(DATA_DIR, "pca.json"), "w") as f:
        json.dump(pca_result, f, indent=2)
    print(f"  Explained variance: {pca_result['explained_variance']}")
    print("  Saved pca.json")

    print("Computing correlations...")
    corr_result = compute_correlations(matrix, themes)
    with open(os.path.join(DATA_DIR, "correlations.json"), "w") as f:
        json.dump(corr_result, f, indent=2)
    print(f"  {len(corr_result['significant_pairs'])} significant pairs")
    print("  Saved correlations.json")

    print("Computing novelty...")
    novelty_result = compute_novelty(z_scored, posts, matrix, themes)
    with open(os.path.join(DATA_DIR, "novelty.json"), "w") as f:
        json.dump(novelty_result, f, indent=2)
    print(f"  Most novel: {novelty_result[0]['title'][:50]}...")
    print("  Saved novelty.json")

    print("Computing entropy...")
    entropy_result = compute_entropy(matrix, posts, themes)
    with open(os.path.join(DATA_DIR, "entropy.json"), "w") as f:
        json.dump(entropy_result, f, indent=2)
    avg_entropy = sum(e["entropy"] for e in entropy_result) / len(entropy_result)
    print(f"  Mean entropy: {avg_entropy:.3f}")
    print("  Saved entropy.json")

    print("Generating streamgraph data...")
    stream_result = generate_streamgraph(posts)
    with open(os.path.join(DATA_DIR, "streamgraph.json"), "w") as f:
        json.dump(stream_result, f, indent=2)
    print(f"  {len(stream_result['data'])} time periods")
    print("  Saved streamgraph.json")

    print("Generating stats...")
    stats_result = generate_stats(posts, matrix, themes)
    # Fix category counts
    for p in posts:
        stats_result["categories"][p["category"]] += 1
    with open(os.path.join(DATA_DIR, "stats.json"), "w") as f:
        json.dump(stats_result, f, indent=2)
    print("  Saved stats.json")

    print("\nDone! All data files in:", DATA_DIR)


if __name__ == "__main__":
    main()
