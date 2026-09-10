import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

# IEEE Style - Larger text for print readability
plt.rcParams.update({
    'font.family': 'serif',
    'font.serif': ['Times New Roman'],
    'font.size': 11,
    'figure.figsize': (7.5, 9.5),
})

fig, ax = plt.subplots()
ax.set_xlim(0, 15)
ax.set_ylim(0, 17)
ax.set_aspect('equal')
ax.axis('off')

# === GRID CONSTANTS (more padding) ===
LEFT_COL = 4.2
RIGHT_COL = 10.8
CENTER = 7.5
BOX_W = 5.0
BOX_H = 2.0
SMALL_H = 1.5

# Row positions (increased spacing)
ROW1_Y = 14.5
ROW2_Y = 11.5
ROW3_Y = 8.0
ROW4_Y = 4.8
ROW5_Y = 1.8

def draw_box(cx, cy, w, h, title, sublabels=None):
    x = cx - w/2
    y = cy - h/2
    box = FancyBboxPatch((x, y), w, h,
                         boxstyle="round,pad=0.03,rounding_size=0.15",
                         facecolor='white', edgecolor='black', linewidth=1.5)
    ax.add_patch(box)
    
    if sublabels:
        ax.text(cx, cy + 0.25, title, ha='center', va='center',
                fontsize=12, fontweight='bold')
        sub_text = "  •  ".join(sublabels)
        ax.text(cx, cy - 0.35, sub_text, ha='center', va='center', fontsize=9)
    else:
        ax.text(cx, cy, title, ha='center', va='center',
                fontsize=12, fontweight='bold')

def arrow_v(x, y1, y2):
    ax.annotate('', xy=(x, y2), xytext=(x, y1),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

# === DRAW COMPONENTS ===

# Row 1: Frontend
draw_box(CENTER, ROW1_Y, BOX_W, BOX_H, "Frontend",
         ["Event Tracker", "Feedback UI"])

# Row 2: Backend
draw_box(CENTER, ROW2_Y, BOX_W, BOX_H, "Backend API",
         ["Ingestion", "Normalization"])

# Row 3: ML + Decision
draw_box(LEFT_COL, ROW3_Y, BOX_W, BOX_H, "ML Services",
         ["Confusion Model", "DKT"])

draw_box(RIGHT_COL, ROW3_Y, BOX_W, BOX_H, "Decision Layer",
         ["LinUCB Bandit", "Explainability"])

# Row 4: Content
draw_box(CENTER, ROW4_Y, BOX_W, SMALL_H, "Adaptive Content")

# Row 5: Storage
draw_box(CENTER, ROW5_Y, 6.5, BOX_H, "Firestore Storage",
         ["Logs", "Assessments"])

# === ARROWS ===

# Frontend -> Backend
arrow_v(CENTER, ROW1_Y - BOX_H/2, ROW2_Y + BOX_H/2)

# Backend -> ML (L-shaped)
ax.plot([CENTER, CENTER], [ROW2_Y - BOX_H/2, ROW3_Y + 1.3], 'k-', lw=1.5)
ax.plot([CENTER, LEFT_COL], [ROW3_Y + 1.3, ROW3_Y + 1.3], 'k-', lw=1.5)
ax.annotate('', xy=(LEFT_COL, ROW3_Y + BOX_H/2), xytext=(LEFT_COL, ROW3_Y + 1.3),
            arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

# ML -> Decision (horizontal)
ax.annotate('', xy=(RIGHT_COL - BOX_W/2, ROW3_Y), xytext=(LEFT_COL + BOX_W/2, ROW3_Y),
            arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

# Decision -> Content (L-shaped)
ax.plot([RIGHT_COL, RIGHT_COL], [ROW3_Y - BOX_H/2, ROW4_Y + 0.4], 'k-', lw=1.5)
ax.plot([RIGHT_COL, CENTER + BOX_W/2], [ROW4_Y + 0.4, ROW4_Y + 0.4], 'k-', lw=1.5)
ax.annotate('', xy=(CENTER + BOX_W/2, ROW4_Y), xytext=(CENTER + BOX_W/2, ROW4_Y + 0.4),
            arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

# Content -> Frontend (feedback loop)
LOOP_X = 13.5
ax.plot([CENTER + BOX_W/2, LOOP_X], [ROW4_Y, ROW4_Y], 'k-', lw=1.5)
ax.plot([LOOP_X, LOOP_X], [ROW4_Y, ROW1_Y], 'k-', lw=1.5)
ax.annotate('', xy=(CENTER + BOX_W/2, ROW1_Y), xytext=(LOOP_X, ROW1_Y),
            arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

# Storage arrows (simplified - one from center)
arrow_v(CENTER, ROW4_Y - SMALL_H/2, ROW5_Y + BOX_H/2)

# Side arrows to storage
ax.plot([LEFT_COL, LEFT_COL], [ROW3_Y - BOX_H/2, ROW5_Y + 1.3], 'k-', lw=1.2)
ax.plot([LEFT_COL, CENTER - 2.5], [ROW5_Y + 1.3, ROW5_Y + 1.3], 'k-', lw=1.2)
ax.annotate('', xy=(CENTER - 2.5, ROW5_Y + BOX_H/2), xytext=(CENTER - 2.5, ROW5_Y + 1.3),
            arrowprops=dict(arrowstyle='->', color='black', lw=1.2))

ax.plot([RIGHT_COL + 0.3, RIGHT_COL + 0.3], [ROW3_Y - BOX_H/2, ROW5_Y + 1.3], 'k-', lw=1.2)
ax.plot([RIGHT_COL + 0.3, CENTER + 2.5], [ROW5_Y + 1.3, ROW5_Y + 1.3], 'k-', lw=1.2)
ax.annotate('', xy=(CENTER + 2.5, ROW5_Y + BOX_H/2), xytext=(CENTER + 2.5, ROW5_Y + 1.3),
            arrowprops=dict(arrowstyle='->', color='black', lw=1.2))

# Title
ax.text(CENTER, 16.3, "Focus-AI System Architecture", ha='center', va='center',
        fontsize=14, fontweight='bold')

plt.tight_layout()
plt.savefig('docs/figures/system_architecture.pdf', format='pdf',
            dpi=300, bbox_inches='tight', facecolor='white')
print("Saved: docs/figures/system_architecture.pdf")
