import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch

# IEEE Style Configuration
plt.rcParams.update({
    'font.family': 'serif',
    'font.serif': ['Times New Roman'],
    'font.size': 9,
    'figure.figsize': (7, 10),
})

fig, ax = plt.subplots()
ax.set_xlim(0, 14)
ax.set_ylim(0, 16)
ax.set_aspect('equal')
ax.axis('off')

# === GRID LAYOUT CONSTANTS ===
# Column centers
LEFT_COL = 4
RIGHT_COL = 10
CENTER = 7

# Row Y positions (top to bottom)
ROW1_Y = 13.5  # Frontend
ROW2_Y = 11.0  # Backend
ROW3_Y = 8.0   # ML Services / Decision Layer
ROW4_Y = 5.0   # Content Delivery
ROW5_Y = 2.0   # Storage

# Box dimensions
BOX_W = 4.5
BOX_H = 1.8
SMALL_H = 1.4

# === HELPER FUNCTIONS ===
def draw_box(cx, cy, w, h, title, sublabels=None):
    """Draw a box centered at (cx, cy)"""
    x = cx - w/2
    y = cy - h/2
    box = FancyBboxPatch((x, y), w, h, 
                         boxstyle="round,pad=0.02,rounding_size=0.15",
                         facecolor='white', edgecolor='black', linewidth=1.2)
    ax.add_patch(box)
    
    if sublabels:
        ax.text(cx, cy + h/2 - 0.3, title, ha='center', va='top', 
                fontsize=10, fontweight='bold')
        for i, sub in enumerate(sublabels):
            ax.text(cx, cy + h/2 - 0.65 - i*0.35, f"• {sub}", 
                    ha='center', va='top', fontsize=8)
    else:
        ax.text(cx, cy, title, ha='center', va='center', 
                fontsize=10, fontweight='bold')
    return x, y, w, h

def arrow_v(x, y1, y2):
    """Vertical arrow from y1 to y2 at x"""
    ax.annotate('', xy=(x, y2), xytext=(x, y1),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.2))

def arrow_h(x1, x2, y):
    """Horizontal arrow from x1 to x2 at y"""
    ax.annotate('', xy=(x2, y), xytext=(x1, y),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.2))

def arrow_L(x1, y1, x2, y2, corner_x=None, corner_y=None):
    """L-shaped orthogonal arrow (two segments)"""
    if corner_x is not None:
        # Horizontal then vertical
        ax.plot([x1, corner_x], [y1, y1], 'k-', lw=1.2)
        ax.annotate('', xy=(corner_x, y2), xytext=(corner_x, y1),
                    arrowprops=dict(arrowstyle='->', color='black', lw=1.2))
    elif corner_y is not None:
        # Vertical then horizontal
        ax.plot([x1, x1], [y1, corner_y], 'k-', lw=1.2)
        ax.annotate('', xy=(x2, corner_y), xytext=(x1, corner_y),
                    arrowprops=dict(arrowstyle='->', color='black', lw=1.2))

# === DRAW COMPONENTS ===

# Row 1: Frontend
draw_box(CENTER, ROW1_Y, BOX_W, BOX_H, "Frontend",
         ["Behavioral Event Tracker", "Confusion Feedback Button"])

# Row 2: Backend
draw_box(CENTER, ROW2_Y, BOX_W, BOX_H, "Backend API",
         ["Event Ingestion", "Feature Normalization", "Session Management"])

# Row 3: ML Services (left) + Decision Layer (right)
draw_box(LEFT_COL, ROW3_Y, BOX_W, BOX_H, "ML Services",
         ["Confusion Detection", "Knowledge Tracing", "Context Builder"])

draw_box(RIGHT_COL, ROW3_Y, BOX_W, BOX_H, "Decision Layer",
         ["Contextual Bandit", "Explainability Module"])

# Row 4: Content Delivery
draw_box(CENTER, ROW4_Y, BOX_W, SMALL_H, "Content Delivery",
         ["Adaptive Learning Content"])

# Row 5: Storage
draw_box(CENTER, ROW5_Y, 6, BOX_H, "Storage (Firestore)",
         ["behavior_logs    intervention_logs", "user_feedback    learning_assessment"])

# === DRAW ARROWS ===

# Frontend -> Backend (vertical, center)
arrow_v(CENTER, ROW1_Y - BOX_H/2, ROW2_Y + BOX_H/2)

# Backend -> ML Services (L-shaped: down then left)
ax.plot([CENTER, CENTER], [ROW2_Y - BOX_H/2, ROW3_Y + 1.2], 'k-', lw=1.2)
ax.plot([CENTER, LEFT_COL], [ROW3_Y + 1.2, ROW3_Y + 1.2], 'k-', lw=1.2)
ax.annotate('', xy=(LEFT_COL, ROW3_Y + BOX_H/2), xytext=(LEFT_COL, ROW3_Y + 1.2),
            arrowprops=dict(arrowstyle='->', color='black', lw=1.2))

# ML Services -> Decision Layer (horizontal)
arrow_h(LEFT_COL + BOX_W/2, RIGHT_COL - BOX_W/2, ROW3_Y)

# Decision Layer -> Content Delivery (L-shaped: down then left)
ax.plot([RIGHT_COL, RIGHT_COL], [ROW3_Y - BOX_H/2, ROW4_Y + 0.3], 'k-', lw=1.2)
ax.plot([RIGHT_COL, CENTER + BOX_W/2], [ROW4_Y + 0.3, ROW4_Y + 0.3], 'k-', lw=1.2)
ax.annotate('', xy=(CENTER + BOX_W/2, ROW4_Y), xytext=(CENTER + BOX_W/2, ROW4_Y + 0.3),
            arrowprops=dict(arrowstyle='->', color='black', lw=1.2))

# Content Delivery -> Frontend (feedback loop on RIGHT side)
LOOP_X = 12.5
ax.plot([CENTER + BOX_W/2, LOOP_X], [ROW4_Y, ROW4_Y], 'k-', lw=1.2)  # Horizontal right
ax.plot([LOOP_X, LOOP_X], [ROW4_Y, ROW1_Y], 'k-', lw=1.2)  # Vertical up
ax.annotate('', xy=(CENTER + BOX_W/2, ROW1_Y), xytext=(LOOP_X, ROW1_Y),
            arrowprops=dict(arrowstyle='->', color='black', lw=1.2))  # Horizontal left to Frontend

# ML Services -> Storage (vertical)
arrow_v(LEFT_COL, ROW3_Y - BOX_H/2, ROW5_Y + BOX_H/2 + 0.5)
ax.plot([LEFT_COL, CENTER - 2], [ROW5_Y + BOX_H/2 + 0.5, ROW5_Y + BOX_H/2 + 0.5], 'k-', lw=1.2)
ax.annotate('', xy=(CENTER - 2, ROW5_Y + BOX_H/2), xytext=(CENTER - 2, ROW5_Y + BOX_H/2 + 0.5),
            arrowprops=dict(arrowstyle='->', color='black', lw=1.2))

# Content Delivery -> Storage (vertical, center)
arrow_v(CENTER, ROW4_Y - SMALL_H/2, ROW5_Y + BOX_H/2)

# Decision Layer -> Storage (orthogonal path)
ax.plot([RIGHT_COL + 0.5, RIGHT_COL + 0.5], [ROW3_Y - BOX_H/2, ROW5_Y + BOX_H/2 + 0.5], 'k-', lw=1.2)
ax.plot([RIGHT_COL + 0.5, CENTER + 2], [ROW5_Y + BOX_H/2 + 0.5, ROW5_Y + BOX_H/2 + 0.5], 'k-', lw=1.2)
ax.annotate('', xy=(CENTER + 2, ROW5_Y + BOX_H/2), xytext=(CENTER + 2, ROW5_Y + BOX_H/2 + 0.5),
            arrowprops=dict(arrowstyle='->', color='black', lw=1.2))

# === TITLE ===
ax.text(CENTER, 15.5, "Focus-AI System Architecture", ha='center', va='center',
        fontsize=12, fontweight='bold')

plt.tight_layout()
plt.savefig('backend/exports/system_architecture.pdf', format='pdf', 
            dpi=300, bbox_inches='tight', facecolor='white')
print("Saved: backend/exports/system_architecture.pdf")
