#!/usr/bin/env python3
"""Extract blog posts from cs-faculty-hub TypeScript files and match with WordPress dates."""

import re
import json
import os
import requests
from thefuzz import fuzz

REPO_DATA = "/tmp/cs-faculty-hub/src/data"
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
WP_API = "https://blogs.iu.edu/luddyteach/wp-json/wp/v2/posts"

BATCH_FILES = [
    ("articles.ts", "base"),
    ("articles-batch2.ts", "batch2"),
    ("articles-batch3.ts", "batch3"),
    ("articles-batch4.ts", "batch4"),
    ("articles-batch5.ts", "batch5"),
    ("articles-batch6.ts", "batch6"),
]


def parse_ts_file(filepath, batch_name):
    """Parse a TypeScript file and extract post objects."""
    with open(filepath, "r", encoding="utf-8") as f:
        text = f.read()

    posts = []

    # Split on object boundaries - each post starts with { and id:
    # Use regex to find each object block with content
    pattern = r'\{\s*id:\s*"([^"]+)"'
    id_positions = [(m.group(1), m.start()) for m in re.finditer(pattern, text)]

    for i, (post_id, start) in enumerate(id_positions):
        # Find the end of this object - look for the next object start or end of array
        if i + 1 < len(id_positions):
            end = id_positions[i + 1][1]
        else:
            end = len(text)

        block = text[start:end]

        # Extract fields
        title_m = re.search(r'title:\s*"([^"]*(?:\\.[^"]*)*)"', block)
        summary_m = re.search(r'summary:\s*"([^"]*(?:\\.[^"]*)*)"', block)
        category_m = re.search(r'category:\s*"([^"]+)"', block)
        readtime_m = re.search(r'readTime:\s*"([^"]+)"', block)

        # Extract content from template literal
        content_m = re.search(r'content:\s*`(.*?)`', block, re.DOTALL)

        if not title_m:
            continue

        title = title_m.group(1).replace('\\"', '"').replace("\\'", "'")
        summary = summary_m.group(1).replace('\\"', '"') if summary_m else ""
        category = category_m.group(1) if category_m else "Unknown"
        read_time = readtime_m.group(1) if readtime_m else ""
        content = content_m.group(1) if content_m else ""

        posts.append({
            "id": post_id,
            "title": title,
            "summary": summary,
            "category": category,
            "read_time": read_time,
            "content_markdown": content.strip(),
            "batch": batch_name,
        })

    return posts


def strip_markdown(text):
    """Convert markdown to plain text for analysis."""
    # Remove headers
    text = re.sub(r'#{1,6}\s+', '', text)
    # Remove bold/italic
    text = re.sub(r'\*{1,3}([^*]+)\*{1,3}', r'\1', text)
    # Remove links but keep text
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    # Remove images
    text = re.sub(r'!\[([^\]]*)\]\([^)]+\)', r'\1', text)
    # Remove blockquotes
    text = re.sub(r'^>\s*', '', text, flags=re.MULTILINE)
    # Remove table formatting
    text = re.sub(r'\|', ' ', text)
    text = re.sub(r'-{3,}', '', text)
    # Remove code blocks
    text = re.sub(r'```.*?```', '', text, flags=re.DOTALL)
    text = re.sub(r'`([^`]+)`', r'\1', text)
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Collapse whitespace
    text = re.sub(r'\n{2,}', '\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()


def fetch_wp_posts():
    """Fetch all posts from the WordPress API."""
    all_posts = []
    for page in range(1, 20):  # Up to 20 pages
        try:
            resp = requests.get(WP_API, params={
                "per_page": 100,
                "_fields": "id,date,title,slug",
                "page": page,
            }, timeout=15)
            if resp.status_code != 200:
                break
            posts = resp.json()
            if not posts:
                break
            all_posts.extend(posts)
        except Exception as e:
            print(f"  WP API page {page} failed: {e}")
            break
    return all_posts


def match_dates(repo_posts, wp_posts):
    """Fuzzy-match repo posts to WP posts to get dates."""
    wp_titles = [(p["title"]["rendered"], p["date"], p["slug"]) for p in wp_posts]
    matched = 0
    for post in repo_posts:
        best_score = 0
        best_date = None
        # Try slug match first
        for wp_title, wp_date, wp_slug in wp_titles:
            slug_score = fuzz.ratio(post["id"].replace("-", ""), wp_slug.replace("-", ""))
            if slug_score > 85:
                best_score = slug_score
                best_date = wp_date
                break

        # Fall back to title matching
        if best_score < 70:
            for wp_title, wp_date, wp_slug in wp_titles:
                score = fuzz.token_sort_ratio(post["title"].lower(), wp_title.lower())
                if score > best_score:
                    best_score = score
                    best_date = wp_date

        if best_score >= 65 and best_date:
            post["date"] = best_date[:10]  # ISO date only
            post["match_score"] = best_score
            matched += 1
        else:
            post["date"] = None
            post["match_score"] = best_score

    print(f"  Matched {matched}/{len(repo_posts)} posts to WP dates")
    return repo_posts


def estimate_missing_dates(posts):
    """Estimate dates for posts that couldn't be matched to WP."""
    dated = [p for p in posts if p.get("date")]
    undated = [p for p in posts if not p.get("date")]

    if not undated:
        return posts

    # Spread posts across a realistic timeline based on batch + position
    # The blog ran from ~Jan 2025 to ~Apr 2026 based on content references
    import datetime
    batch_start = {
        "base": "2025-01-10",
        "batch2": "2025-03-01",
        "batch3": "2025-05-15",
        "batch4": "2025-08-01",
        "batch5": "2025-10-15",
        "batch6": "2026-01-15",
    }

    # Group undated by batch
    by_batch = {}
    for post in undated:
        by_batch.setdefault(post["batch"], []).append(post)

    for batch, batch_posts in by_batch.items():
        start = datetime.date.fromisoformat(batch_start.get(batch, "2025-01-01"))
        for i, post in enumerate(batch_posts):
            post["date"] = (start + datetime.timedelta(days=i * 7)).isoformat()
            post["date_estimated"] = True

    print(f"  Estimated dates for {len(undated)} posts")
    return posts


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Step 1: Parse all TS files
    print("Parsing TypeScript files...")
    all_posts = []
    seen_ids = {}
    for filename, batch_name in BATCH_FILES:
        filepath = os.path.join(REPO_DATA, filename)
        if not os.path.exists(filepath):
            print(f"  Skipping {filename} (not found)")
            continue
        posts = parse_ts_file(filepath, batch_name)
        print(f"  {filename}: {len(posts)} posts")

        # Handle duplicate IDs
        for post in posts:
            if post["id"] in seen_ids:
                post["id"] = f"{post['id']}-{batch_name}"
            seen_ids[post["id"]] = True

        all_posts.extend(posts)

    print(f"\nTotal posts extracted: {len(all_posts)}")

    # Step 2: Process content
    print("\nProcessing content...")
    for post in all_posts:
        plain = strip_markdown(post["content_markdown"])
        # Include summary in analysis text
        post["content_plain"] = f"{post['summary']} {plain}"
        post["word_count"] = len(post["content_plain"].split())

    total_words = sum(p["word_count"] for p in all_posts)
    print(f"  Total words: {total_words:,}")
    print(f"  Average: {total_words // len(all_posts)} words/post")

    # Step 3: Fetch WP dates
    print("\nFetching WordPress dates...")
    wp_posts = fetch_wp_posts()
    print(f"  Found {len(wp_posts)} WP posts")

    if wp_posts:
        all_posts = match_dates(all_posts, wp_posts)
        all_posts = estimate_missing_dates(all_posts)
    else:
        print("  WP API unavailable, using batch ordering for dates")
        all_posts = estimate_missing_dates(all_posts)

    # Sort by date
    all_posts.sort(key=lambda p: p.get("date") or "9999")

    # Step 4: Output
    output = []
    for post in all_posts:
        output.append({
            "id": post["id"],
            "title": post["title"],
            "summary": post["summary"],
            "category": post["category"],
            "date": post["date"],
            "date_estimated": post.get("date_estimated", False),
            "read_time": post["read_time"],
            "word_count": post["word_count"],
            "content_plain": post["content_plain"],
            "batch": post["batch"],
        })

    outpath = os.path.join(OUTPUT_DIR, "posts.json")
    with open(outpath, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\nWrote {len(output)} posts to {outpath}")

    # Category distribution
    cats = {}
    for p in output:
        cats[p["category"]] = cats.get(p["category"], 0) + 1
    print("\nCategory distribution:")
    for cat, count in sorted(cats.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count}")

    # Date range
    dates = [p["date"] for p in output if p["date"]]
    if dates:
        print(f"\nDate range: {min(dates)} to {max(dates)}")


if __name__ == "__main__":
    main()
