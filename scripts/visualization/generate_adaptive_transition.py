"""
Generate the adaptive content-level transition figure.

Shows how a learner's quiz score maps to an immediate content-level shift,
illustrating the closed-loop "score -> difficulty" adaptation. A heatmap of
the post-quiz transition matrix (current level x score band -> new level).

Output: research/figures/adaptive_transition.pdf
"""
import matplotlib.pyplot as plt
import numpy as np

plt.rcParams.update({
    'font.family': 'serif',
    'font.serif': ['Times New Roman'],
    'font.size': 9,
    'figure.figsize': (3.5, 2.8),
})

# Rows = current level (1=Expert ... 5=Analogy)
# Cols = score band
# Cell = new level after applying calculate_post_quiz_level()
score_bands = ["0%", "<33%", "33-66%", "67-99%", "100%"]
levels = ["L1", "L2", "L3", "L4", "L5"]


def post_quiz_level(score_pct, current):
    if score_pct == 0:
        nl = min(5, current + 2)
    elif score_pct < 33:
        nl = min(5, current + 1)
    elif score_pct <= 66:
        nl = current
    elif score_pct < 100:
        nl = max(1, current - 1)
    else:
        nl = max(1, current - 2)
    return nl


band_values = [0, 20, 50, 80, 100]
matrix = np.zeros((5, 5), dtype=int)
for r, cur in enumerate(range(1, 6)):
    for c, sp in enumerate(band_values):
        matrix[r, c] = post_quiz_level(sp, cur)

fig, ax = plt.subplots()
im = ax.imshow(matrix, cmap="Greys", aspect="auto", vmin=1, vmax=5)

ax.set_xticks(range(5))
ax.set_xticklabels(score_bands, fontsize=7.5)
ax.set_yticks(range(5))
ax.set_yticklabels(levels, fontsize=8)
ax.set_xlabel("Quiz Score Band")
ax.set_ylabel("Current Level")
ax.set_title("Post-Quiz Level Transition", fontweight="bold", fontsize=9)

# Annotate each cell with the resulting level
for r in range(5):
    for c in range(5):
        val = matrix[r, c]
        # Pick contrasting text colour
        txt_color = "white" if val >= 4 else "black"
        ax.text(c, r, f"L{val}", ha="center", va="center",
                fontsize=7.5, fontweight="bold", color=txt_color)

cbar = fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04, ticks=[1, 2, 3, 4, 5])
cbar.ax.set_ylabel("New Level", rotation=90, fontsize=7.5)
cbar.ax.tick_params(labelsize=7)

plt.tight_layout()
plt.savefig("research/figures/adaptive_transition.pdf", format="pdf", dpi=300, bbox_inches="tight")
print("Saved: research/figures/adaptive_transition.pdf")
