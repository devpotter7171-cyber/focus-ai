
"""
DEMO CONTENT FOR FOCUS-AI (5-LEVEL ADAPTATION ARRAY)
This file contains hand-crafted content variations for the 'Normalization' and 'SQL Intro' modules.
These variations map to the 5-Level Difficulty Matrix:

| Level | Name              | Pedagogical Focus              | Previous Key Mapping |
| :---  | :---              | :---                           | :--- |
| **1** | **Standard**      | Formal, Textbook Definition    | (New / Default) |
| **2** | **Elaborative**   | Detailed, Descriptive          | 'step-by-step', 'visual' |
| **3** | **Simplified**    | Plain English, Low Jargon      | 'easier' |
| **4** | **Concrete**      | Mechanics, "How-to", Examples  | 'example', 'concrete' |
| **5** | **Analogy**       | Stories, Real-world Metaphors  | 'analogy', 'illustration' |
"""

DEMO_VARIATIONS = {
    # Target Subtopic: Normal Forms (2NF Focus)
    "normal-forms-1nf-3nf": {
        1: """
# Second Normal Form (2NF) - Standard Definition

### Formal Definition
A relation is in **Second Normal Form (2NF)** if and only if:
1.  It is already in First Normal Form (1NF).
2.  Every non-prime attribute is **fully functionally dependent** on the primary key.

### Key Concepts
*   **Full Functional Dependency**: An attribute $Y$ depends on the *entire* primary key $X$, not just a subset of $X$.
*   **Partial Dependency**: If a table has a composite primary key (e.g., $A, B$), and a non-key attribute $C$ depends only on $A$ (i.e., $A \rightarrow C$), this is a partial dependency and violates 2NF.

### Violation Example
Consider a relation `Enrolment(Student_ID, Course_ID, Student_Name, Grade)`.
*   **Key**: `{Student_ID, Course_ID}`
*   **Anomaly**: `Student_Name` depends only on `Student_ID`.
*   **Resolution**: Decompose into `Student(Student_ID, Student_Name)` and `Enrolment(Student_ID, Course_ID, Grade)`.
""",
        
        2: """
# Second Normal Form (2NF) - Visual Explanation

### The Core Problem: Partial Dependency
Imagine a table structure where some data only depends on *part* of the key. This creates redundancy.

```text
[ Composite Key ] ----------> [ Value ]
(Student_ID, Course_ID)       (Grade)
      |
      +-----> (Student_Name)  <-- WAIT! 
                                  Name depends ONLY on Student_ID
```
**Wait!** `Student_Name` only depends on `Student_ID`, not the specific course. This is a **Partial Dependency** (a 2NF violation).

### The Solution: Decomposition
We must break the table to ensure every attribute is fully dependent on its table's key.

1.  **Table 1 (Students):** `[ Student_ID ]` ---> `[ Student_Name ]`
2.  **Table 2 (Enrollment):** `[ Student_ID + Course_ID ]` ---> `[ Grade ]`

Now, every non-key attribute depends on the *entire* primary key of its respective table.
""",
        
        3: """
# Second Normal Form (2NF) - Simplified

### What is it?
Don't worry about the complex terms for a moment.
**Rule of Thumb:** "Every column should describe the *whole* key, not just a *part* of it."

### The "Two-Part ID" Check
If your table has a "Two-Part ID" (like a receipt having an **Order ID** and a **Product ID**), make sure that every other column relates to **both** parts combined.

*   **Grade?** Relates to *Student* + *Class*. (Good - keep it!)
*   **Student's Age?** Relates only to *Student*. (Bad - Move it to a separate "Students" table!)
*   **Course Name?** Relates only to *Course*. (Bad - Move it to a separate "Courses" table!)

That's it. That is 2NF. Separate the "Part-dependent" stuff into their own tables.
""",

        4: """
# 2NF: Concrete SQL Implementation

Let's look at the raw SQL code to see the difference.

### ❌ The Bad Table (Violates 2NF)
```sql
CREATE TABLE Student_Grades (
    student_id INT,
    course_id VARCHAR(10),
    student_name VARCHAR(100), -- PROBLEM: Depends ONLY on student_id!
    grade CHAR(1),
    PRIMARY KEY (student_id, course_id)
);
```
*Why is this bad?* If we delete the last course a student took, we delete the student's name from the database too!

### ✅ The Good Tables (In 2NF)
We isolate the data so it lives where it belongs.

```sql
-- 1. The Student Entity (Attributes depend on Student_ID)
CREATE TABLE Students (
    student_id INT PRIMARY KEY,
    student_name VARCHAR(100)
);

-- 2. The Relationship (Attributes depend on BOTH IDs)
CREATE TABLE Enrollments (
    student_id INT,
    course_id VARCHAR(10),
    grade CHAR(1),
    PRIMARY KEY (student_id, course_id),
    FOREIGN KEY (student_id) REFERENCES Students(student_id)
);
```
Now `student_name` is safer and stored only once.
""",

        5: """
# 2NF: The "Restaurant Menu" Analogy

Think of a **Restaurant Order Ticket**.
On one ticket (the "table"), you write:
*   **Order #:** 101
*   **Dish:** Burger
*   **Price:** $12
*   **Customer:** Alice

If you define the unique key as `(Order #, Dish)`, there's a weird problem.
*   The **Customer (Alice)** is tied to the Order #, not the specific burger.
*   The **Price ($12)** is tied to the Dish, not who ordered it.

### Why is this messy?
If Alice orders 5 items, you have to write "Alice" 5 times. If the price of a Burger changes, you have to update it on every past order ticket.

### The Fix (2NF) is "Ordering"
Split the information into their natural homes:
1.  **Menu Card:** `Dish` -> `Price`
2.  **Order Header:** `Order #` -> `Customer`
3.  **Line Items:** `(Order #, Dish)` -> `Quantity`

Everything now lives in its "natural home". That is all 2NF means: Don't put "Menu Info" on the "Order Form".
"""
    },

    # Target Subtopic: Introduction to SQL
    "introduction-to-sql": {
        1: """
# Introduction to SQL: Standard Definition

### Definition
**SQL (Structured Query Language)** is the standard domain-specific language used for managing data held in a Relational Database Management System (RDBMS).

### Core Components
SQL is declarative, meaning you describe *what* you want, not *how* to get it. It consists of:
*   **DQL (Data Query Language):** `SELECT` statements.
*   **DML (Data Manipulation Language):** `INSERT`, `UPDATE`, `DELETE`.
*   **DDL (Data Definition Language):** `CREATE`, `DROP`, `ALTER`.

### Basic Query Structure
To retrieve data, the `SELECT` statement is used with the following clauses:
```sql
SELECT column_name(s)
FROM table_name
WHERE condition;
```
""",

        2: """
# Introduction to SQL: Visual Mapper

Think of a Database as a massive warehouse of filing cabinets. SQL is the specific request form you give to the clerk to get what you want.

### The SELECT Pipeline
```text
[ DATA SOURCE ]  -->  [ FILTER ]  -->  [ SELECT COLUMNS ]  -->  [ RESULT ]
   (FROM)              (WHERE)             (SELECT)
```

1.  **FROM**: Pick the Cabinet (Table).
2.  **WHERE**: Throw out folders that don't match criteria (The Filter).
3.  **SELECT**: Copy only the specific info (Name, ID) you need from the remaining folders.
""",

        3: """
# SQL Simplified

SQL is just a way to ask questions to a database.
It is very similar to English.

If you have a spreadsheet of **Students**, and you want a list of names for everyone in 'Grade 5':

*   **You ask (English):** "Show me **Name** from **Students** where **Grade is 5**."
*   **SQL says:**
    ```sql
    SELECT Name
    FROM Students
    WHERE Grade = 5;
    ```

**The big secret:** You almost always just use these three words:
1.  **SELECT**: What do you want to see?
2.  **FROM**: Where is it stored?
3.  **WHERE**: Which rows do you want?
""",

        4: """
# SQL: Concrete Syntax & Examples

SQL (Structured Query Language) is the code we write to talk to databases.

### Basic Structure
```sql
-- This is a comment
SELECT column1, column2   -- The columns you want
FROM table_name           -- The table to look in
WHERE condition;          -- The filter rule
```

### Real World Example
**Task:** Get the email addresses of all user who are 'active'.

**Code:**
```sql
SELECT email, first_name
FROM users
WHERE status = 'active';
```

**Key Keywords:**
*   `SELECT`: Specifies columns.
*   `FROM`: Specifies table.
*   `WHERE`: Filters rows.
*   `AND/OR`: Combines conditions.
""",

        5: """
# SQL: The "Personal Shopper" Analogy

Imagine you send a **Personal Shopper** (SQL Engine) to a **Supermarket** (Database).

You *don't* say: "Walk down aisle 4, look left, grab item..." (That's procedural coding).
You *do* say: **"Bring me all the *Red Apples* from the *Fruit Section*."** (Declarative SQL).

The Shopper handles the hard work of finding them. You just describe the result using the keywords:

*   **SELECT:** "Bring me..." (Red Apples)
*   **FROM:** "...from the..." (Fruit Section)
*   **WHERE:** "...that are..." (Red)

You define the **Goal**, and the computer figures out the **Path**.
"""
    }
}
