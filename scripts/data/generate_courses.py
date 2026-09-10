"""
Generate 5 new CS courses and seed them to Firestore.

Uses OpenRouter free models (via the existing OPENROUTER_API_KEY) for
generation, avoiding Gemini's restrictive daily quota.
Falls back through free models: GPT-OSS-120B → Llama 3.3 70B → Qwen3 80B
"""
import asyncio
import json
import logging
import re
import sys
import time
from typing import Dict, Any, List
from dotenv import load_dotenv
load_dotenv()

import httpx
import os
from database import get_db
from firebase_admin import firestore

logging.basicConfig(level=logging.INFO, stream=sys.stdout,
                    format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# OpenRouter config
OPENROUTER_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions"

# Free models ranked by quality for course generation
FREE_MODELS = [
    "openai/gpt-oss-120b:free",
    "nvidia/nemotron-3-nano-30b-a3b:free",
    "qwen/qwen3-next-80b-a3b-instruct:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "nousresearch/hermes-3-llama-3.1-405b:free",
    "qwen/qwen3-coder-480b-a35b:free",
    "openai/gpt-oss-20b:free",
    "nvidia/nemotron-nano-9b-v2:free",
    "nvidia/nemotron-nano-12b-2-vl:free",
    "meta-llama/llama-3.2-3b-instruct:free",
    "venice/dolphin-mistral-24b:free",
    "liquid/lfm2.5-1.2b-instruct:free",
]

# Rate limiting
_last_call = [0.0]
_MIN_INTERVAL = 1.5  # 1.5s between calls


async def call_llm_json(prompt: str, label: str, max_retries: int = 2) -> Dict[str, Any]:
    """Call OpenRouter with JSON output, trying free models in sequence.
    On total failure, waits 60s and retries once."""
    for attempt in range(max_retries + 1):
        # Rate limit
        elapsed = time.time() - _last_call[0]
        if elapsed < _MIN_INTERVAL:
            await asyncio.sleep(_MIN_INTERVAL - elapsed)
        _last_call[0] = time.time()

        headers = {
            "Authorization": f"Bearer {OPENROUTER_KEY}",
            "HTTP-Referer": "https://focus-ai.demo",
            "X-Title": "Focus-AI Course Gen",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=90.0) as client:
            for model in FREE_MODELS:
                try:
                    payload = {
                        "model": model,
                        "messages": [
                            {"role": "system", "content": "You are a curriculum designer. Output ONLY valid JSON. No markdown fences, no extra text, no code blocks. Just raw JSON."},
                            {"role": "user", "content": prompt},
                        ],
                        "temperature": 0.3,
                        "max_tokens": 3000,
                    }
                    resp = await client.post(OPENROUTER_BASE, json=payload, headers=headers)

                    if resp.status_code == 429:
                        await asyncio.sleep(3)
                        continue
                    if resp.status_code >= 400:
                        continue

                    data = resp.json()
                    text = (data.get("choices", [{}])[0].get("message", {}).get("content", "")).strip()

                    # Strip markdown fences if present
                    if text.startswith("```"):
                        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE | re.DOTALL).strip()
                    if text and text[0] != '{':
                        idx = text.find('{')
                        if idx >= 0:
                            text = text[idx:]
                    if text and text[-1] != '}':
                        idx = text.rfind('}')
                        if idx >= 0:
                            text = text[:idx+1]

                    result = json.loads(text)
                    logger.info(f"  [{label}] OK via {model.split('/')[1].split(':')[0]}")
                    return result

                except json.JSONDecodeError:
                    continue
                except Exception:
                    continue

        # All models failed this attempt. Wait and retry.
        if attempt < max_retries:
            wait = 60 * (attempt + 1)
            logger.warning(f"  [{label}] All models failed. Waiting {wait}s before retry {attempt+2}...")
            await asyncio.sleep(wait)

    raise RuntimeError(f"All models failed for {label} after {max_retries+1} attempts")


async def call_llm_text(prompt: str, label: str) -> str:
    """Call OpenRouter for plain text output. Retries on total failure."""
    for attempt in range(3):
        elapsed = time.time() - _last_call[0]
        if elapsed < _MIN_INTERVAL:
            await asyncio.sleep(_MIN_INTERVAL - elapsed)
        _last_call[0] = time.time()

        headers = {
            "Authorization": f"Bearer {OPENROUTER_KEY}",
            "HTTP-Referer": "https://focus-ai.demo",
            "X-Title": "Focus-AI Course Gen",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=90.0) as client:
            for model in FREE_MODELS[:5]:
                try:
                    payload = {
                        "model": model,
                        "messages": [
                            {"role": "system", "content": "You are a curriculum content writer. Write clear educational content in Markdown format."},
                            {"role": "user", "content": prompt},
                        ],
                        "temperature": 0.5,
                        "max_tokens": 1500,
                    }
                    resp = await client.post(OPENROUTER_BASE, json=payload, headers=headers)
                    if resp.status_code == 429:
                        await asyncio.sleep(3)
                        continue
                    if resp.status_code >= 400:
                        continue

                    data = resp.json()
                    text = (data.get("choices", [{}])[0].get("message", {}).get("content", "")).strip()
                    if text and len(text) > 50:
                        logger.info(f"  [{label}] OK ({len(text)} chars)")
                        return text
                except:
                    continue

        # All failed — wait and retry
        if attempt < 2:
            wait = 45 * (attempt + 1)
            logger.warning(f"  [{label}] All models failed. Waiting {wait}s...")
            await asyncio.sleep(wait)

    return f"# {label}\n\nContent forthcoming."


def slugify(text: str, max_len: int = 50) -> str:
    s = re.sub(r"[^a-zA-Z0-9\s-]", "", text or "").strip().lower()
    s = re.sub(r"\s+", "-", s)
    return s[:max_len].strip("-") or "untitled"
logger = logging.getLogger(__name__)

# ─── Course source texts (condensed curriculum outlines) ─────────────────────
# These act as the "PDF text" input to the course gen pipeline.
# They're structured enough to guide the AI but open enough for it to
# generate rich, original content at all 5 levels.

COURSE_SOURCES = {
    "dsa": {
        "name": "Data Structures & Algorithms",
        "text": """
Data Structures and Algorithms - Complete Curriculum

Unit 1: Arrays and Strings
- Array fundamentals: declaration, indexing, traversal, time complexity
- String manipulation: reversal, palindrome, anagram detection
- Two-pointer technique and sliding window
- Sorting algorithms: Bubble, Selection, Insertion, Merge Sort, Quick Sort
- Searching: Linear search, Binary search, time complexity analysis

Unit 2: Linked Lists and Stacks
- Singly linked list: insertion, deletion, reversal
- Doubly linked list and circular linked list
- Stack data structure: push, pop, peek, applications
- Queue: enqueue, dequeue, circular queue, priority queue
- Applications: expression evaluation, parenthesis matching, BFS

Unit 3: Trees and Graphs
- Binary trees: traversal (inorder, preorder, postorder), height, depth
- Binary Search Trees: insertion, deletion, search, balancing
- AVL trees and Red-Black trees (concepts)
- Graph representation: adjacency matrix, adjacency list
- Graph traversal: BFS, DFS, connected components
- Shortest path: Dijkstra's algorithm, Bellman-Ford

Unit 4: Advanced Algorithms
- Dynamic programming: memoization, tabulation, optimal substructure
- Classic DP problems: Fibonacci, knapsack, longest common subsequence
- Greedy algorithms: activity selection, Huffman coding
- Divide and conquer: merge sort analysis, closest pair of points
- Time and space complexity: Big-O, Big-Theta, Big-Omega, amortized analysis

Unit 5: Hashing and Advanced Data Structures
- Hash tables: hash functions, collision resolution (chaining, open addressing)
- Heaps: min-heap, max-heap, heap sort, priority queue implementation
- Trie data structure: prefix matching, autocomplete
- Disjoint Set Union (Union-Find): path compression, union by rank
- Applications: spell checker, IP routing, social network algorithms
"""
    },
    "os": {
        "name": "Operating Systems",
        "text": """
Operating Systems - Complete Curriculum

Unit 1: Introduction to Operating Systems
- What is an OS: definition, goals, types (batch, time-sharing, real-time)
- OS architecture: monolithic, microkernel, layered, modular
- System calls: interface between user programs and OS kernel
- Process concept: program vs process, process states, PCB
- Dual-mode operation: user mode vs kernel mode

Unit 2: Process Management
- Process scheduling: FCFS, SJF, Round Robin, Priority, Multilevel Queue
- CPU scheduling criteria: turnaround time, waiting time, response time
- Context switching: mechanism and overhead
- Threads: user-level vs kernel-level, multithreading models
- Inter-process communication: shared memory, message passing, pipes

Unit 3: Synchronization and Deadlocks
- Race conditions and critical section problem
- Synchronization primitives: mutex, semaphore, monitors
- Classic problems: producer-consumer, readers-writers, dining philosophers
- Deadlock: conditions, prevention, avoidance (Banker's algorithm)
- Deadlock detection and recovery strategies

Unit 4: Memory Management
- Memory hierarchy: registers, cache, RAM, disk
- Contiguous allocation: first fit, best fit, worst fit
- Paging: page table, TLB, multi-level paging
- Virtual memory: demand paging, page replacement (FIFO, LRU, Optimal)
- Thrashing: causes and working set model

Unit 5: File Systems and I/O
- File system concepts: files, directories, access methods
- File allocation methods: contiguous, linked, indexed
- Disk scheduling: FCFS, SSTF, SCAN, C-SCAN, LOOK
- I/O subsystem: buffering, caching, spooling
- RAID levels: 0, 1, 5, 6, 10 and their trade-offs
"""
    },
    "cn": {
        "name": "Computer Networks",
        "text": """
Computer Networks - Complete Curriculum

Unit 1: Network Fundamentals
- Introduction: types of networks (LAN, WAN, MAN), topologies
- OSI model: 7 layers, functions, protocols at each layer
- TCP/IP model: comparison with OSI, encapsulation
- Transmission media: twisted pair, coaxial, fiber optic, wireless
- Network devices: hub, switch, router, gateway, bridge

Unit 2: Data Link Layer
- Framing: character count, byte stuffing, bit stuffing
- Error detection: parity, CRC, checksum
- Error correction: Hamming code, forward error correction
- Flow control: stop-and-wait, sliding window (Go-Back-N, Selective Repeat)
- MAC protocols: ALOHA, CSMA/CD, CSMA/CA

Unit 3: Network Layer
- IP addressing: IPv4, subnetting, CIDR, classful and classless
- IPv6: address format, transition from IPv4
- Routing algorithms: distance vector, link state, path vector
- Routing protocols: RIP, OSPF, BGP
- NAT, DHCP, ICMP, ARP

Unit 4: Transport Layer
- TCP: connection setup (3-way handshake), flow control, congestion control
- UDP: connectionless communication, when to use UDP vs TCP
- Port numbers, multiplexing, demultiplexing
- TCP congestion control: slow start, congestion avoidance, fast retransmit
- Quality of Service: traffic shaping, scheduling, RSVP

Unit 5: Application Layer
- DNS: domain name resolution, hierarchy, record types
- HTTP/HTTPS: request-response model, methods, status codes, cookies
- Email protocols: SMTP, POP3, IMAP
- FTP and SSH: file transfer and secure remote access
- Network security basics: firewalls, VPN, SSL/TLS, encryption
"""
    },
    "oop": {
        "name": "Object-Oriented Programming",
        "text": """
Object-Oriented Programming - Complete Curriculum (Java/Python examples)

Unit 1: Fundamentals of OOP
- Procedural vs object-oriented paradigm
- Classes and objects: attributes, methods, constructors
- Encapsulation: access modifiers (public, private, protected)
- Data hiding and getter/setter methods
- static members, this keyword, constructor overloading

Unit 2: Inheritance and Polymorphism
- Inheritance: single, multilevel, hierarchical inheritance
- Method overriding and super keyword
- Polymorphism: compile-time (overloading) vs runtime (overriding)
- Abstract classes and methods
- Interfaces: definition, implementation, multiple inheritance via interfaces

Unit 3: Advanced OOP Concepts
- Exception handling: try-catch-finally, custom exceptions, throw/throws
- Generics and type safety
- Collections framework: List, Set, Map, Iterator
- Lambda expressions and functional interfaces
- Design patterns introduction: Singleton, Factory, Observer

Unit 4: SOLID Principles and Design
- Single Responsibility Principle
- Open/Closed Principle
- Liskov Substitution Principle
- Interface Segregation Principle
- Dependency Inversion Principle
- Real-world application of SOLID in software design

Unit 5: Practical OOP Applications
- File I/O with objects: serialization, deserialization
- Multithreading: creating threads, synchronization, thread pools
- Unit testing: JUnit/pytest basics, test-driven development
- Building a mini-project: library management system or banking system
- Code review and refactoring patterns
"""
    },
    "se": {
        "name": "Software Engineering",
        "text": """
Software Engineering - Complete Curriculum

Unit 1: Introduction to Software Engineering
- Software crisis and need for engineering discipline
- Software Development Life Cycle (SDLC) overview
- Software process models: Waterfall, Iterative, Spiral
- Agile methodology: Scrum, Kanban, XP, sprints
- DevOps: CI/CD, continuous integration, deployment pipelines

Unit 2: Requirements Engineering
- Requirements elicitation: interviews, surveys, observation
- Functional vs non-functional requirements
- Use case diagrams and user stories
- Software Requirements Specification (SRS) document
- Requirements validation and traceability

Unit 3: System Design
- Architectural design: client-server, microservices, monolithic, layered
- UML diagrams: class, sequence, activity, state, component
- Design patterns: MVC, Repository, Strategy, Observer, Adapter
- Database design: ER modeling, normalization, schema design
- API design: REST principles, versioning, documentation

Unit 4: Testing and Quality Assurance
- Testing levels: unit, integration, system, acceptance
- White-box testing: statement, branch, path coverage
- Black-box testing: equivalence partitioning, boundary value analysis
- Test automation: frameworks, continuous testing, regression testing
- Code quality metrics: cyclomatic complexity, code coverage, technical debt

Unit 5: Project Management and Maintenance
- Project planning: estimation (function points, COCOMO), scheduling
- Risk management: identification, analysis, mitigation
- Version control: Git workflows, branching strategies
- Software maintenance: corrective, adaptive, perfective, preventive
- Documentation: technical writing, API docs, user manuals
"""
    },
}


async def generate_and_seed_course(course_id: str, course_data: dict, db):
    """Generate a course using OpenRouter free models and seed to Firestore."""
    logger.info(f"{'=' * 60}")
    logger.info(f"GENERATING: {course_data['name']} ({course_id})")
    logger.info(f"{'=' * 60}")

    raw_text = course_data["text"]

    # Stage 1: Outline
    outline = await call_llm_json(f"""Read this curriculum text and produce a course outline.
Course title: "{course_data['name']}"
Produce exactly 4-5 units. Output STRICT JSON:
{{"title": str, "description": str, "units": [{{"title": str, "description": str}}]}}

Source:
{raw_text[:8000]}""", "outline")

    units_in = outline.get("units", [])
    if not units_in:
        logger.error("  No units generated!")
        return False

    logger.info(f"  Outline: {len(units_in)} units")

    # Stage 2: Subtopics per unit
    all_subtopics = []
    for u_idx, unit in enumerate(units_in, 1):
        subs = await call_llm_json(f"""Design exactly 3-4 subtopics for this unit.
Unit: "{unit.get('title', '')}"
Description: "{unit.get('description', '')}"
Output STRICT JSON: {{"subtopics": [{{"title": str, "description": str}}]}}""", f"subs_u{u_idx}")

        for s_idx, sub in enumerate(subs.get("subtopics", [])[:4], 1):
            sub_id = slugify(sub.get("title", f"topic-{s_idx}"))
            all_subtopics.append({
                "id": sub_id,
                "unit_id": f"u{u_idx}",
                "unit_idx": u_idx,
                "title": sub.get("title", ""),
                "description": sub.get("description", ""),
                "order": s_idx,
            })

    logger.info(f"  Subtopics: {len(all_subtopics)} total")

    # Seed course + units to Firestore IMMEDIATELY (so we don't lose progress)
    logger.info(f"  Seeding course skeleton...")
    course_ref = db.collection("courses").document(course_id)
    course_ref.set({
        "id": course_id,
        "title": outline.get("title", course_data["name"]),
        "description": outline.get("description", ""),
        "is_published": True,
        "ai_generated": True,
        "total_units": len(units_in),
    })
    for u_idx, unit in enumerate(units_in, 1):
        uid = f"u{u_idx}"
        course_ref.collection("units").document(uid).set({
            "id": uid,
            "title": unit.get("title", f"Unit {u_idx}"),
            "description": unit.get("description", ""),
            "order": u_idx,
        })

    # Stage 3: Content levels (ONE LEVEL AT A TIME as plain text - avoids JSON failures)
    # Seed each subtopic immediately after its content is generated
    LEVEL_PROMPTS = {
        "1": "Write an expert-level explanation (200-300 words, formal, rigorous, precise terminology)",
        "2": "Write a detailed textbook-style explanation (200-300 words, accessible but complete)",
        "3": "Write a concise key-points summary (150-200 words, bullet points, skim-friendly)",
        "4": "Write a real-world application example (200-300 words, concrete worked example or case study)",
        "5": "Write a beginner-friendly analogy explanation (150-250 words, simple metaphor, no jargon)",
    }

    for sub in all_subtopics:
        # Check if this subtopic already exists (resume support)
        sub_ref = (course_ref.collection("units")
                   .document(sub["unit_id"])
                   .collection("subtopics")
                   .document(sub["id"]))
        if sub_ref.get().exists:
            logger.info(f"  Skipping {sub['id']} (already exists)")
            continue

        levels = {}
        for lvl, instruction in LEVEL_PROMPTS.items():
            content = await call_llm_text(
                f"""{instruction} for the following topic.
Topic: {sub['title']}
Brief: {sub['description']}
Context: This is part of a course on {course_data['name']}, unit "{units_in[sub['unit_idx']-1].get('title','')}"
Write in Markdown with headings. Do NOT wrap in JSON or code fences.""",
                f"L{lvl}_{sub['id'][:20]}"
            )
            levels[lvl] = content

        sub["content"] = levels.get("1", f"# {sub['title']}\n\nContent forthcoming.")
        sub["content_levels"] = levels

        # SEED THIS SUBTOPIC IMMEDIATELY
        sub_ref.set({
            "id": sub["id"],
            "title": sub["title"],
            "content": sub["content"],
            "content_levels": sub.get("content_levels", {}),
            "order": sub["order"],
        })
        logger.info(f"  Seeded subtopic: {sub['id']}")

    # Stage 4: Questions (3 per subtopic)
    all_questions = []
    for sub in all_subtopics:
        qs = await call_llm_json(f"""Write 3 multiple-choice questions for this subtopic.
Subtopic: "{sub['title']}"
Content: {sub['content'][:2000]}

Each question has 4 options. correct_answer is the 0-based index.
Output STRICT JSON: {{"questions": [{{"question_text": str, "options": [str,str,str,str], "correct_answer": int, "difficulty": "easy"|"medium"|"hard"}}]}}""", f"qs_{sub['id']}")

        for i, q in enumerate(qs.get("questions", [])[:3], 1):
            qid = f"q_{sub['id'][:12]}_{i:03d}"
            ca = q.get("correct_answer", 0)
            if isinstance(ca, str):
                try:
                    ca = q.get("options", []).index(ca)
                except:
                    ca = 0
            all_questions.append({
                "id": qid,
                "unit_id": sub["unit_id"],
                "subtopic_id": sub["id"],
                "question_text": q.get("question_text", "Question"),
                "options": q.get("options", ["A", "B", "C", "D"])[:4],
                "correct_answer": max(0, min(3, int(ca))),
                "difficulty": q.get("difficulty", "medium"),
                "skill_tags": [slugify(sub["title"])[:20]],
            })

    logger.info(f"  Questions: {len(all_questions)} total")

    # Seed questions
    for q in all_questions:
        db.collection("quiz").document(course_id).collection("questions").document(q["id"]).set(q)

    logger.info(f"  DONE! {len(units_in)} units, {len(all_subtopics)} subtopics, {len(all_questions)} questions.")
    return True


async def main():
    db = next(get_db())

    # Check which courses already exist
    existing = set()
    for doc in db.collection("courses").stream():
        existing.add(doc.id)
    logger.info(f"Existing courses: {existing}")

    success = 0
    failed = 0

    for course_id, course_data in COURSE_SOURCES.items():
        if course_id in existing:
            logger.info(f"Skipping {course_id} (already exists)")
            success += 1
            continue

        try:
            ok = await generate_and_seed_course(course_id, course_data, db)
            if ok:
                success += 1
            else:
                failed += 1
        except Exception as e:
            logger.error(f"Exception generating {course_id}: {e}")
            failed += 1

    logger.info(f"\n{'=' * 60}")
    logger.info(f"COMPLETE: {success} succeeded, {failed} failed")
    logger.info(f"{'=' * 60}")


if __name__ == "__main__":
    asyncio.run(main())
