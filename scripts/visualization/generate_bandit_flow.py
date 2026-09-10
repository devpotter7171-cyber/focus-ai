import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import matplotlib.patches as mpatches

# IEEE Style Configuration
plt.rcParams.update({
    'font.family': 'serif',
    'font.serif': ['Times New Roman'],
    'font.size': 8,
    'figure.figsize': (3.5, 9),  # IEEE single column width
})

fig, ax = plt.subplots()
ax.set_xlim(0, 7)
ax.set_ylim(0, 18)
ax.set_aspect('equal')
ax.axis('off')

# === GRID CONSTANTS ===
CENTER_X = 3.5
BOX_W = 5
BOX_H = 1.0
SMALL_H = 0.7
GAP = 0.6

# Y positions (top to bottom)
Y_POS = [16.5, 14.8, 12.8, 11.0, 9.2, 7.0, 5.0, 3.2, 1.5]

# === HELPER FUNCTIONS ===
def draw_box(cx, cy, w, h, title, sublabels=None, bold=True):
    x = cx - w/2
    y = cy - h/2
    box = FancyBboxPatch((x, y), w, h,
                         boxstyle="round,pad=0.02,rounding_size=0.1",
                         facecolor='white', edgecolor='black', linewidth=1)
    ax.add_patch(box)
    
    if sublabels:
        ax.text(cx, cy + 0.15, title, ha='center', va='center',
                fontsize=8, fontweight='bold' if bold else 'normal')
        sub_text = "  |  ".join(sublabels)
        ax.text(cx, cy - 0.2, sub_text, ha='center', va='center', fontsize=6)
    else:
        ax.text(cx, cy, title, ha='center', va='center',
                fontsize=8, fontweight='bold' if bold else 'normal')

def draw_diamond(cx, cy, size, label):
    """Draw a decision diamond"""
    verts = [(cx, cy + size), (cx + size, cy), (cx, cy - size), (cx - size, cy), (cx, cy + size)]
    diamond = mpatches.Polygon(verts, closed=True, facecolor='white', edgecolor='black', lw=1)
    ax.add_patch(diamond)
    ax.text(cx, cy, label, ha='center', va='center', fontsize=7, fontweight='bold')

def arrow_down(x, y1, y2):
    ax.annotate('', xy=(x, y2), xytext=(x, y1),
                arrowprops=dict(arrowstyle='->', color='black', lw=1))

# === DRAW FLOW COMPONENTS ===

# 1. Behavioral Features
draw_box(CENTER_X, Y_POS[0], BOX_W, BOX_H, "Behavioral Features",
         ["hesitation", "scroll depth", "tab switches"])
arrow_down(CENTER_X, Y_POS[0] - BOX_H/2, Y_POS[1] + BOX_H/2)

# 2. Confusion Score
draw_box(CENTER_X, Y_POS[1], BOX_W, BOX_H, "Confusion Score Estimation",
         ["XGBoost Classifier"])
arrow_down(CENTER_X, Y_POS[1] - BOX_H/2, Y_POS[2] + BOX_H/2)

# 3. Learner State
draw_box(CENTER_X, Y_POS[2], BOX_W, BOX_H, "Learner State",
         ["Knowledge Mastery (DKT)", "Learner Profile"])
arrow_down(CENTER_X, Y_POS[2] - BOX_H/2, Y_POS[3] + SMALL_H/2)

# 4. Context Vector
draw_box(CENTER_X, Y_POS[3], BOX_W - 1, SMALL_H, "Context Vector Construction")
arrow_down(CENTER_X, Y_POS[3] - SMALL_H/2, Y_POS[4] + BOX_H/2)

# 5. LinUCB Scoring
draw_box(CENTER_X, Y_POS[4], BOX_W, BOX_H, "LinUCB Scoring",
         ["Scores all intervention arms"])
arrow_down(CENTER_X, Y_POS[4] - BOX_H/2, Y_POS[5] + 1.0)

# 6. Arm Selection (wider box with arms)
draw_box(CENTER_X, Y_POS[5], BOX_W + 0.5, 1.4, "Arm Selection",
         ["visual | example | step-by-step | easier | harder"])
arrow_down(CENTER_X, Y_POS[5] - 0.7, Y_POS[6] + BOX_H/2)

# 7. Explanation Generation
draw_box(CENTER_X, Y_POS[6], BOX_W - 0.5, BOX_H, "Explanation Generation",
         ['"Why this content?"'])
arrow_down(CENTER_X, Y_POS[6] - BOX_H/2, Y_POS[7] + SMALL_H/2)

# 8. Adaptive Content Display
draw_box(CENTER_X, Y_POS[7], BOX_W - 1, SMALL_H, "Adaptive Content Display")
arrow_down(CENTER_X, Y_POS[7] - SMALL_H/2, Y_POS[8] + BOX_H/2)

# 9. Reward Logging
draw_box(CENTER_X, Y_POS[8], BOX_W, BOX_H, "Reward Logging",
         ["Stored for offline evaluation"])

# === FEEDBACK LOOP ARROW ===
# From Reward Logging back to LinUCB (left side)
LOOP_X = 0.4
ax.plot([CENTER_X - BOX_W/2, LOOP_X], [Y_POS[8], Y_POS[8]], 'k-', lw=1)  # Left from reward
ax.plot([LOOP_X, LOOP_X], [Y_POS[8], Y_POS[4]], 'k-', lw=1)  # Up to LinUCB level
ax.annotate('', xy=(CENTER_X - BOX_W/2, Y_POS[4]), xytext=(LOOP_X, Y_POS[4]),
            arrowprops=dict(arrowstyle='->', color='black', lw=1))

# Feedback label
ax.text(LOOP_X + 0.15, (Y_POS[8] + Y_POS[4])/2, "Update", fontsize=6, rotation=90, va='center')

# === TITLE ===
ax.text(CENTER_X, 17.7, "Contextual Bandit Decision Flow", ha='center', va='center',
        fontsize=10, fontweight='bold')

plt.tight_layout()
plt.savefig('backend/exports/bandit_flow.pdf', format='pdf',
            dpi=300, bbox_inches='tight', facecolor='white')
print("Saved: backend/exports/bandit_flow.pdf")
