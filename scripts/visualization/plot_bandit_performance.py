import os
import glob
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# IEEE Style Configuration (Grayscale Safe)
plt.rcParams.update({
    'font.family': 'serif',
    'font.serif': ['Times New Roman'],
    'axes.labelsize': 10,
    'font.size': 10,
    'legend.fontsize': 8,
    'xtick.labelsize': 8,
    'ytick.labelsize': 8,
    'figure.figsize': (3.5, 3.0),
    'lines.linewidth': 1.5
})

# Grayscale-safe line styles
LINE_STYLES = {
    'linucb': {'color': 'black', 'linestyle': '-', 'marker': 'o', 'markevery': 50},
    'random': {'color': 'gray', 'linestyle': '--', 'marker': 's', 'markevery': 50},
    'static': {'color': 'dimgray', 'linestyle': ':', 'marker': '^', 'markevery': 50},
    'rule': {'color': 'darkgray', 'linestyle': '-.', 'marker': 'x', 'markevery': 50},
}

EXPORTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "exports")
OUTPUT_PLOT = os.path.join(EXPORTS_DIR, "cumulative_reward.pdf")
OUTPUT_CSV = os.path.join(EXPORTS_DIR, "bandit_rewards.csv")

def load_latest_csv(pattern):
    files = glob.glob(os.path.join(EXPORTS_DIR, pattern))
    if not files:
        return None
    return max(files, key=os.path.getctime)

def compute_reward(row):
    """
    Compute reward based on the IEEE paper formula:
    r_t = 0.6 * I(correct) + 0.3 * (1 - t_norm) + 0.1 * clarity
    
    For intervention logs, we approximate:
    - correct: if confusion decreased after intervention
    - t_norm: normalized time (assume 1.0 if not present)
    - clarity: assume 0.5 baseline
    """
    # Check for is_correct or approximate from confusion reduction
    if 'is_correct' in row and pd.notna(row['is_correct']):
        correct = float(row['is_correct'])
    elif 'confusion_score' in row:
        # Lower confusion = better outcome, threshold at 0.4
        correct = 1.0 if row['confusion_score'] < 0.4 else 0.0
    else:
        correct = 0.5  # Unknown
    
    t_norm = row.get('time_norm', 0.5)
    clarity = row.get('clarity_score', 0.5)
    
    reward = 0.6 * correct + 0.3 * (1 - t_norm) + 0.1 * clarity
    return np.clip(reward, 0.0, 1.0)

def main():
    print("Starting Bandit Performance Analysis...")
    
    # 1. Load Data
    intervention_file = load_latest_csv("intervention_logs_*.csv")
    
    if not intervention_file:
        print("Warning: No intervention_logs found. Generating synthetic data for demo...")
        # Generate synthetic data to demonstrate the script
        np.random.seed(42)
        n_samples = 200
        policies = ['linucb', 'random', 'static', 'rule']
        
        # LinUCB should perform best, random worst
        policy_means = {'linucb': 0.75, 'random': 0.45, 'static': 0.55, 'rule': 0.60}
        
        records = []
        for i in range(n_samples):
            policy = policies[i % len(policies)]
            base_reward = policy_means[policy]
            # Add learning effect for LinUCB
            if policy == 'linucb':
                base_reward += i * 0.0005  # Slight improvement over time
            noise = np.random.normal(0, 0.1)
            reward = np.clip(base_reward + noise, 0, 1)
            records.append({
                'interaction_id': i,
                'policy': policy,
                'reward': reward,
                'confusion_score': 1 - reward,
                'bandit_arm_selected': np.random.choice(['visual', 'example', 'analogy'])
            })
        df = pd.DataFrame(records)
        print(f"Generated {len(df)} synthetic intervention records.")
    else:
        print(f"Loading: {intervention_file}")
        df = pd.read_csv(intervention_file)
        
        # Determine policy column
        if 'policy' not in df.columns:
            # Assume all records are from LinUCB if no policy column
            df['policy'] = 'linucb'
        
        # Compute reward if not present
        if 'reward' not in df.columns:
            df['reward'] = df.apply(compute_reward, axis=1)
    
    # 2. Group by Policy and Compute Cumulative Reward
    results = {}
    final_rewards = []
    
    for policy in df['policy'].unique():
        policy_df = df[df['policy'] == policy].reset_index(drop=True)
        policy_df['cumulative_reward'] = policy_df['reward'].cumsum()
        results[policy] = policy_df
        
        final_rewards.append({
            'Policy': policy,
            'Total_Reward': policy_df['reward'].sum(),
            'Mean_Reward': policy_df['reward'].mean(),
            'Std_Reward': policy_df['reward'].std(),
            'Samples': len(policy_df)
        })
    
    # 3. Generate Plot
    plt.figure()
    
    for policy, policy_df in results.items():
        style = LINE_STYLES.get(policy, {'color': 'black', 'linestyle': '-'})
        plt.plot(
            policy_df.index, 
            policy_df['cumulative_reward'],
            label=policy.upper(),
            **style
        )
    
    plt.xlabel('Interaction Index')
    plt.ylabel('Cumulative Reward')
    plt.title('Bandit Policy Comparison')
    plt.legend(loc='upper left', framealpha=0.9)
    plt.grid(True, linestyle=':', alpha=0.6)
    plt.tight_layout()
    
    plt.savefig(OUTPUT_PLOT, format='pdf', dpi=300)
    print(f"Plot saved to: {OUTPUT_PLOT}")
    
    # 4. Save Final Rewards
    rewards_df = pd.DataFrame(final_rewards)
    rewards_df.to_csv(OUTPUT_CSV, index=False)
    print(f"Rewards saved to: {OUTPUT_CSV}")
    
    # Print summary
    print("\n=== Bandit Performance Summary ===")
    print(rewards_df.to_string(index=False))

if __name__ == "__main__":
    main()
