import sys
import os

# Add backend to path to import database module
sys.path.append(os.path.join(os.getcwd(), 'backend'))

# Set credentials path explicitly
os.environ["FIREBASE_ADMIN_CREDENTIALS"] = os.path.join(os.getcwd(), 'backend', 'firebase-adminsdk.json')

from database import get_firestore_client
import uuid

db = get_firestore_client()

QUESTIONS = [
    {
        "text": "Which of the following creates a new table in SQL?",
        "options": ["CREATE TABLE", "MAKE TABLE", "NEW TABLE", "ADD TABLE"],
        "correct_answer": "CREATE TABLE",
        "difficulty": 0.2
    },
    {
        "text": "What does a Primary Key ensure?",
        "options": ["Uniqueness and Not Null", "Only Uniqueness", "Only Not Null", "Foreign Key integrity"],
        "correct_answer": "Uniqueness and Not Null",
        "difficulty": 0.4
    },
    {
        "text": "Which clause filters rows AFTER grouping?",
        "options": ["HAVING", "WHERE", "GROUP BY", "ORDER BY"],
        "correct_answer": "HAVING",
        "difficulty": 0.6
    },
    {
        "text": "What implies a 'One-to-Many' relationship?",
        "options": ["Foreign Key in child table", "Foreign Key in parent table", "Primary Key in both", "No Keys"],
        "correct_answer": "Foreign Key in child table",
        "difficulty": 0.5
    },
    {
        "text": "Which normal form removes partial dependencies?",
        "options": ["2NF", "1NF", "3NF", "BCNF"],
        "correct_answer": "2NF",
        "difficulty": 0.7
    },
    {
        "text": "What is the result of a LEFT JOIN if no match is found?",
        "options": ["NULL values for right table", "Row is discarded", "Error is thrown", "0 values"],
        "correct_answer": "NULL values for right table",
        "difficulty": 0.5
    },
    {
        "text": "Which command removes all rows but keeps the table structure?",
        "options": ["TRUNCATE", "DROP", "DELETE", "REMOVE"],
        "correct_answer": "TRUNCATE",
        "difficulty": 0.4
    },
    {
        "text": "What does ACID stand for in databases?",
        "options": ["Atomicity, Consistency, Isolation, Durability", "Atomicity, Concurrency, Isolation, Data", "Auto, Consistency, Internal, Durable", "None of the above"],
        "correct_answer": "Atomicity, Consistency, Isolation, Durability",
        "difficulty": 0.6
    },
    {
        "text": "Which index type is physically sorted?",
        "options": ["Clustered", "Non-Clustered", "Hash", "Composite"],
        "correct_answer": "Clustered",
        "difficulty": 0.7
    },
    {
        "text": "What is a Foreign Key?",
        "options": ["A reference to a Primary Key in another table", "A unique key in the same table", "A backup key", "A remote access key"],
        "correct_answer": "A reference to a Primary Key in another table",
        "difficulty": 0.3
    },
    {
        "text": "Which SQL keyword sorts the result set?",
        "options": ["ORDER BY", "SORT BY", "GROUP BY", "ALIGN"],
        "correct_answer": "ORDER BY",
        "difficulty": 0.2
    },
    {
        "text": "Subqueries can be used in:",
        "options": ["SELECT, INSERT, UPDATE, DELETE", "Only SELECT", "Only WHERE", "Only INSERT"],
        "correct_answer": "SELECT, INSERT, UPDATE, DELETE",
        "difficulty": 0.5
    },
    {
        "text": "Which is NOT a DDL command?",
        "options": ["SELECT", "CREATE", "ALTER", "DROP"],
        "correct_answer": "SELECT",
        "difficulty": 0.3
    },
    {
        "text": "What prevents SQL Injection?",
        "options": ["Parameterized Queries", "String Concatenation", "Running as Root", "Disabling JavaScript"],
        "correct_answer": "Parameterized Queries",
        "difficulty": 0.6
    },
    {
        "text": "What is the intersection of two sets in SQL?",
        "options": ["INTERSECT", "UNION", "MINUS", "EXCEPT"],
        "correct_answer": "INTERSECT",
        "difficulty": 0.5
    }
]

def seed():
    print("Seeding questions for 'intro-to-database-systems'...")
    batch = db.batch()
    
    # Target path: quiz/dbms/questions
    col_ref = db.collection("quiz").document("dbms").collection("questions")
    
    count = 0
    for q in QUESTIONS:
        doc_ref = col_ref.document()
        q_data = q.copy()
        q_data["id"] = doc_ref.id
        q_data["subtopic_id"] = "intro-to-database-systems" # Target subtopic
        # Also seed for other common one if needed, but sticking to intro for now
        
        batch.set(doc_ref, q_data)
        count += 1
        
    batch.commit()
    print(f"Seeded {count} new questions!")

if __name__ == "__main__":
    seed()
