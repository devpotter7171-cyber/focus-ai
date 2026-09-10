
import json
import os

# Subtopics appearing in Unit 2
# relational-model-concepts
# update-operations
# unary-relational-operations
# relational-algebra-set-theory
# binary-relational-operations
# relational-algebra-queries

PATCH_DATA = {
    "relational-model-concepts": {
        "2": """
# Relational Model (Simplified)

Think of the **Relational Model** as a collection of **Excel Spreadsheets** (Tables).

### Key Terms (The Excel Analogy)
*   **Relation**: The entire Spreadsheet Table.
*   **Tuple**: A single **Row** in the table (representing one object, like "John Smith").
*   **Attribute**: A **Column** header (like "Name", "Age", "Phone").
*   **Domain**: The allowed values for a column (e.g., You can't put "Banana" in the "Age" column).

### The Rules (Constraints)
1.  **Key Constraint**: Every row needs a unique ID (like a Student ID). You can't have two rows exactly the same.
2.  **Entity Integrity**: You can't have a Student ID that is *empty*. Everyone must be identifiable.
3.  **Referential Integrity**: If a Student is enrolled in "Course 101", then "Course 101" must actually exist in the Course list. No broken links!
""",
        "3": """
# Relational Model: Key Concepts

*   **Relation**: A set of tuples (rows). Order of rows/columns is irrelevant.
*   **Tuple**: An ordered list of values <v1, v2, ..., vn>.
*   **Attribute**: Name of a role played by a domain in the relation schema.
*   **Degree**: Number of attributes (columns).
*   **Cardinality**: Number of tuples (rows).

### Constraints
*   **Superkey**: Set of attributes that uniquely identifies a tuple.
*   **Candidate Key**: A minimal superkey.
*   **Primary Key (PK)**: The chosen candidate key to identify tuples.
*   **Foreign Key (FK)**: An attribute in one table that references the PK of another table.
""",
        "4": """
# Relational Model in SQL

In the real world, the Relational Model maps directly to **SQL Tables**.

### Schema Definition
```sql
CREATE TABLE Employee (
    SSN INT PRIMARY KEY,      -- Entity Integrity (Cannot be NULL)
    Name VARCHAR(50),         -- Attribute / Doman
    DeptID INT,
    FOREIGN KEY (DeptID) REFERENCES Department(ID) -- Referential Integrity
);
```

### Reality Check
*   **Set Theory vs SQL**: In pure theory, a Relation cannot have duplicate tuples. In SQL, `SELECT *` might return duplicates unless you use `DISTINCT`.
*   **NULL Values**: Null represents "Unknown" or "Not Applicable", which complicates logic (e.g., `NULL = NULL` is False).
""",
        "5": """
# Relational Model: The Basics

**The Relational Model is just data in Tables.**

*   **Rows** = Items (Customers, Products).
*   **Columns** = Details (Name, Price).
*   **Keys** = ID Badges.

**The Golden Rule**: 
Tables relate to other tables using Keys. (e.g., The "Order" table has a "Customer ID" to link back to the "Customer" table).
"""
    },

    "update-operations": {
        "2": """
# Update Operations (Simplified)

Updating a database is like managing a physical filing cabinet. You can do 3 things:

1.  **Insert (Add a File)**: You hire a new employee. You write their details on a form and put it in the cabinet.
2.  **Delete (Remove a File)**: An employee quits. You take their form out and shred it.
3.  **Update (Edit a File)**: An employee gets a raise. You take their form, cross out the old salary, and write the new one.

### What if you make a mistake?
*   **Constraint Violation**: If you try to add an employee with ID #007, but #007 already exists, the system yells "Stop!" (Reject).
*   **Cascade**: If you delete a "Department", the system might automatically delete all "Employees" in that department so they aren't left stranded on the books.
""",
        "3": """
# Update Operations: Summary

### Basic Operations
*   **INSERT**: Adds a new tuple `t` to relation `R`.
*   **DELETE**: Removes a tuple `t` from relation `R`.
*   **MODIFY**: Changes values of attributes in existing tuple `t`.

### Handling Integrity Violations
1.  **Reject (Restricted)**: The default. The operation is blocked immediately.
2.  **Cascade**: The operation triggers updates/deletes in related tables to maintain consistency.
3.  **Set Null / Set Default**: The invalid references are changed to NULL or a default value.
""",
        "4": """
# Update Operations: Transactional Safety

In production systems, updates are dangerous.

### The FK Constraint Problem
Scenario: You try to `DELETE FROM Customers WHERE ID = 5`.
*   **Problem**: There are 50 `Orders` linked to Customer 5.
*   **Result**: Database throws `Foreign Key Constraint Violation`.

### Solutions (SQL)
*   `ON DELETE CASCADE`: Automatically deletes the 50 orders (Dangerous!).
*   `ON DELETE SET NULL`: Keeps orders but removes the link to Customer 5.

### ACID Properties
Updates are usually wrapped in **Transactions** to ensure:
*   **Atomicity**: Either the specific update happens completely, or not at all. No half-updates.
""",
        "5": """
# Update Operations: The Basics

**You can change data in three ways:**

1.  **Add** new stuff.
2.  **Remove** old stuff.
3.  **Change** existing stuff.

**Safety First**: The database prevents you from doing stupid things, like deleting a Customer who still has active orders.
"""
    },

    "unary-relational-operations": {
        "2": """
# Unary Operations (Simplified)

**Unary** means "One". These operations look at **one** table at a time.

### Select (\u03c3) = "Filter Rows"
Imagine a spreadsheet of 1000 Movies.
*   You use a filter to show only **"Movies released in 2023"**.
*   This cuts the list vertically (fewer rows).

### Project (\u03c0) = "Pick Columns"
*   You only care about the **Title** and **Director**. You hide the "Budget", "Cast", and "Runtime" columns.
*   This cuts the list horizontally (fewer columns).
""",
        "3": """
# Unary Operations (\u03c3 and \u03c0)

### SELECT (\u03c3)
*   **Symbol**: Sigma (\u03c3).
*   **Purpose**: Selects tuples (rows) that satisfy a boolean predicate.
*   **Cardinality**: Result has <= original rows.
*   **Commutative**: `\u03c3_a(\u03c3_b(R)) == \u03c3_b(\u03c3_a(R))`

### PROJECT (\u03c0)
*   **Symbol**: Pi (\u03c0).
*   **Purpose**: Selects attributes (columns) and discards duplicates.
*   **Degree**: Result has <= original columns.
*   **Note**: In standard relational algebra, Project removes duplicate tuples automatically.
""",
        "4": """
# Unary Operations in SQL

How do these map to the code you write?

### The SQL Mapping
Query: `SELECT DISTINCT Name, Age FROM Students WHERE GPA > 3.5`

1.  **`WHERE GPA > 3.5`**
    *   This is the **SELECT (\u03c3)** operation. It filters the rows.

2.  **`SELECT Name, Age`**
    *   This is the **PROJECT (\u03c0)** operation. It extracts the columns.

3.  **`DISTINCT`**
    *   Pure Relational Algebra sets implicitly remove duplicates. SQL requires explicit `DISTINCT`.
""",
        "5": """
# Unary Operations: The Basics

**Filtering your data.**

*   **Select**: Picking specific **rows**. (e.g., "Show me just the red cars").
*   **Project**: Picking specific **columns**. (e.g., "I only want to see names, not phone numbers").

That's it. It's just slicing the table.
"""
    },

    "relational-algebra-set-theory": {
        "2": """
# Set Theory Operations (Simplified)

Think of **Venn Diagrams**.

### Union (\u222a) = "Combine Groups"
*   Group A: Students who play Soccer.
*   Group B: Students who play Music.
*   **Union**: Everyone who plays **Soccer OR Music**. (Merge the lists).

### Intersection (\u2229) = "Find Overlap"
*   **Intersection**: Students who play **Soccer AND Music**. (Only the people in both lists).

### Set Difference (-) = "Exclude"
*   **Difference (A - B)**: Students who play Soccer **BUT NOT** Music.
""",
        "3": """
# Set Operations: Notation

Conditions: Relations must be **Union-Compatible** (Same degree, compatible domains).

### 1. UNION (R \u222a S)
*   Result: Tuples in R, or S, or both.
*   Duplicates removed in standard algebra.

### 2. INTERSECTION (R \u2229 S)
*   Result: Tuples common to both R and S.
*   Equivalence: `R \u2229 S = R - (R - S)`

### 3. DIFFERENCE (R - S)
*   Result: Tuples in R that are not in S.
*   **Non-Commutative**: `R - S` is not same as `S - R`.
""",
        "4": """
# Set Operations: SQL Implementation

### UNION
```sql
SELECT ID FROM Alumni
UNION
SELECT ID FROM Students;
```
*   Combines both lists. `UNION ALL` preserves duplicates.

### INTERSECTION
```sql
SELECT ID FROM Alumni
INTERSECT
SELECT ID FROM Employees;
```
*   Finds people who are both Alumni AND Employees.

### EXCEPT (Difference)
```sql
SELECT ID FROM Students
EXCEPT
SELECT ID FROM Paid_Students;
```
*   Finds students who haven't paid yet.
""",
        "5": """
# Set Operations: The Basics

**Combining Lists.**

*   **Union**: Add two lists together.
*   **Intersection**: Find the duplicates in two lists.
*   **Difference**: Take one list and remove items found in the second list.

*Rule: You can only do this if the lists look the same (e.g., both are lists of Names).*
"""
    },

    "binary-relational-operations": {
        "2": """
# Binary Operations: Joins (Simplified)

This is the superpower of databases. Connecting data.

### Cartesian Product (The "Mix Everything" Choice)
If you have 3 Shirts and 2 Pants.
Product = 6 Combinations (Shirt1-Pant1, Shirt1-Pant2, ...).
It matches *everything with everything*. Usually useless on its own.

### Join (The "Smart" Choice)
You have a list of **Orders** and a list of **Customers**.
*   **Product**: Matches every order to every customer (Nonsense).
*   **Join**: Matches Order #101 to "John Doe" *because* the Order slip says "Customer: John Doe".

It finds the connection and glues the rows together.
""",
        "3": """
# Binary Operations: Cross Product & Join

### Cartesian Product (R \u00d7 S)
*   **Result Degree**: Degree(R) + Degree(S).
*   **Result Cardinality**: size(R) * size(S).
*   Often followed by a selection to create a join.

### Join (\u2a1d)
*   **Theta Join**: General join with any condition (e.g., A < B).
*   **Equijoin**: Join condition uses only equality (=).
*   **Natural Join (*)**: Equijoin on attributes with the same name, removing duplicate columns.
""",
        "4": """
# Joins: Performance Reality

Joins are expensive operations computationally.

### Query Plan
When you write:
```sql
SELECT * FROM Users JOIN Orders ON ...
```
The database engine might do:
1.  **Nested Loop Join**: For every user, look through all orders. (Slow: O(N*M))
2.  **Hash Join**: Build a hash map of Users, then scan Orders. (Fast)
3.  **Merge Join**: Sort both lists, then zipper them together.

### Cartesian Product (Warning)
If you forget the `ON` clause in SQL:
`SELECT * FROM Users, Orders;`
This creates a Cross Product. If you have 1,000 users and 1,000 orders, you get **1,000,000 rows**. This can crash a server.
""",
        "5": """
# Joins: The Basics

**Joins connect two tables.**

If table A has "Songs" and table B has "Artists".
A **Join** puts them together so you see "Song Name - Artist Name" on one line.

It matches them based on a shared ID (like Artist_ID).
"""
    },

    "relational-algebra-queries": {
        "2": """
# Relational Queries (Simplified)

Queries are just a recipe.

**Task**: "Find the phone numbers of all managers."

**The Recipe (Step-by-Step)**:
1.  **Grab** the 'Employees' table.
2.  **Filter** (Select) to keep only people where 'Job_Title' is 'Manager'.
3.  **Cut** (Project) the table to keep only the 'Name' and 'Phone' columns.
4.  **Serve** the result.

You chain the simple tools (Select, Project, Join) to solve complex questions.
""",
        "3": """
# Constructing Queries

Queries are valid expressions in Relational Algebra.

### Composition
Operations can be nested.
`\u03c0_name ( \u03c3_age>25 ( Student ) )`

### Evaluation Tree
The DBMS parses a query into a tree:
*   **Leaf nodes**: Input relations.
*   **Internal nodes**: Algebra operations.
*   **Root**: The final result.

The optimizer might rearrange this tree (e.g., pushing selections down) to make it faster.
""",
        "4": """
# Queries: Optimization

Writing efficient queries matters.

**Query A**:
`JOIN` all Students and Courses, then `SELECT` the ones named "Bob".
*   *Bad*: Joins 10,000 rows, then filters.

**Query B**:
`SELECT` Students named "Bob", then `JOIN` to Courses.
*   *Good*: Filters down to 1 row, then Joins.

**Heuristic Optimization**:
"Push Selects down the tree". Do filtering as early as possible to reduce the data size before doing expensive Joins.
""",
        "5": """
# Queries: The Basics

**A Query is a question you ask the data.**

You build the question by chaining steps:
1.  **Filter** what you don't need.
2.  **Connect** necessary tables.
3.  **Pick** the specific columns you want.

The result is always a new, smaller table.
"""
    }
}

def patch_file():
    seed_path = os.path.join("seed", "dbms_subtopics.json")
    print(f"Reading {seed_path}...")
    
    with open(seed_path, "r", encoding="utf-8") as f:
        subtopics = json.load(f)
        
    updated_count = 0
    
    for sub in subtopics:
        sid = sub.get("id")
        if sid in PATCH_DATA:
            print(f"Patching {sid}...")
            if "content_levels" not in sub:
                sub["content_levels"] = {}
                
            # Apply patches for levels 2,3,4,5
            for lvl, content in PATCH_DATA[sid].items():
                sub["content_levels"][lvl] = content
                
            updated_count += 1
            
    print(f"Updated {updated_count} subtopics.")
    
    with open(seed_path, "w", encoding="utf-8") as f:
        json.dump(subtopics, f, indent=2)
        
    print("Done.")

if __name__ == "__main__":
    patch_file()
