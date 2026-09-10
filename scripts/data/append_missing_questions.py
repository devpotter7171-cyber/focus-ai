"""
Append questions for the 16 subtopics that currently have none.

Each new question follows the existing seed schema:
{
  "id", "unit_id", "subtopic_id", "question_text",
  "options" (list[str]), "correct_answer" (int index),
  "difficulty" ("easy" | "medium" | "hard"),
  "skill_tags" (list[str]),
  "textbook_reference" (one of the allowed list)
}

Run from project root:
    backend\.venv\Scripts\python.exe scripts\data\append_missing_questions.py
"""
import json
from pathlib import Path

SEED_FILE = Path(__file__).resolve().parents[2] / "seed" / "dbms_questions.json"

REF_ELMASRI = "Elmasri & Navathe"
REF_FOWLER = "Pramod J Sadalage & Martin Fowler"
REF_RAGHU = "Raghu Ramakrishnan & Johannes Gehrke"
REF_SEEMA = "Seema Acharya"


def make(qid, unit, subtopic, text, options, correct, diff="medium", tags=None, ref=REF_ELMASRI):
    return {
        "id": qid,
        "unit_id": unit,
        "subtopic_id": subtopic,
        "question_text": text,
        "options": options,
        "correct_answer": correct,
        "difficulty": diff,
        "skill_tags": tags or [subtopic.replace("-", "_")],
        "textbook_reference": ref,
    }


NEW_QUESTIONS = [
    # ---------------- intro-to-database-systems (u1) ----------------
    make("q_intro_001", "u1", "intro-to-database-systems",
         "Which of the following is the primary advantage of using a DBMS over a flat-file system?",
         [
             "Faster CPU execution speed",
             "Reduced data redundancy and improved consistency",
             "Smaller program file sizes",
             "Direct access to physical disk sectors",
         ], 1, "easy",
         ["dbms_basics", "data_independence"]),
    make("q_intro_002", "u1", "intro-to-database-systems",
         "Who is primarily responsible for authorizing access and monitoring use of the database?",
         [
             "End User",
             "Application Programmer",
             "Database Administrator (DBA)",
             "Database Designer",
         ], 2, "easy",
         ["dbms_roles"]),
    make("q_intro_003", "u1", "intro-to-database-systems",
         "Which characteristic of the database approach allows the structure of data to change without requiring changes to application programs?",
         [
             "Self-describing nature",
             "Data abstraction",
             "Program-data independence",
             "Concurrency control",
         ], 2, "medium",
         ["data_independence"]),

    # ---------------- data-models-schemas (u1) ----------------
    make("q_dms_001", "u1", "data-models-schemas",
         "In the three-schema architecture, which level describes how data is physically stored?",
         ["External level", "Conceptual level", "Internal level", "Application level"],
         2, "easy", ["three_schema"]),
    make("q_dms_002", "u1", "data-models-schemas",
         "Logical data independence is the ability to change which schema without affecting the others above it?",
         ["External", "Conceptual", "Internal", "Physical storage"],
         1, "medium", ["data_independence"]),
    make("q_dms_003", "u1", "data-models-schemas",
         "Which category of data model is the Entity-Relationship model?",
         [
             "Physical / low-level",
             "Implementation / representational",
             "Conceptual / high-level",
             "View-level",
         ], 2, "easy", ["data_models"]),

    # ---------------- refining-er-design (u2) ----------------
    make("q_refer_001", "u2", "refining-er-design",
         "If an attribute has its own properties (e.g. street, city, zip), it is usually best modelled as:",
         ["A simple attribute", "A multi-valued attribute", "A separate entity", "A derived attribute"],
         2, "medium", ["er_refinement"]),
    make("q_refer_002", "u2", "refining-er-design",
         "Which is a *redundant* relationship in an ER diagram?",
         [
             "A relationship that already follows from a chain of other relationships",
             "A relationship that has more than two participating entities",
             "A relationship with total participation",
             "A relationship between weak and strong entity types",
         ], 0, "medium", ["er_refinement"]),
    make("q_refer_003", "u2", "refining-er-design",
         "Per standard naming conventions, relationship types are best named as:",
         ["Singular nouns", "Plural nouns", "Verbs or verb phrases", "Lowercase abbreviations"],
         2, "easy", ["er_naming"]),

    # ---------------- update-operations (u2) ----------------
    make("q_upd_001", "u2", "update-operations",
         "What does the CASCADE option do when a referenced row is deleted?",
         [
             "Rejects the delete operation",
             "Sets the foreign key to NULL",
             "Propagates the delete to all related child rows",
             "Logs the violation but allows the delete",
         ], 2, "medium", ["referential_integrity"]),
    make("q_upd_002", "u2", "update-operations",
         "Inserting a row whose foreign key value does not exist in the parent table violates which constraint?",
         ["Entity integrity", "Domain", "Referential integrity", "Key uniqueness"],
         2, "easy", ["referential_integrity"]),
    make("q_upd_003", "u2", "update-operations",
         "Which operation does NOT change the state of the database?",
         ["INSERT", "UPDATE", "DELETE", "SELECT"],
         3, "easy", ["dml_basics"]),

    # ---------------- unary-relational-operations (u2) ----------------
    make("q_unary_001", "u2", "unary-relational-operations",
         "Which relational algebra operation filters tuples (rows) based on a predicate?",
         ["PROJECT (π)", "SELECT (σ)", "JOIN (⋈)", "UNION (∪)"],
         1, "easy", ["relational_algebra"]),
    make("q_unary_002", "u2", "unary-relational-operations",
         "Which relational algebra operation chooses specific attributes (columns) and removes duplicates?",
         ["SELECT (σ)", "PROJECT (π)", "RENAME (ρ)", "DIVISION (÷)"],
         1, "easy", ["relational_algebra"]),
    make("q_unary_003", "u2", "unary-relational-operations",
         "If a relation has 100 tuples, the result of σ_condition(R) is at most how many tuples?",
         ["Exactly 100", "Exactly 1", "At most 100", "Always 0"],
         2, "medium", ["relational_algebra", "cardinality"]),

    # ---------------- relational-algebra-set-theory (u2) ----------------
    make("q_setalg_001", "u2", "relational-algebra-set-theory",
         "Two relations are *union-compatible* when they:",
         [
             "Have the same number of tuples",
             "Have the same degree and compatible domains",
             "Share at least one common attribute name",
             "Are stored in the same disk file",
         ], 1, "medium", ["set_operations", "union_compatibility"]),
    make("q_setalg_002", "u2", "relational-algebra-set-theory",
         "Which set operation is NOT commutative?",
         ["UNION", "INTERSECTION", "SET DIFFERENCE", "CARTESIAN PRODUCT"],
         2, "medium", ["set_operations"]),
    make("q_setalg_003", "u2", "relational-algebra-set-theory",
         "R ∩ S returns:",
         [
             "Tuples in R or S or both",
             "Tuples in R but not in S",
             "Tuples present in both R and S",
             "All combinations of tuples from R and S",
         ], 2, "easy", ["set_operations"]),

    # ---------------- binary-relational-operations (u2) ----------------
    make("q_binary_001", "u2", "binary-relational-operations",
         "If R has n tuples and S has m tuples, R × S (Cartesian product) has how many tuples?",
         ["n + m", "max(n, m)", "n × m", "n - m"],
         2, "easy", ["cartesian_product"]),
    make("q_binary_002", "u2", "binary-relational-operations",
         "A natural join differs from a theta-join because:",
         [
             "It joins on attributes with the same name and removes duplicate columns",
             "It always uses inequality conditions",
             "It produces the Cartesian product",
             "It only works on tables with no foreign keys",
         ], 0, "medium", ["join_types"]),
    make("q_binary_003", "u2", "binary-relational-operations",
         'Which operation is used for "find students who took ALL courses offered by Prof. X"?',
         ["JOIN", "DIVISION", "UNION", "PROJECT"],
         1, "hard", ["division", "relational_algebra"]),

    # ---------------- relational-algebra-queries (u2) ----------------
    make("q_raq_001", "u2", "relational-algebra-queries",
         "Which heuristic optimisation typically reduces query cost the most?",
         [
             "Pushing SELECT (σ) operations down the tree",
             "Performing JOIN before SELECT",
             "Computing the Cartesian product first",
             "Using PROJECT only at the very end",
         ], 0, "medium", ["query_optimization"]),
    make("q_raq_002", "u2", "relational-algebra-queries",
         "Which expression is equivalent to π_name(σ_age>25(Student))?",
         [
             "σ_name(π_age>25(Student))",
             "Project name first, then filter on age",
             "Filter rows on age>25, then project the name column",
             "Cross-product of Student with itself",
         ], 2, "medium", ["relational_algebra"]),
    make("q_raq_003", "u2", "relational-algebra-queries",
         "In an evaluation tree, the leaves represent:",
         ["Final result", "Intermediate joins", "Input relations", "User credentials"],
         2, "easy", ["query_evaluation"]),

    # ---------------- dml-operations (u3) ----------------
    make("q_dml_001", "u3", "dml-operations",
         "Which clause limits the rows shown by a SELECT query?",
         ["GROUP BY", "ORDER BY", "WHERE", "HAVING"],
         2, "easy", ["sql_select"]),
    make("q_dml_002", "u3", "dml-operations",
         "What does HAVING do that WHERE cannot?",
         [
             "Filter individual rows",
             "Filter rows after a GROUP BY aggregation",
             "Sort the result set",
             "Limit the number of returned rows",
         ], 1, "medium", ["sql_aggregation"]),
    make("q_dml_003", "u3", "dml-operations",
         "What is the safest way to inject user input into a SQL query from application code?",
         [
             "String concatenation",
             "Parameterised / prepared statements",
             "Stored as JSON",
             "Escaping single quotes manually",
         ], 1, "medium", ["sql_security", "sql_injection"]),

    # ---------------- functional-dependencies (u3) ----------------
    make("q_fd_001", "u3", "functional-dependencies",
         "If X → Y and Y → Z, then X → Z. This is which inference rule?",
         ["Reflexive", "Augmentation", "Transitivity", "Decomposition"],
         2, "easy", ["functional_dependencies", "armstrongs_axioms"]),
    make("q_fd_002", "u3", "functional-dependencies",
         "Which functional dependency is *trivial*?",
         [
             "Name → SSN",
             "{SSN, Name} → Name",
             "DOB → Age",
             "Salary → Name",
         ], 1, "medium", ["functional_dependencies"]),
    make("q_fd_003", "u3", "functional-dependencies",
         "An attribute that uniquely determines all other attributes in a relation is called a:",
         ["Foreign key", "Superkey", "Composite attribute", "Multi-valued attribute"],
         1, "medium", ["keys", "functional_dependencies"]),

    # ---------------- bcnf-decompositions (u3) ----------------
    make("q_bcnf_001", "u3", "bcnf-decompositions",
         "A relation is in BCNF if for every non-trivial dependency X → A:",
         [
             "X is a superkey",
             "A is part of a candidate key",
             "X is not a key",
             "A is a multi-valued attribute",
         ], 0, "medium", ["bcnf"]),
    make("q_bcnf_002", "u3", "bcnf-decompositions",
         "Which property guarantees that joining the decomposed tables reproduces the original relation?",
         [
             "Dependency preservation",
             "Lossless-join property",
             "Atomicity",
             "Referential integrity",
         ], 1, "medium", ["decomposition"]),
    make("q_bcnf_003", "u3", "bcnf-decompositions",
         "A relation is always in 3NF if it is in:",
         ["1NF", "2NF only", "BCNF", "0NF"],
         2, "medium", ["normal_forms"]),

    # ---------------- schedules-serializability (u4) ----------------
    make("q_sched_001", "u4", "schedules-serializability",
         "Two operations from different transactions *conflict* when:",
         [
             "Both are reads on the same item",
             "They access different items",
             "They access the same item and at least one is a write",
             "They run in parallel on the same CPU",
         ], 2, "medium", ["serializability", "conflicts"]),
    make("q_sched_002", "u4", "schedules-serializability",
         "Which best describes a serializable schedule?",
         [
             "Operations of each transaction run consecutively without interleaving",
             "An interleaved schedule whose result is equivalent to some serial schedule",
             "Any schedule that finishes within the deadline",
             "A schedule with no read operations",
         ], 1, "medium", ["serializability"]),
    make("q_sched_003", "u4", "schedules-serializability",
         "Why are serial schedules correct but undesirable?",
         [
             "They may produce wrong results",
             "They are correct but achieve no concurrency, hurting throughput",
             "They cannot be tested for serializability",
             "They violate the ACID properties",
         ], 1, "easy", ["serializability"]),

    # ---------------- testing-serializability (u4) ----------------
    make("q_test_001", "u4", "testing-serializability",
         "A schedule is conflict-serializable iff its precedence graph is:",
         ["Cyclic", "Acyclic", "Bipartite", "Connected"],
         1, "medium", ["precedence_graph"]),
    make("q_test_002", "u4", "testing-serializability",
         "In the precedence graph, an edge from Ti to Tj means:",
         [
             "Ti committed before Tj",
             "Ti has an operation that conflicts with and precedes one in Tj",
             "Tj depends on Ti's lock manager",
             "Ti and Tj are merged into one transaction",
         ], 1, "medium", ["precedence_graph"]),
    make("q_test_003", "u4", "testing-serializability",
         "A cycle in the precedence graph implies:",
         [
             "The schedule is conflict-serializable",
             "The schedule is NOT conflict-serializable",
             "A deadlock has already occurred",
             "All transactions read the same item",
         ], 1, "easy", ["precedence_graph"]),

    # ---------------- concurrency-control (u4) ----------------
    make("q_cc_001", "u4", "concurrency-control",
         "In two-phase locking (2PL), once a transaction *releases* a lock, it:",
         [
             "May acquire new locks freely",
             "May acquire shared locks only",
             "May not acquire any new locks",
             "Must abort immediately",
         ], 2, "medium", ["two_phase_locking"]),
    make("q_cc_002", "u4", "concurrency-control",
         "Which locking variant prevents cascading aborts?",
         [
             "Basic 2PL",
             "Conservative 2PL",
             "Strict 2PL",
             "Optimistic concurrency",
         ], 2, "hard", ["two_phase_locking"]),
    make("q_cc_003", "u4", "concurrency-control",
         "An exclusive (X) lock prevents:",
         [
             "Both reads and writes by other transactions",
             "Only writes by other transactions",
             "Only reads by other transactions",
             "Nothing — it is advisory only",
         ], 0, "easy", ["locking"]),

    # ---------------- distribution-models (u5) ----------------
    make("q_dist_001", "u5", "distribution-models",
         "Sharding refers to:",
         [
             "Replicating the same data across many nodes",
             "Splitting the dataset across multiple nodes by key",
             "Compressing data on disk",
             "Encrypting data in transit",
         ], 1, "easy", ["sharding"], REF_FOWLER),
    make("q_dist_002", "u5", "distribution-models",
         "Master-slave replication is best suited for:",
         [
             "Write-heavy workloads",
             "Read-heavy workloads where reads can be served by replicas",
             "Single-node systems",
             "Encrypted message queues",
         ], 1, "medium", ["replication"], REF_FOWLER),
    make("q_dist_003", "u5", "distribution-models",
         "Which is a tradeoff of peer-to-peer (multi-master) replication?",
         [
             "It cannot scale beyond two nodes",
             "Conflict resolution becomes harder when concurrent writes occur",
             "Reads are slower than master-slave",
             "It eliminates the need for replication entirely",
         ], 1, "hard", ["replication", "consistency"], REF_FOWLER),

    # ---------------- big-data-architectures (u5) ----------------
    make("q_bd_001", "u5", "big-data-architectures",
         "The 3 Vs of Big Data are:",
         [
             "Velocity, Variety, Volume",
             "Validity, Volume, Vendor",
             "Volume, Voltage, Veracity",
             "Velocity, Vector, Vault",
         ], 0, "easy", ["big_data"], REF_FOWLER),
    make("q_bd_002", "u5", "big-data-architectures",
         "In MapReduce, the Reduce step typically:",
         [
             "Reads input from disk and tokenises it",
             "Aggregates intermediate (key, value) pairs grouped by key",
             "Compresses the data into a single file",
             "Schedules tasks across the cluster",
         ], 1, "medium", ["mapreduce"], REF_FOWLER),
    make("q_bd_003", "u5", "big-data-architectures",
         "Why is Spark generally faster than classical MapReduce?",
         [
             "It writes intermediate results to disk between every stage",
             "It performs in-memory computation across stages",
             "It runs on a single thread per node",
             "It avoids the use of clusters entirely",
         ], 1, "hard", ["spark", "mapreduce"], REF_FOWLER),
]


def main():
    existing = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    existing_ids = {q["id"] for q in existing}

    added, skipped = 0, 0
    for q in NEW_QUESTIONS:
        if q["id"] in existing_ids:
            skipped += 1
            continue
        existing.append(q)
        added += 1

    SEED_FILE.write_text(json.dumps(existing, indent=2), encoding="utf-8")

    print(f"Wrote {len(existing)} total questions to {SEED_FILE}")
    print(f"  Added: {added}  Skipped duplicates: {skipped}")


if __name__ == "__main__":
    main()
