
import json
import os

PATCH_DATA = {
    # UNIT 3: SQL & Normalization
    "introduction-to-sql": {
        "2": """
# SQL: Speaking the Database Language

**SQL** (Structured Query Language) is English for Databases.

### Creating a Table (DDL)
It's like creating a spreadsheet.
```sql
CREATE TABLE Students (
    ID INT,              -- Column for Numbers
    Name VARCHAR(100)    -- Column for Text
);
```

### Asking for Data (SELECT)
The "Hello World" of SQL:
```sql
SELECT Name FROM Students;
```
It simply implies: "Go to the Students sheet and give me the Name column."

### Filtering
```sql
SELECT * FROM Students WHERE Age > 18;
```
"Show me everyone who is an adult."
""",
        "3": """
# Introduction to SQL

### Categories of SQL Commands
1.  **DDL (Data Definition Language)**: Defines structure.
    *   `CREATE`, `ALTER`, `DROP`.
2.  **DML (Data Manipulation Language)**: Manages data.
    *   `SELECT`, `INSERT`, `UPDATE`, `DELETE`.
3.  **DCL (Data Control Language)**: Manages rights.
    *   `GRANT`, `REVOKE`.

### Basic Query Structure
```sql
SELECT distinct_list
FROM table_list
WHERE conditions
ORDER BY sort_order;
```
*   **Order of Execution:** FROM -> WHERE -> SELECT -> ORDER BY.
""",
        "4": """
# SQL in Practice

SQL is the standard across the industry (PostgreSQL, MySQL, Oracle).

### Constraints in specific Dialects
While standard SQL exists, types vary:
*   **MySQL**: `INT`, `VARCHAR`, `TEXT`.
*   **PostgreSQL**: `SERIAL` (Auto-increment), `JSONB`.

### The Importance of Types
Defining `Age` as `INT` prevents someone from entering "Twenty" (text). This data integrity at the database layer saves backend code from crashing.

### Primary Keys
Always use a PK. It indexes the data automatically in most engines (Clustered Index in SQL Server/MySQL InnoDB), making lookups fast.
""",
        "5": """
# SQL: The Basics

**SQL is how we talk to the database.**

*   `CREATE` = Make a new bucket.
*   `SELECT` = Read data.
*   `INSERT` = Add data.
*   `WHERE` = Filter data (like "only red cars").

It is not a programming language like Python; it's a command language.
"""
    },

    "dml-operations": {
        "2": """
# Modifying Data (DML) - Simplified

**DML** is just "Editing the Excel Sheet".

1.  **INSERT**: Adding a new row at the bottom.
    *   `INSERT INTO Users VALUES ('Bob');`
2.  **UPDATE**: Changing a cell.
    *   `UPDATE Users SET Name='Bobby' WHERE Name='Bob';`
3.  **DELETE**: Erasing a row.
    *   `DELETE FROM Users WHERE Name='Bobby';`

**Warning**: If you forget the `WHERE` clause in an Update/Delete, you change/erase **EVERYTHING**!
*   `DELETE FROM Users;` (Oops, company gone).
""",
        "3": """
# DML Operations

### INSERT
*   **Single Row**: `INSERT INTO Table(Col1, Col2) VALUES (Val1, Val2);`
*   **Bulk**: `INSERT INTO Table SELECT ...`

### UPDATE
*   **Syntax**: `UPDATE Table SET Col=Val WHERE Condition;`
*   **Performance**: Updates are slower than inserts because they must update indexes too.

### DELETE
*   **Syntax**: `DELETE FROM Table WHERE Condition;`
*   **vs TRUNCATE**: `TRUNCATE` empties the table but keeps structure. It is a DDL command (faster, no rollback logs).
""",
        "4": """
# DML: Best Practices

### The "DELETE without WHERE" Nightmare
Production Tip: Always run a `SELECT` with your `WHERE` clause before changing it to a `DELETE`.
*   **Check**: `SELECT * FROM Users WHERE ID = 5;` (1 row found? Good.)
*   **Run**: `DELETE FROM Users WHERE ID = 5;`

### Bulk Inserts
Inserting 1,000 rows one by one is slow.
*   **Bad**: Loop { `INSERT ...` }
*   **Good**: `INSERT INTO Users (A, B) VALUES (1, 1), (1, 2), ...` (Single transaction).

### Injection Attacks
Never insert raw user strings. Use **Prepared Statements** to prevent SQL Injection.
""",
        "5": """
# Changing Data

**Three main commands:**

1.  **Insert**: Add new stuff.
2.  **Update**: Fix existing stuff.
3.  **Delete**: Remove stuff.

*Tip: Be careful with Delete. There is usually no "Undo" button.*
"""
    },

    "functional-dependencies": {
        "2": """
# Functional Dependencies (Simplified)

This is a fancy term for **"If I know A, do I know B?"**

### The Student Example
*   **Functional Dependency**: `Student_ID -> Name`
*   **Meaning**: If I know your Student ID is #123, I **automatically** know your Name is "John". Two people with ID #123 can't have different names.

### Counter-Example
*   `Name -> Grade`? **No.**
*   Just because your name is "John", I don't know your grade. There are many Johns.
""",
        "3": """
# Functional Dependencies (FDs)

### Definition
`X -> Y`: Y is functionally dependent on X.
For every pair of tuples like `t1[X] = t2[X]`, it must be true that `t1[Y] = t2[Y]`.

### Armstrong's Axioms
Basic inference rules for FDs:
1.  **Reflexivity**: If Y \u2286 X, then X -> Y. (Trivial).
2.  **Augmentation**: If X -> Y, then XZ -> YZ.
3.  **Transitivity**: If X -> Y and Y -> Z, then X -> Z.

### Usage
FDs are the basis for **Normalization**. We use them to find redundancy.
""",
        "4": """
# Functional Dependencies in Design

FDs are business rules expressed mathematically.

### Example: Zip Codes
*   Rule: `ZipCode -> City, State`
*   If we store (Zip, City, State) in every Customer record, we have **Redundancy**.
*   **Solution**: Create a `ZipCodes` table.
*   **Application**: FDs tell us when to split tables to save space and prevent errors (Anomalies).

### Determinants
If `SocialSecurityNum -> Name, Address, Birthdate`, then SSN is a **determinant**. We usually make determinants our Primary Keys.
""",
        "5": """
# Functional Dependencies: The Basics

**It's about Prediction.**

If I tell you the **VIN Number** of a car, you know the **Model** and **Year**.
So, `VIN -> Model, Year`.

If knowing one thing tells you another thing for sure, that's a Dependency.
"""
    },

    "normal-forms-1nf-3nf": {
        "2": """
# Normalization (Simplified)

Normalization is **Cleaning Up a Messy Room**.
We organize items into specific boxes so we don't trip over them.

### 1NF: The "No Lists" Rule
*   **Messy**: Storing "Movies Watched: Star Wars, Titanic, Jaws" in one single cell.
*   **1NF**: Break it up! One row per movie.

### 2NF: The "Whole Key" Rule
*   Don't rely on just part of the ID. If the key is (Student, Course), don't put the Student's Address here. Put it in the Student table.

### 3NF: The "No Chain" Rule
*   Don't store derived info.
*   **Bad**: Storing (ZipCode, City).
*   **3NF**: Move (ZipCode, City) to its own table.
""",
        "3": """
# Normal Forms (1NF - 3NF)

### 1NF (First Normal Form)
*   **Rule**: Atomic values. No repeating groups or arrays.
*   **Fix**: Flatten the table.

### 2NF (Second Normal Form)
*   **Rule**: In 1NF + No **Partial Dependencies**.
*   (Non-prime attribute dependent on part of a composite key).
*   **Fix**: Decompose tables so non-keys depend on the *full* key.

### 3NF (Third Normal Form)
*   **Rule**: In 2NF + No **Transitive Dependencies**.
*   (Non-prime attribute determines another non-prime attribute).
*   **Fix**: `X -> Y -> Z`. Move `Y -> Z` to a new table.
""",
        "4": """
# Normalization: Trade-offs

Normalization reduces disk space and anomalies, but...

### The Cost of Normalization
*   High Normalization (3NF/BCNF) = Many small tables.
*   **Consequence**: You need many **JOINS** to reconstruct data.
*   **Performance**: Reading is slower. Writing is faster (less redundancy).

### Denormalization
Sometimes we intentionally break 3NF.
*   **Example**: Storing `Total_Order_Value` in the `Orders` table, even though it can be calculated from `Order_Items`.
*   **Why?** To avoid calculating the sum every time we open the dashboard.
""",
        "5": """
# Normalization: The Basics

**Don't repeat yourself.**

If you have 1,000 customers from "New York", don't write "New York" 1,000 times combined with their other details.
Put "New York" in a City table and reference it.

*   **1NF**: No lists in boxes.
*   **2NF/3NF**: Everything in the row must be about the Key (ID).
"""
    },

    "bcnf-decompositions": {
        "2": """
# BCNF (Simplified)

**BCNF (Boyce-Codd Normal Form)** is 3NF Plus.
It handles edge cases where you have multiple overlapping IDs.

### The Rule
**"Every Determinant must be a Key."**

If something (Column A) determines something else (Column B), then Column A better be a unique ID (Key). If it's just a random attribute deciding things, split the table.

### Decomposition
This is just "Splitting tables". We want to split them so:
1.  We don't lose info (Lossless Join).
2.  We don't break rules (Dependency Preservation).
""",
        "3": """
# BCNF & Decomposition

### BCNF Definition
For every dependency `X -> A`, **X must be a Superkey**.
It removes anomalies that 3NF misses when candidate keys overlap.

### Lossless Join Decomposition
If we split R into R1 and R2, natural join `R1 * R2` must equal R.
*   **Condition**: `R1 \u2229 R2` must be a superkey of either R1 or R2.

### Dependency Preservation
We want to check consistency without joining tables. BCNF sometimes sacrifices this (unlike 3NF).
""",
        "4": """
# Normalization in Data Engineering

### Star Schema vs. 3NF
*   **Transactional DBs (Apps)**: Use 3NF/BCNF. We want fast writes and data integrity.
*   **Data Warehouses (Analytics)**: Use **Star Schema** (often not normalized). We accept redundancy (Dim_Tables) to make reading super fast.

### Decomposition Strategy
1.  Find the FD violating the rule.
2.  Create a new table for that FD.
3.  Remove the Dependent side from original table.
4.  Repeat until all tables comply.
""",
        "5": """
# BCNF: The Basics

**BCNF is the "Strict Mode" of database design.**

It ensures there is absolutely zero ambiguity about what determines what.
If `A` decides `B`, then `A` must be the boss (The Key).
"""
    },

    # UNIT 4: Transactions
    "transaction-concepts": {
        "2": """
# Transactions (Simplified)

A Transaction is an **"All or Nothing"** event.

### The Bank Transfer Example
You send $100 to Bob.
1.  Take $100 from You.
2.  Given $100 to Bob.

**What if the power fails after Step 1?**
*   **Without Transaction**: You lost $100, Bob got nothing. Money vanished.
*   **With Transaction**: The system sees step 2 failed, so it **Undo's** step 1. You get your money back.

This "Undo" is called **Rollback**. The "Save" is called **Commit**.
""",
        "3": """
# ACID Properties

1.  **Atomicity**: No partial execution. All instructions happen, or none do. (Implemented via Logs/Recovery Manager).
2.  **Consistency**: DB moves from valid state to valid state. Constraints preserved.
3.  **Isolation**: Concurrent transactions don't interfere. (Implemented via Locking/Concurreny Control).
4.  **Durability**: Committed data survives power loss. (Implemented via Write-Ahead-Logging).

### States
Active -> Partially Committed -> Committed OR Failed -> Aborted.
""",
        "4": """
# Transactions in Code

How developers see transactions.

### Python/SQL Example
```python
try:
    cursor.execute("START TRANSACTION")
    cursor.execute("UPDATE Acct1 SET bal = bal - 100")
    cursor.execute("UPDATE Acct2 SET bal = bal + 100")
    cursor.execute("COMMIT") # Save if we reach here
except Error:
    cursor.execute("ROLLBACK") # Undo if anything crashes
```

### The Logs
The database writes to a "Log File" on disk *before* updating the actual table. This allows replaying events if the server crashes (Durability).
""",
        "5": """
# Transactions: The Basics

**Everything happens, or nothing happens.**

It prevents "half-finished" jobs.
Example: If you buy a ticket but the payment server crashes, the transaction ensures you don't lose your seat reservation without paying.
"""
    },

    "schedules-serializability": {
        "2": """
# Schedules (Simplified)

A **Schedule** is the timeline of events when many people use the database at once.

### The ideal world: Serial
1.  User A finishes everything.
2.  User B starts.
*   **Safe**: Yes.
*   **Fast**: No. Everyone waits in line.

### The real world: Interleaved
User A and User B work at the same time.
*   **Safe**: Only if the database is smart.
*   **Fast**: Yes.

**Serializability** just means: "Did we manage to run them at the same time WITHOUT messing up the data?"
""",
        "3": """
# Schedules & Conflicts

### Serial Schedule
Transactions executed one after another. No interleaving.
`T1 -> T2`

### Serializable Schedule
Equivalent result to a serial schedule.

### Conflict Operations
Two operations conflict if:
1.  Belong to different transactions.
2.  Access same item.
3.  At least one is a **WRITE**.

**Conflict Equivalent**: If we can swap non-conflicting operations to match a serial schedule.
""",
        "4": """
# Concurrency Problems

Why do we need Serializability?

1.  **Dirty Read**: Reading uncommitted data. (Bob writes $50, you read it, Bob cancels transaction. You read phantom money).
2.  **Lost Update**: Two people update same row.
    *   T1 reads X=10.
    *   T2 reads X=10.
    *   T1 writes X=11.
    *   T2 writes X=12.
    *   **Result**: T1's update is lost. X should be 12? Or 11? Logic is broken.
""",
        "5": """
# Schedules: The Basics

**Multi-tasking support.**

A "Schedule" is how the database juggles 1,000 users at once.
A "Good Schedule" makes it look like they all waited patiently in line, even though they actually worked at the same time.
"""
    },

    "testing-serializability": {
        "2": """
# Testing Schedules (Simplified)

How do we check if a schedule was safe? We draw a **Graph**.

### The Dependency Graph
*   Draw a circle for User A and User B.
*   If User A used a file *before* User B needed it, draw an arrow `A -> B`.

**The Rule**:
*   If the arrows go in a circle (`A -> B -> A`), we have a **Deadlock/Cycle**. It's bad.
*   If the arrows flow one way, it's **Serializable** (Good).
""",
        "3": """
# Precedence Graph Method

Algorithm to test Conflict Serializability:

1.  Create node for each Transaction Ti.
2.  For every conflict (Read/Write, Write/Read, Write/Write) where Ti acts before Tj:
    *   Draw Edge `Ti -> Tj`.
3.  **Check for Cycles**.
    *   Cycle? -> **Not** Conflict Serializable.
    *   No Cycle? -> Equivalent to topological sort order of nodes.

""",
        "4": """
# Deadlocks

Cycles in the precedence graph often imply Deadlocks or unsafe states.

### What is a Deadlock?
*   T1 holds Lock A, wants Lock B.
*   T2 holds Lock B, wants Lock A.
*   **Result**: They wait forever.

### Handling
1.  **Wait-Die**: Older transaction waits, younger dies.
2.  **Wound-Wait**: Older transaction forces younger to abort.
3.  **Timeout**: If T1 waits > 5s, abort it.
""",
        "5": """
# Testing Safety: The Basics

**We look for Loops.**

If A waits for B, and B waits for A... nobody moves.
This is a cycle. Concurrency testing checks for these loops to prevent the system from freezing.
"""
    },

    "concurrency-control": {
        "2": """
# Concurrency Control (Simplified)

How do we stop people from editing the same file? **Locks**.

### 2-Phase Locking (2PL)
Imagine a room with a safe.

1.  **Growing Phase (Locking)**:
    *   You walk in. You lock the door. You lock the safe. You lock the windows.
    *   (You are grabbing all the access you need).

2.  **Shrinking Phase (Unlocking)**:
    *   You do your work.
    *   You unlock the safe. You unlock the door. You leave.
    *   **Rule**: Once you unlock *anything*, you can't lock anything new.

This rule guarantees safety.
""",
        "3": """
# Two-Phase Locking (2PL)

### The Protocol
1.  **Phase 1 (Growing)**: Transaction acquires locks (Shared/Exclusive). Cannot release any.
2.  **Point of Specificity**: Max number of locks acquired.
3.  **Phase 2 (Shrinking)**: Transaction releases locks. Cannot acquire any.

### Variations
*   **Conservative 2PL**: Acquire *all* locks at start. (Prevents deadlock, hard to predict).
*   **Strict 2PL**: Hold Write locks until Commit. (Prevents cascading aborts).
*   **Rigorous 2PL**: Hold ALL locks until Commit.
""",
        "4": """
# Locking in Real Databases

### Shared vs Exclusive
*   **Shared (S-Lock)**: "I am Reading". Others can read usually too.
*   **Exclusive (X-Lock)**: "I am Writing". Nobody else can enter.

### Optimistic vs Pessimistic
*   **2PL is Pessimistic**: "Assume conflict will happen, lock everything."
*   **Optimistic (MVCC)**: "Assume no conflict. Check version numbers at end." (Used by PostgreSQL).
    *   Readers don't block Writers.
    *   Writers create new "Versions" of rows.
""",
        "5": """
# Concurrency Control: The Basics

**Using Locks.**

Just like an airplane toilet door.
*   **Occupied**: One person is making changes. Everyone else waits.
*   **Vacant**: Next person can enter.

This prevents two people from trying to sit on the same seat.
"""
    },

    # UNIT 5: NoSQL & Distribution
    "introduction-to-nosql": {
        "2": """
# NoSQL (Simplified)

**SQL** is strictly organized (Rows/Columns).
**NoSQL** is flexible (Chaotic).

### Why NoSQL?
Imagine saving a "Shopping Cart".
*   **SQL**: Needs a User Table, Cart Table, Items Table, Products Table.
*   **NoSQL**: Just throw the whole JSON object `{ "user": "bob", "items": [...] }` into a bucket.

It's faster for specific jobs, but less safe for banking.
""",
        "3": """
# NoSQL Categories

1.  **Key-Value Stores** (Redis):
    *   HashMap on disk. O(1) reads.
    *   Use: Caching, Sessions.
2.  **Document Stores** (MongoDB):
    *   Stores JSON/BSON. Schema-less.
    *   Use: Content Management, Catalogs.
3.  **Column-Family** (Cassandra):
    *   Wide-column store.
    *   Use: Time-series, IoT data.
4.  **Graph DB** (Neo4j):
    *   Nodes and Edges.
    *   Use: Social Networks, Recommendation Engines.
""",
        "4": """
# CAP Theorem

In Distributed Data, pick **two**:
1.  **Consistency**: Everyone sees same data at same time.
2.  **Availability**: System is always up.
3.  **Partition Tolerance**: System works if network cable is cut.

**SQL** usually picks CA (Consistency + Availability).
**NoSQL** usually picks AP (Availability + Partition Tolerance). e.g., "It's okay if you see an old profile picture for 5 seconds, as long as the site loads."
""",
        "5": """
# NoSQL: The Basics

**Not Only SQL.**

Databases built for:
1.  **Speed**: Super fast.
2.  **Scale**: Billions of users.
3.  **Flexibility**: Messy data (like social media posts).

Not good for: Banks (who need strict math).
"""
    },

    "distribution-models": {
        "2": """
# Distribution (Simplified)

How do you handle data that is too big for one computer?

### Sharding (Slicing)
*   Take the phone book (A-Z).
*   Server 1 gets A-M.
*   Server 2 gets N-Z.
*   **Benefit**: Double the storage space.

### Replication (Copying)
*   Give Server 1 and Server 2 the *exact same* phone book.
*   **Benefit**: If Server 1 explodes, Server 2 is still there (Backup). Also, two people can read at once.
""",
        "3": """
# Distributed Architectures

### Sharding (Horizontal Partitioning)
Dividing data by a key (e.g., UserID % 10).
*   **Zero-Shared Architecture**: Nodes don't share RAM/Disk.
*   **Challenge**: "Cross-Shard Joins" are very expensive.

### Replication Strategies
*   **Master-Slave**: Writes go to Master, Reads to Slaves. (Async replication lag possible).
*   **Multi-Master**: Writes go anywhere. (Conflict resolution needed).
*   **Quorum**: Write to N nodes, wait for W acknowledgments.
""",
        "4": """
# Distribution in Cloud (AWS/Google)

### Auto-Scaling
*   **Traffic Spike**: System detects load.
*   **Spin Up**: Adds 10 new Read Replicas (Copies).
*   **Cool Down**: Deletes them when traffic drops.

### Consistent Hashing
Used in Sharding to prevent moving ALL data when adding a node. Only K/n keys need to move. Used by Cassandra and DynamoDB.
""",
        "5": """
# Distribution: The Basics

**Don't put all your eggs in one basket.**

1.  **Sharding**: Split the eggs into 10 baskets. (More space).
2.  **Replication**: Photocopy the eggs. (Safety).

 Modern sites like Facebook use both.
"""
    },

    "big-data-architectures": {
        "2": """
# Big Data (Simplified)

When you have so much data that standard computers crash.

### MapReduce Analogy
Task: **Count words in a library.**

*   **Standard Way**: One person walks through every book. (Takes 100 years).
*   **MapReduce Way**:
    1.  **Map**: Give 1 book to 1,000 people. They count words in their book.
    2.  **Shuffle**: Collect all counts for "Apple" in one pile, "Banana" in another.
    3.  **Reduce**: One person sums up the "Apple" pile.

It divides the work among thousands of tiny workers.
""",
        "3": """
# Big Data Ecosystem

### The 3 Vs
1.  **Volume**: Petabytes/Exabytes.
2.  **Velocity**: Streaming data (Clickstreams).
3.  **Variety**: Unstructured (Images, Audio).

### Hadoop
*   **HDFS**: Distributed File System (splits files into blocks).
*   **YARN**: Resource Manager.
*   **MapReduce**: Processing Engine.

### Modern Stack
*   **Spark**: Successor to MapReduce. Doing processing in RAM (100x faster).
*   **Kafka**: For streaming data ingestion.
""",
        "4": """
# Big Data in Real Life

### Netflix Recommendation Engine
*   **Input**: Billions of "pause", "play", "skip" events per day.
*   **Process (Spark)**: Aggregates common patterns.
*   **Output**: "Because you watched X, try Y."

This cannot be done with SQL "SELECT *". It requires parallel processing across thousands of servers.
""",
        "5": """
# Big Data: The Basics

**Too big for one computer.**

We connect 1,000 cheap computers together to act like one Super Computer.

*   **Hadoop**: The software that manages this army of computers.
""",
    },

    # UNIT 6: Optimization
    "indexing": {
        "2": """
# Indexing (Simplified)

Indexing is the difference between a **Textbook** and a **Novel**.

*   **Novel (No Index)**: To find "Harry Potter", you must read every page from start to finish. (Scan).
*   **Textbook (Index)**: Go to the back, look for "H", find page number. Jump to page. (Seek).

Indexes make finding things fast, but they make the book heavier (takes space).
""",
        "3": """
# Index Structures

### Clustered Index
*   Sorts the actual data rows on disk.
*   Only **one** per table (physically).
*   Usually the Primary Key.

### Non-Clustered (Secondary) Index
*   Separate structure. Contains Key + Pointer to row.
*   Like the index at back of book.
*   Many per table.

### B-Tree
*   Balanced Tree. All leaf nodes at same depth.
*   Standard for databases. O(log n) lookup.
""",
        "4": """
# Indexing Trade-offs

### Why not index everything?
1.  **Write Performance**: Every time you `INSERT` a row, the database must update **all** indexes.
    *   1 Index = Fast Write.
    *   10 Indexes = Slow Write.
2.  **Space**: Indexes take up disk/RAM.

### Cardinality
*   **Good Index**: High Cardinality (UUIDs, Emails). unique values.
*   **Bad Index**: Low Cardinality (Gender: M/F). Scanning might be faster than bouncing through the index.
""",
        "5": """
# Indexing: The Basics

**Speed Shortcuts.**

An index helps the computer find data instantly without checking every single row.
*   **Pro**: Fast Reading.
*   **Con**: Slower Writing (have to update the index list).
"""
    },

    "query-optimization": {
        "2": """
# Optimization (Simplified)

The Database is like a **GPS**.
You say "Go to Airport".
The GPS calculates 3 distinct routes:
1.  Highway (Fastest).
2.  City Streets (Shortest distance).
3.  Backroads (Avoid tolls).

It picks the best one based on "Cost" (Time).
The **Query Optimizer** does the same for finding data.
""",
        "3": """
# Query Execution Plans

### Steps
1.  **Parsing**: Check syntax.
2.  **Translation**: Convert to Relational Algebra.
3.  **Optimization**: Generate multiple plans, estimate costs (using table statistics), pick lowest cost.
4.  **Execution**.

### Heuristics
*   **Push Selection**: Filter row `\u03c3` as early as possible.
*   **Push Projection**: Remove columns `\u03c0` as early as possible.
*   **Join Ordering**: Join smallest tables first.
""",
        "4": """
# Optimization: Explain Analyze

In SQL, use `EXPLAIN` to see what the optimizer is doing.

### Common Scenarios
*   **Table Scan**: Reading every row. (Bad for large tables).
*   **Index Seek**: Using the B-Tree. (Good).
*   **Filesort**: Sorting without an index. (Slow).

### Hinting
Sometimes the GPS is wrong. You can force an index:
`SELECT * FROM Users USE INDEX (idx_name) ...`
""",
        "5": """
# Optimization: The Basics

**Planning the smartest route.**

Before doing the work, the database plans the fastest way to get your answer.
It uses Math to guess which path will be quickest.
"""
    },

    "data-warehousing": {
        "2": """
# Data Warehouse (Simplified)

*   **Database (OLTP)**: The **Cash Register**. Fast, recording every sale now.
*   **Data Warehouse (OLAP)**: The **Head Office Filing Room**. Slow, analyzing last year's trends.

You don't want the CEO running massive reports on the Cash Register, or the line will stop moving. So we copy data to the Warehouse for analysis.
""",
        "3": """
# Data Warehousing Concepts

### ETL (Extract, Transform, Load)
Process of moving data from operational DBs to Warehouse.
1.  **Extract**: Pull from sources.
2.  **Transform**: Clean, format, aggregate.
3.  **Load**: Insert into Warehouse.

### Schema
*   **Star Schema**: Central Fact table connected to Dimension tables.
*   **Snowflake Schema**: Normalized Dimension tables.

### Fact Table
Contains metrics (Sales Amount, Units Sold) and Foreign Keys.
""",
        "4": """
# BI (Business Intelligence)

Warehouses power dashboards (Tableau, PowerBI).

### Columnar Storage
Warehouses (like Snowflake, BigQuery) store data by **Column**, not Row.
*   **Row Store**: Good for fetching one person's profile.
*   **Col Store**: Good for summing "Revenue" column for 1 million rows. (Compression is 10x better).
""",
        "5": """
# Data Warehouse: The Basics

**A Library for History.**

Operational Databases preserve the **Now**.
Data Warehouses preserve the **Past**.

We use them to analyze trends ("Did ice cream sales go up last July?").
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
