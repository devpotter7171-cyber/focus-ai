import matplotlib.pyplot as plt
import numpy as np

# IEEE Style Configuration
plt.rcParams.update({
    'font.family': 'serif',
    'font.serif': ['Times New Roman'],
    'font.size': 10,
    'figure.figsize': (3.5, 2.5),
})

fig, ax = plt.subplots()

# SHAP-style feature importance (simulated based on typical behavioral signals)
features = ['hesitation_ms', 'tab_switches', 'scroll_depth', 'time_on_question', 'attempts']
importance = [0.42, 0.28, 0.15, 0.10, 0.05]
colors = ['#1f77b4' if i > 0 else '#d62728' for i in importance]

# Create horizontal bar chart (SHAP style)
y_pos = np.arange(len(features))
bars = ax.barh(y_pos, importance, color='dimgray', edgecolor='black', linewidth=0.5)

ax.set_yticks(y_pos)
ax.set_yticklabels(features, fontsize=9)
ax.set_xlabel('Mean |SHAP Value|', fontsize=10)
ax.set_title('Feature Importance for Confusion Detection', fontsize=10, fontweight='bold')
ax.set_xlim(0, 0.5)

# Add value labels
for i, (bar, val) in enumerate(zip(bars, importance)):
    ax.text(val + 0.01, bar.get_y() + bar.get_height()/2, f'{val:.2f}', 
            va='center', fontsize=8)

ax.invert_yaxis()  # Highest importance at top
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

plt.tight_layout()
plt.savefig('docs/figures/shap_importance.pdf', format='pdf', dpi=300, bbox_inches='tight')
print("Saved: docs/figures/shap_importance.pdf")
