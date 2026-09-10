"""
Generate the LLM model-routing / cost-efficiency figure.

Two-panel figure:
  (a) Token distribution across the tiered fallback chain (free vs paid).
  (b) Cost comparison: hybrid free-first routing vs an all-paid baseline.

Output: research/figures/model_routing.pdf
"""
import matplotlib.pyplot as plt
import numpy as np

plt.rcParams.update({
    'font.family': 'serif',
    'font.serif': ['Times New Roman'],
    'font.size': 9,
    'figure.figsize': (7.0, 2.6),  # double-column width
})

fig, (ax1, ax2) = plt.subplots(1, 2)

# ─── Panel (a): token share across model tiers ───────────────────────────────
# Representative distribution over a simulated day of traffic.
tiers = ["Tier 1\n(Fast/Free)", "Tier 2\n(Balanced/Free)",
         "Tier 3\n(Premium/Free)", "Tier 4\n(Paid\nFallback)"]
share = [62, 24, 11, 3]  # percent of requests served at each tier
colors = ["#1a1a1a", "#4d4d4d", "#808080", "#bfbfbf"]

bars = ax1.bar(range(len(tiers)), share, color=colors, edgecolor="black", linewidth=0.6)
ax1.set_xticks(range(len(tiers)))
ax1.set_xticklabels(tiers, fontsize=7)
ax1.set_ylabel("Requests Served (%)")
ax1.set_title("(a) Fallback Tier Utilization", fontweight="bold", fontsize=9)
ax1.set_ylim(0, 75)
for b, v in zip(bars, share):
    ax1.text(b.get_x() + b.get_width() / 2, v + 1.5, f"{v}%",
             ha="center", va="bottom", fontsize=7.5, fontweight="bold")
ax1.grid(True, axis="y", linestyle=":", alpha=0.5)

# ─── Panel (b): cost comparison ───────────────────────────────────────────────
# Per 10k interactions, ~250 tokens each. All-paid uses Gemini Flash Lite price.
scenarios = ["All-Paid\nBaseline", "Hybrid\n(Free-First)"]
cost = [0.84, 0.03]  # USD per 10k interactions (illustrative)
bars2 = ax2.bar(scenarios, cost, color=["#808080", "#1a1a1a"],
                edgecolor="black", linewidth=0.6, width=0.55)
ax2.set_ylabel("Cost / 10k interactions (USD)")
ax2.set_title("(b) Inference Cost", fontweight="bold", fontsize=9)
ax2.set_ylim(0, 1.0)
for b, v in zip(bars2, cost):
    ax2.text(b.get_x() + b.get_width() / 2, v + 0.02, f"${v:.2f}",
             ha="center", va="bottom", fontsize=8, fontweight="bold")
# Annotate the saving
ax2.annotate("96% lower",
             xy=(1, 0.03), xytext=(0.75, 0.55),
             fontsize=8, fontweight="bold",
             arrowprops=dict(arrowstyle="->", lw=0.8))
ax2.grid(True, axis="y", linestyle=":", alpha=0.5)

plt.tight_layout()
plt.savefig("research/figures/model_routing.pdf", format="pdf", dpi=300, bbox_inches="tight")
print("Saved: research/figures/model_routing.pdf")
