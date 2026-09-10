
import firebase_admin
from firebase_admin import credentials, firestore
import os

# Initialize Firebase (Local Creds)
cred_path = "backend/firebase-adminsdk.json"
if os.path.exists(cred_path):
    print(f"Loading creds: {cred_path}")
    cred = credentials.Certificate(cred_path)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
else:
    if not firebase_admin._apps:
        firebase_admin.initialize_app()

db = firestore.client()

COURSE_ID = "dbms"
UNIT_ID = "u1"
SUBTOPIC_ID = "intro-to-database-systems"

print(f"Upgrading ID: {SUBTOPIC_ID} with 5-Level Content...")

doc_ref = (db.collection("courses")
           .document(COURSE_ID)
           .collection("units")
           .document(UNIT_ID)
           .collection("subtopics")
           .document(SUBTOPIC_ID))

# 5 Levels of Content
content_levels = {
    "1": """
# Introduction to Database Systems

A **Database Management System (DBMS)** is sophisticated system software designed to define, manipulate, retrieve, and manage data in a database. The DBMS serves as an interface between the database and its end-users or application programs, ensuring that data is consistently organized and remains easily accessible.

### Core Components and Architecture

The architecture of a DBMS depends on the underlying computer system on which it runs. However, the basic architecture typically includes:

1.  **Software**: The main component is the DBMS software itself (e.g., MySQL, Oracle, PostgreSQL). It manages the database and controls the access to data.
2.  **Hardware**: This consists of the physical computer devices like storage devices (HDD, SSD), printers, and network devices used to capture and present data.
3.  **Data**: This is the most critical component. It includes both the actual operational data (e.g., student records, inventory) and the meta-data (data about data, such as schema definitions).
4.  **Procedures**: These are the instructions and rules that govern layout, design, and use of the database. They help in maintaining data integrity.
5.  **Database Access Language**: Steps to access the data, such as SQL (Structured Query Language), which allows adding, modifying, deleting, and selecting data.
6.  **Query Processor**: Transforms user queries into a series of low-level instructions.
7.  **Runtime Database Manager**: Handles the central management of the database during execution.
8.  **Data Manager**: Responsible for the actual storage of data in the file system.
9.  **Database Engine**: The core service for storing, processing, and securing data.

### Primary Functions

*   **Data Dictionary Management**: Definitions of the data elements and their relationships (metadata).
*   **Data Storage Management**: Creates and manages the complex structures required for data storage.
*   **Data Transformation and Presentation**: Transforms entered data to conform to required data structures.
*   **Security Management**: Enforces user security and data privacy.
*   **Multiuser Access Control**: Sophisticated algorithms ensure that multiple users can access the database concurrently without compromising its integrity.
*   **Backup and Recovery Management**: Provides backup and data recovery to ensure data safety and integrity.

> "A database is an organized collection of data, generally stored and accessed electronically from a computer system. The DBMS is the software that interacts with end users, applications, and the database itself to capture and analyze the data."
    """,

    "2": """
# Introduction to Database Systems

A **Database Management System (DBMS)** is essentail software that allows organizations to effectively manage their data. It acts as a bridge between the user and the stored data, ensuring efficiency and security.

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
}

doc_ref.set({"content_levels": content_levels}, merge=True)

print("✅ Upgrade Complete. 5 Levels added.")
