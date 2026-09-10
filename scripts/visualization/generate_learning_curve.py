import matplotlib.pyplot as plt
import numpy as np

# IEEE Style Configuration
plt.rcParams.update({
    'font.family': 'serif',
    'font.serif': ['Times New Roman'],
    'font.size': 9,
    'figure.figsize': (3.5, 2.5),
})

fig, ax = plt.subplots()

# Sessions (1-5)
sessions = np.arange(1, 6)

# Simulated learning scores over sessions
# Adaptive group shows steeper improvement
np.random.seed(42)
adaptive_scores = [0.45, 0.58, 0.68, 0.76, 0.82]
control_scores = [0.44, 0.51, 0.55, 0.58, 0.61]

adaptive_err = [0.08, 0.07, 0.06, 0.05, 0.05]
control_err = [0.09, 0.08, 0.08, 0.07, 0.07]

# Plot with error bands
ax.errorbar(sessions, adaptive_scores, yerr=adaptive_err, 
            marker='o', color='black', linestyle='-', 
            label='Adaptive', capsize=3, markersize=5)
ax.errorbar(sessions, control_scores, yerr=control_err, 
            marker='s', color='gray', linestyle='--', 
            label='Control', capsize=3, markersize=5)

ax.set_xlabel('Session')
ax.set_ylabel('Performance Score')
ax.set_title('Learning Curve Across Sessions', fontweight='bold')
ax.set_xticks(sessions)
ax.set_ylim(0.3, 1.0)
ax.legend(loc='lower right', framealpha=0.9)
ax.grid(True, linestyle=':', alpha=0.5)

plt.tight_layout()
plt.savefig('docs/figures/learning_curve.pdf', format='pdf', dpi=300, bbox_inches='tight')
print("Saved: docs/figures/learning_curve.pdf")
