"""
═══════════════════════════════════════════════════════════════════════
 WORKSHOP — EXECUTIVE-GRADE VISUALIZATION LAYERS (Plotly)
═══════════════════════════════════════════════════════════════════════
 Mapped to the student's cleaned_dataset.parquet schema:
   department (VARCHAR) · agency (VARCHAR) · amount (DECIMAL)
   category (VARCHAR)   · region (VARCHAR)

 Each layer exports a Plotly JSON payload → ./charts/<name>.json
 These JSON files are consumed directly by the Next.js/React frontend
 (see the Vercel snippet in each section of the workshop guide).

 Run:  python executive_charts.py
 Deps: pip install plotly pandas duckdb
═══════════════════════════════════════════════════════════════════════
"""

import os
import json
import duckdb
import plotly.express as px
import plotly.graph_objects as go

DATASET = os.path.join(os.path.dirname(__file__), "cleaned_dataset.parquet")
OUT_DIR = os.path.join(os.path.dirname(__file__), "charts")
os.makedirs(OUT_DIR, exist_ok=True)

# Corporate palette (WCAG AA on white)
NAVY = "#1E3A8A"
TEAL = "#0F766E"
SLATE = "#475569"
AMBER = "#B45309"
PALETTE = [NAVY, TEAL, SLATE, AMBER, "#7C3AED", "#BE123C", "#0369A1"]

con = duckdb.connect()


def peso(v: float) -> str:
    """Human-readable PHP abbreviation."""
    if v >= 1e12: return f"₱{v/1e12:.2f}T"
    if v >= 1e9:  return f"₱{v/1e9:.2f}B"
    if v >= 1e6:  return f"₱{v/1e6:.1f}M"
    if v >= 1e3:  return f"₱{v/1e3:.0f}K"
    return f"₱{v:,.0f}"


def save(fig: go.Figure, name: str):
    """Export a chart as Plotly JSON for the web frontend."""
    path = os.path.join(OUT_DIR, f"{name}.json")
    with open(path, "w") as f:
        f.write(fig.to_json())
    print(f"  ✓ {name}.json")


# ─── LAYER 1: TOP ALLOCATIONS (Horizontal Bar) ─────────────────────────
def layer1_top_allocations():
    df = con.execute(f"""
        SELECT department, SUM(amount) AS total
        FROM '{DATASET}'
        GROUP BY department
        ORDER BY total DESC
        LIMIT 10
    """).df()

    # Highlight the #1 performer in Teal, the rest in Navy
    colors = [TEAL if i == 0 else NAVY for i in range(len(df))]

    fig = px.bar(
        df.sort_values("total"),  # ascending so largest sits on top
        x="total", y="department", orientation="h",
        text=[peso(v) for v in df.sort_values("total")["total"]],
    )
    fig.update_traces(marker_color=colors[::-1], textposition="outside",
                      hovertemplate="<b>%{y}</b><br>%{text}<extra></extra>")
    fig.update_layout(
        title="Top Departments by Allocation",
        xaxis_title="Allocation (₱)", yaxis_title=None,
        plot_bgcolor="white", font_family="Inter, system-ui",
        margin=dict(l=100, r=80, t=50, b=40),
    )
    save(fig, "layer1_top_allocations")


# ─── LAYER 2: COMPOSITION & SHARE (Donut) ──────────────────────────────
def layer2_composition():
    df = con.execute(f"""
        SELECT category, SUM(amount) AS total
        FROM '{DATASET}'
        GROUP BY category
        ORDER BY total DESC
    """).df()
    grand_total = df["total"].sum()

    fig = go.Figure(go.Pie(
        labels=df["category"], values=df["total"], hole=0.55,
        marker=dict(colors=PALETTE, line=dict(color="white", width=2)),
        textinfo="label+percent",
        hovertemplate="<b>%{label}</b><br>%{value:,.0f} (%{percent})<extra></extra>",
    ))
    fig.update_layout(
        title="Budget Composition by Expense Category",
        annotations=[dict(text=f"{peso(grand_total)}<br>Total",
                          x=0.5, y=0.5, font_size=18, showarrow=False)],
        showlegend=False, font_family="Inter, system-ui",
    )
    save(fig, "layer2_composition")


# ─── LAYER 3: SPATIAL / REGIONAL CONCENTRATION ─────────────────────────
def layer3_regional():
    df = con.execute(f"""
        SELECT region, SUM(amount) AS total
        FROM '{DATASET}'
        GROUP BY region
        ORDER BY total DESC
    """).df()

    # Structured spatial breakdown bar (choropleth needs a matching GeoJSON;
    # for arbitrary student regions a ranked bar is the safe, honest default).
    fig = px.bar(df, x="region", y="total",
                 color="total", color_continuous_scale=["#E0F2F1", TEAL, NAVY])
    fig.update_traces(hovertemplate="<b>%{x}</b><br>₱%{y:,.0f}<extra></extra>")
    fig.update_layout(
        title="Regional Concentration of Allocations",
        xaxis_title=None, yaxis_title="Allocation (₱)",
        coloraxis_showscale=False, plot_bgcolor="white",
        font_family="Inter, system-ui",
    )
    save(fig, "layer3_regional")


# ─── LAYER 4: EXCEPTION / PRIORITY DRILL-DOWN ──────────────────────────
def layer4_priority():
    # Executive exception focus: Capital Outlays (discretionary/high-impact)
    df = con.execute(f"""
        SELECT agency, SUM(amount) AS total
        FROM '{DATASET}'
        WHERE category = 'Capital Outlays'
        GROUP BY agency
        ORDER BY total DESC
        LIMIT 10
    """).df()

    fig = px.bar(df.sort_values("total"), x="total", y="agency", orientation="h",
                 text=[peso(v) for v in df.sort_values("total")["total"]])
    fig.update_traces(marker_color=AMBER, textposition="outside",
                      hovertemplate="<b>%{y}</b><br>%{text}<extra></extra>")
    fig.update_layout(
        title="Priority Focus — Capital Outlays by Agency",
        xaxis_title="Capital Outlay (₱)", yaxis_title=None,
        plot_bgcolor="white", font_family="Inter, system-ui",
        margin=dict(l=160, r=80, t=50, b=40),
    )
    save(fig, "layer4_priority")


# ─── LAYER 5: EXECUTIVE MACRO INSIGHT (Narrative) ──────────────────────
def layer5_macro_brief():
    rows = con.execute(f"""
        SELECT department, SUM(amount) AS total
        FROM '{DATASET}'
        GROUP BY department ORDER BY total DESC
    """).df()
    total = rows["total"].sum()
    top = rows.iloc[0]
    bottom = rows.iloc[-1]
    top_pct = top["total"] / total * 100
    ratio = top["total"] / bottom["total"]

    brief = (
        f"The portfolio totals {peso(total)} across {len(rows)} departments, "
        f"but {top['department']} alone commands {top_pct:.1f}% — a sign of "
        f"structural concentration at the top. "
        f"The gap between the largest ({top['department']}) and smallest "
        f"({bottom['department']}) allocation is {ratio:.0f}×, revealing steep "
        f"tier disparity. "
        f"Leadership should validate whether this concentration reflects "
        f"strategic priority or an execution bottleneck before the next cycle."
    )
    with open(os.path.join(OUT_DIR, "layer5_brief.json"), "w") as f:
        json.dump({"executive_brief": brief}, f, indent=2)
    print("  ✓ layer5_brief.json")
    print("\n  EXECUTIVE BRIEF:\n  " + brief.replace(". ", ".\n  "))


if __name__ == "__main__":
    print("Generating executive chart payloads...\n")
    layer1_top_allocations()
    layer2_composition()
    layer3_regional()
    layer4_priority()
    layer5_macro_brief()
    print(f"\nDone. JSON payloads written to: {OUT_DIR}/")
