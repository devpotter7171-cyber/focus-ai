import type { SqlChallenge } from "@/components/SqlPlayground";

/**
 * SQL challenges keyed by subtopic_id.
 *
 * Each challenge is a self-contained SQLite seed (DDL + INSERTs) plus a
 * reference query. The learner's query is auto-graded by comparing
 * result-sets (set semantics — column/row order ignored).
 *
 * Starter set — extend as we add more SQL-heavy subtopics.
 */
export const SQL_CHALLENGES: Record<string, SqlChallenge> = {
    "introduction-to-sql": {
        id: "intro-sql-select",
        title: "Your first SELECT",
        prompt:
            "Return every row in the `employees` table. SQL's most basic query.",
        seed: `
            CREATE TABLE employees (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                department TEXT,
                salary INTEGER
            );
            INSERT INTO employees VALUES
                (1, 'Alice',  'Engineering', 95000),
                (2, 'Bob',    'Sales',       62000),
                (3, 'Carol',  'Engineering', 88000),
                (4, 'David',  'HR',          54000),
                (5, 'Eve',    'Sales',       71000);
        `,
        starter: "SELECT  FROM employees;",
        expectedQuery: "SELECT * FROM employees;",
        hint: "Use SELECT * to fetch every column.",
    },

    "dml-operations": {
        id: "dml-update-salary",
        title: "Filter and project",
        prompt:
            "Return the names of every employee whose salary is at least 70 000.",
        seed: `
            CREATE TABLE employees (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                department TEXT,
                salary INTEGER
            );
            INSERT INTO employees VALUES
                (1, 'Alice',  'Engineering', 95000),
                (2, 'Bob',    'Sales',       62000),
                (3, 'Carol',  'Engineering', 88000),
                (4, 'David',  'HR',          54000),
                (5, 'Eve',    'Sales',       71000);
        `,
        starter: "SELECT  FROM employees WHERE ;",
        expectedQuery: "SELECT name FROM employees WHERE salary >= 70000;",
        hint: "WHERE filters rows; selecting only `name` projects one column.",
    },

    "binary-relational-operations": {
        id: "join-departments",
        title: "Inner join",
        prompt:
            "List each employee's name alongside their department's location. Use a JOIN.",
        seed: `
            CREATE TABLE departments (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                location TEXT
            );
            CREATE TABLE employees (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                dept_id INTEGER REFERENCES departments(id)
            );
            INSERT INTO departments VALUES
                (1, 'Engineering', 'Bangalore'),
                (2, 'Sales',       'Mumbai'),
                (3, 'HR',          'Delhi');
            INSERT INTO employees VALUES
                (1, 'Alice', 1),
                (2, 'Bob',   2),
                (3, 'Carol', 1),
                (4, 'David', 3);
        `,
        starter:
            "SELECT e.name, d.location\nFROM employees e\nJOIN  ON ;",
        expectedQuery:
            "SELECT e.name, d.location FROM employees e JOIN departments d ON e.dept_id = d.id;",
        hint: "Join on `e.dept_id = d.id`.",
    },

    "relational-algebra-queries": {
        id: "aggregate-by-dept",
        title: "GROUP BY + aggregate",
        prompt:
            "For each department, return the average salary, rounded to the nearest integer. Output columns: `department, avg_salary`.",
        seed: `
            CREATE TABLE employees (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                department TEXT,
                salary INTEGER
            );
            INSERT INTO employees VALUES
                (1, 'Alice',  'Engineering', 95000),
                (2, 'Bob',    'Sales',       62000),
                (3, 'Carol',  'Engineering', 88000),
                (4, 'David',  'HR',          54000),
                (5, 'Eve',    'Sales',       71000);
        `,
        starter:
            "SELECT department, ROUND(AVG(salary)) AS avg_salary\nFROM employees\nGROUP BY ;",
        expectedQuery:
            "SELECT department, ROUND(AVG(salary)) AS avg_salary FROM employees GROUP BY department;",
        hint: "Group by `department`.",
    },

    "normal-forms-1nf-3nf": {
        id: "find-3nf-violations",
        title: "Spotting transitive dependencies",
        prompt:
            "The `enrollments_bad` table has a transitive dependency (student_id → student_name). " +
            "Return the distinct student rows you'd extract into a separate `students` table — " +
            "two columns: `student_id, student_name`.",
        seed: `
            CREATE TABLE enrollments_bad (
                enrollment_id INTEGER PRIMARY KEY,
                student_id INTEGER,
                student_name TEXT,
                course_code TEXT
            );
            INSERT INTO enrollments_bad VALUES
                (1, 101, 'Alice', 'CS101'),
                (2, 101, 'Alice', 'MA210'),
                (3, 102, 'Bob',   'CS101'),
                (4, 103, 'Carol', 'CS101'),
                (5, 103, 'Carol', 'MA210');
        `,
        starter:
            "SELECT DISTINCT student_id, student_name\nFROM enrollments_bad\n;",
        expectedQuery:
            "SELECT DISTINCT student_id, student_name FROM enrollments_bad;",
        hint: "DISTINCT eliminates duplicate (id, name) pairs.",
    },
};

/** Convenience lookup from subtopic_id. */
export function getSqlChallenge(subtopicId: string | undefined | null): SqlChallenge | null {
    if (!subtopicId) return null;
    return SQL_CHALLENGES[subtopicId] ?? null;
}
