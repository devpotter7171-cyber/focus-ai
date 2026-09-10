# Focus-AI Project Demo Script

## 1. The "Elevator Pitch" (Introduction)
**"Good morning/afternoon. This is Focus-AI, an adaptive learning platform that solves the biggest problem in online education: the 'One-Size-Fits-All' approach. unlike standard LMS platforms that just host static PDFs, Focus-AI actually watches how a student learns in real-time and adapts the content to their specific needs, just like a human tutor would."**

---

## 2. Live Demo Walkthrough (Step-by-Step)

### Step 1: The "Student" Experience & Focus Tools
*   **Action:** Open a Lesson (e.g., Unit 1: Relational Model).
*   **Say:** "Here we have a standard lesson. But we've built in accessibility tools natively."
*   **Demo:** Open the "Focus Tools" menu. Toggle **Bionic Reading** (explain how it helps reading speed) and **Focus Mode** (dimming distractions).
*   **Why it matters:** "We lower the barrier to entry for neurodiverse learners immediately."

### Step 2: The "Hidden" AI (Behavior Tracking) **[CORE USP]**
*   **Say:** "This is where we differ from everyone else. Most platforms only know if you got a question Right or Wrong. We track the *struggle*."
*   **Action (The "Confused Student" Persona):** 
    1.  Start a Quiz.
    2.  **Do NOT click an answer immediately.**
    3.  Move your mouse toward a *wrong* option, hover over it for a second, then move away. Do this twice.
    4.  Switch tabs (simulate looking up an answer) and come back.
    5.  Wait about 10-15 seconds.
*   **Say:** "The system is currently tracking my 'digital body language'. It sees I'm hesitating, switching tabs, and considering wrong answers."

### Step 3: Real-Time Adaptation (Contextual Bandits)
*   **Action:** Submit the wrong answer or finally submit.
*   **Observation:** Watch for the **"Adaptive Content Active"** badge or toast notification appearing.
*   **Say:** "Because the AI detected I was confused based on my behavior, it didn't just give me the answer. It triggered an intervention. It might switch the explanation style to an **Analogy** or a **Visual** explanation automatically."
*   **Technical Note:** "This uses a **LinUCB Contextual Bandit** model. It learns which explanation style works best for *me* specifically."

### Step 4: Long-Term Profiling (Cognitive Profiler)
*   **Say:** "As I use the platform more, it builds a profile."
*   **Explain:** "It classifies users as 'Skimmers', 'Deep Readers', or 'Strugglers'. If I'm a 'Skimmer', it might start showing me shorter, bullet-point summaries. If I'm a 'Struggler', it provides more scaffolded, step-by-step guides."

---

## 3. Technical Architecture (For the "Tech" Questions)

If the faculty asks **"How does it work?"**:

1.  **Frontend (Next.js + React):** captures raw signals (mouse velocity, hover time, scroll depth, tab focus).
2.  **Behavior Engine:** Streams this data to our Python backend in real-time.
3.  **ML Inference Service (FastAPI):**
    *   **Confusion Model (XGBoost):** Predicts `P(Confused | Behavior)`.
    *   **Recommendation Agent (LinUCB):** Decides the best teaching strategy.
    *   **Knowledge Tracing (DKT):** Updates the student's mastery graph.
4.  **Database (Firebase):** Stores the interaction logs and user profiles.

---

## 4. Potential Faculty Viva Questions

**Q: isn't this just checking if time > 1 minute?**
**A:** "No. We use a multi-variate approach. We combine hesitation time, specific wrong-answer hovering (indecision), tab switching (distraction), and scroll depth. A student who takes 1 minute because they are reading carefully is different from a student who takes 1 minute because they are tab-switching and freezing."

**Q: How does the AI learn?**
**A:** "We use Reinforcement Learning. If the AI suggests a 'Visual' explanation and the student subsequently gets the next question right, the model gets a 'Reward'. If they fail again, the model learns that 'Visual' wasn't effective for this student in this context."

**Q: What is the novelty here?**
**A:** "The novelty is **Implicit Feedback**. We don't ask 'Are you confused?'. We infer it from digital body language, allowing for seamless, non-intrusive adaptation."
