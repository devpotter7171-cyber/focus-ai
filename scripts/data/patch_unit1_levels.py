
import json
import os

# Subtopics appearing in Unit 1
UNIT1_IDS = [
    "intro-to-database-systems",
    "data-models-schemas", 
    "er-model-concepts",
    "relationships-constraints"
]

# Distinct content definitions
# Note: Level 1 is preserved from existing file (or assumed standard). 
# We define levels 2-5 here.

PATCH_DATA = {
    "intro-to-database-systems": {
        "2": """
# Introduction to Database Systems

A **Database Management System (DBMS)** is essential software that allows organizations to effectively manage their data. It acts as a bridge between the user and the stored data, ensuring efficiency and security.

### Why do we need a DBMS?

Before DBMS, we used **File Systems**, where data was stored in flat files. This had many problems:
*   **Data Redundancy**: The same data was repeated in multiple places, wasting space.
*   **Data Inconsistency**: Updating data in one place didn't update it everywhere.
*   **Difficulty in Access**: Writing programs to retrieve data was complex.
*   **Security Issues**: Hard to control who sees what.

A DBMS solves all these problems by centralizing data management.

### Key Parts of a DBMS Environment

*   **The Software**: The program you interact with (like MySQL or SQL Server).
*   **The Data**: The valuable information (customer lists, product catalogs).
*   **The Procedures**: The rules on how to use the system (e.g., "Always backup on Fridays").
*   **The Users**:
    *   *Administrators (DBA)*: Control the whole system.
    *   *Designers*: Decide how data is structured.
    *   *End Users*: People who just need to use the data for their jobs.

### What does it allow you to do?

1.  **Store Data**: Keep massive amounts of information organized.
2.  **Retrieve Data**: Find exactly what you need in milliseconds.
3.  **Update Data**: Change information easily (e.g., updating a phone number).
4.  **Manage Security**: Ensure only the right people see sensitive data.
""",
        "3": """
# Introduction to DBMS

**What is a DBMS?**
A Database Management System (DBMS) is software used to store and manage data. It makes it easy to create, read, update, and delete data on a computer.

### The 3 Big Benefits

1.  **Centralized Control**: specific place for all data. No more searching through 100 different spreadsheets.
2.  **Data Integrity**: The system ensures data makes sense (e.g., it won't let you enter "Bob" as a birthdate).
3.  **Data Independence**: You can change the data structure without breaking the programs that use it.

### Major Types of DBMS

*   **Relational (RDBMS)**: The most common type. Data is stored in **tables** with rows and columns. (Examples: MySQL, PostgreSQL, Microsoft SQL Server).
*   **NoSQL**: Good for unstructured data like social media posts. (Examples: MongoDB, Cassandra).
*   **Cloud Database**: Hosted on the internet (Example: Amazon RDS, Google Cloud SQL).

### Who uses it?

*   **Banking**: For customer accounts, loans, and transactions.
*   **Airlines**: For reservations and schedule information.
*   **Universities**: For registration and grades.
*   **Sales**: For customer, product, and purchase information.
""",
        "4": """
# Introduction to DBMS

**DBMS = The Manager of Your Data**

Imagine you run a giant **Supermarket**.

### The Old Way (File System)
You have a separate notebook for:
*   Inventory
*   Employees
*   Sales
*   Customers

If you sell a packet of chips, you have to run to the *Inventory* notebook, erase a number, then run to the *Sales* notebook, and write it down. It's messy, slow, and you might make mistakes.

### The New Way (DBMS)
You hire a **Super-Efficient Manager** (The DBMS).

*   **You**: "Hey Manager, I just sold a packet of chips."
*   **Manager (DBMS)**: "Got it. I will update the inventory count, record the sale, and update the customer points automatically."

### Visualizing the Role

*   **User/App** (You) -> **DBMS** (The Manager) -> **Database** (The Warehouse)

You never touch the messy warehouse shelves directly. You just tell the Manager what you need, and they handle the complexity.

**Key Components**:
1.  **Software**: The Manager's brain.
2.  **Hardware**: The Warehouse building.
3.  **Data**: The products on the shelves.
""",
        "5": """
# Introduction to DBMS

**Think of a DBMS like the "Contacts App" on your smartphone.**

### How it works:

1.  **The Problem**: Inside your phone's storage, your friend's number is just a stream of zeros and ones (010101001). It looks like nonsense to humans. You can't remember millions of these codes.

2.  **The Solution (DBMS)**: The Contacts App acts as a helper.
    *   You just type: **"Mom"**
    *   The App looks up the messy code for you.
    *   It places the call.

### Why is this efficient?

*   **Easy**: You don't need to know *where* or *how* the number is stored on the chip.
*   **Safe**: The app stops you from accidentally deleting your own number.
*   **Fast**: It finds "Mom" instantly, even if you have 5,000 contacts.

In the business world, a **DBMS** does exactly this but for billions of records (like bank accounts or flight tickets). It hides the messy computer details and gives us a simple way to work with our information.
"""
    },
    
    "data-models-schemas": {
        "2": """
# Data Models and Schemas

Think of a **Data Model** like a **blueprint** for a house. The **Schema** is the actual detailed drawing that the builders follow.

### Three Levels of Seeing Data (Three-Schema Architecture)

1.  **External Level (The Paint)**: This is what the user sees. The nice dashboard, the profile page. It hides all the messy wires.
2.  **Conceptual Level (The Room Layout)**: This is the structure. "We have a User table with Name and Email." It doesn't care *where* on the hard drive it lives, just *what* it is.
3.  **Internal Level (The Wiring/Pipes)**: This is the physical storage. "This data is stored on Sector 5 of the Hard Drive." Only the Database Administrator cares about this.

### Why separate them?
So you can change the wiring (Internal) without breaking the paint (External). This is called **Data Independence**.
""",
        "3": """
# Key Concepts: Models & Schemas

*   **Data Abstraction**: The main goal of a DBMS. Hiding complex details from the user.
*   **Schema**: The logical structure or "description" of the database (Table names, columns).

### The Three-Schema Architecture

1.  **External Level**:
    *   **User View**.
    *   Customized for specific user groups.
2.  **Conceptual Level**:
    *   **Logical Structure**.
    *   Entities, Relationships, Constraints.
    *   Hides physical storage details.
3.  **Internal Level**:
    *   **Physical Storage**.
    *   Compression, hashing, blocks on disk.

### Data Independence
*   **Logical Independence**: Changing the Conceptual schema (adding a column) without breaking External views (app code).
*   **Physical Independence**: Changing Internal storage (moving to SSD) without breaking Conceptual schema.
""",
        "4": """
# Data Models: Real World Example

Imagine a **Generic "User Profile" Page** on a website.

### 1. External Schema (The Application View)
The Web App queries: `SELECT Name, Email FROM Users`.
*   It doesn't know *how* `Users` is stored. It just sees a list.
*   **Benefit**: Front-end devs don't need to know about disk sectors.

### 2. Conceptual Schema (The Database Design)
The Database definition:
```sql
CREATE TABLE Users (
    ID INT PRIMARY KEY,
    Name VARCHAR(100),
    Email VARCHAR(100),
    PasswordHash CHAR(64)
);
```
*   This defines *what* data exists and the rules (Primary Key).

### 3. Internal Schema (The Physical Storage)
*   "Store `Users` content in `data_file_01.db`."
*   "Index `Email` using a B-Tree structure for fast searching."
*   "Compress old records."
*   **Benefit**: You can upgrade the server storage without rewriting the SQL query.
""",
        "5": """
# Basics: Models & Schemas

**What is a Schema?**
A Schema is just the **structure** of your data. Think of it like a blank form you fill out. It says "Name goes here, Date goes here".

**Why do we have "Models"?**
We use models to simplify things.
*   **High-Level**: Just the ideas ("Customer buys Product").
*   **Low-Level**: The computer bits ("0110 in memory address 0x5F").

**The Big Idea**:
A good database lets you change the "under the hood" stuff (storage) without breaking the "driver's seat" experience (the app).
"""
    },

    "er-model-concepts": {
        "2": """
# ER Model Concepts (Simplified)

**ER** stands for **Entity-Relationship**. 
It's just a fancy way of saying "Nouns and Verbs".

### The Building Blocks:

1.  **Entity (The Noun)**: A thing. A Person, a Car, a Course.
    *   *Analogy*: In a game, the "Player" and the "Enemy" are Entities.
2.  **Attribute (The Adjective)**: Describes the thing.
    *   *Analogy*: The Player's "Health", "Score", and "Name".
3.  **Relationship (The Verb)**: How they interact.
    *   *Analogy*: Player **Attacks** Enemy. Student **Takes** Course.

### Keys (The ID Card)
Every Entity needs a unique ID, like a Social Security Number or a Student ID. This is called the **Key Attribute**. It forces every item to be unique so we don't confuse two "John Smiths".
""",
        "3": """
# Key Metrics: ER Model

*   **ER Model**: A conceptual data model used for design.
*   **Diagrams**: Uses rectangles (Entities) and diamonds (Relationships).

### Core Definitions

*   **Entity**: A distinct object in the real world (Student, Project).
*   **Entity Set**: A collection of similar entities (All Students).
*   **Attribute**: properties of an entity (Name, Age).
    *   *Simple*: Atomic (Age).
    *   *Composite*: Multiple parts (Address -> Street, City).
    *   *Multivalued*: Multiple values (Phone Numbers).
*   **Key Attribute**: Unique identifier (underlined in diagrams).
*   **Relationship**: Association between two or more entities.
""",
        "4": """
# ER Model: E-Commerce Use Case

When designing a shop like Amazon, we draw an ER Diagram first.

### 1. Identify Entities (Rectangles)
*   `Customer`
*   `Product`
*   `Order`

### 2. Identify Attributes (Ovals)
*   **Customer**: `Email` (Key), `Name`, `Address`.
*   **Product**: `SKU` (Key), `Price`, `Description`.
*   **Order**: `OrderID` (Key), `Date`.

### 3. Identify Relationships (Diamonds)
*   Customer **PLACES** Order.
*   Order **CONTAINS** Product.

### Why do this?
Drawing this diagram forces us to answer questions like "Can an Order exist without a Customer?" (No) or "Can an Order contain 0 products?" (No). It catches logic errors before we write any code.
""",
        "5": """
# ER Model: The Basics

**ER Models are just brainstorm diagrams.**

Before you build a house, you draw a sketch.
Before you build a database, you draw an **ER Diagram**.

*   **Boxes** represent things (Entities).
*   **Lines** represent connections (Relationships).

It helps developers agree on "what are we actually building?" before writing complex SQL code.
"""
    },

    "relationships-constraints": {
        "2": """
# Relationships & Constraints (Simplified)

**Relationships** are the rules of the road for how data connects.

### The Connectivity Rules (Cardinality)

*   **One-to-One (1:1)**: Like a Husband and Wife (in traditional law). One person, one spouse.
*   **One-to-Many (1:N)**: Like a **Mother and Children**. One mother can have many children, but a child has only one biological mother.
*   **Many-to-Many (M:N)**: Like **Students and Classes**. A student takes many classes. A class has many students.

### Constraints (Safety Rails)
Constraints stop you from doing impossible things.
*   *Participation Constraint*: "Every Order MUST have a Customer." You can't have a floating order belonging to nobody.
""",
        "3": """
# Relationships & Constraints: Key Points

### Cardinality Ratios
Specifies the maximum number of relationship instances.
*   **1:1 (One-to-One)**: Rare. (e.g., Manager manages one Department).
*   **1:N (One-to-Many)**: Most common. (e.g., Department has many Employees).
*   **M:N (Many-to-Many)**: Requires a junction table in implementation. (e.g., Student - Course).

### Participation Constraints
*   **Total Participation (Double Line)**: Existence dependency. (e.g., Every Employee MUST work for a Department).
*   **Partial Participation**: Optional. (e.g., Not every Employee manages a Department).

### Weak Entity
*   An entity with no Key of its own.
*   Identified by a "Partial Key" + Owner Entity.
*   Example: `Dependent` of an `Employee`.
""",
        "4": """
# Relationships in Action: Twitter Schema

Consider modeling **Twitter (X)**.

### Relationships
1.  **User -> Tweet (1:N)**:
    *   One User posts **Many** Tweets.
    *   A Tweet belongs to **One** User.
    *   *Implementation*: The `Tweets` table has a column `user_id` (Foreign Key).

2.  **User -> User (M:N)**:
    *   User follows **Many** Users.
    *   User is followed by **Many** Users.
    *   *Implementation*: A separate `Follows` table with `follower_id` and `followee_id`.

### Constraints
*   **Constraint**: You cannot `Retweet` a Tweet that doesn't exist. (Referential Integrity).
*   **Constraint**: Two users cannot have the same `@handle`. (Unique Key).
""",
        "5": """
# Relationships: The Basics

**Relationships define how data links together.**

If you have a list of **Customers** and a list of **Orders**, you need a way to say "This order belongs to that customer."

*   **1-to-1**: One socket, one plug.
*   **1-to-Many**: One teacher, many students.
*   **Many-to-Many**: Many friends, many parties.

**Constraints** are just rules to prevent garbage data. like "You can't have an age less than 0."
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
