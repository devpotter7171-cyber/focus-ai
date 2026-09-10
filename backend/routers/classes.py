"""
Class / cohort management.

Adds a lightweight "class" concept on top of the existing user + course
data so a teacher can group students together and see only their cohort
on the teacher dashboard.

Firestore layout
----------------
    classes/{class_id}                       # owner_uid, name, join_code, ...
        members/{user_id}                    # joined_at, status

Endpoints
---------
    GET    /classes/me                       list classes I own (teacher) /
                                              joined (student)
    POST   /classes                          create a class (teacher only)
    GET    /classes/{class_id}               get class meta + my membership
    GET    /classes/{class_id}/students      list students in a class
                                              (teacher only — owner)
    DELETE /classes/{class_id}/students/{uid} remove a student
                                              (teacher only — owner)
    POST   /classes/join                     student joins by code

Join codes are 6 chars, uppercase A-Z 2-9 (no confusing 0/O/1/I).
"""
from __future__ import annotations

import logging
import secrets
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool
from firebase_admin import firestore

from database import get_db
from routers.auth import get_current_user, require_teacher

logger = logging.getLogger(__name__)
router = APIRouter()

# ─── Helpers ────────────────────────────────────────────────────────────────

_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I confusion


def _new_join_code(n: int = 6) -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(n))


def _serialize_class(doc) -> Dict[str, Any]:
    d = doc.to_dict() or {}
    created = d.get("created_at")
    return {
        "id": doc.id,
        "name": d.get("name", ""),
        "description": d.get("description", ""),
        "course_id": d.get("course_id"),
        "owner_uid": d.get("owner_uid"),
        "owner_name": d.get("owner_name"),
        "join_code": d.get("join_code"),
        "member_count": int(d.get("member_count", 0)),
        "created_at": created.isoformat() if hasattr(created, "isoformat") else None,
    }


# ─── Pydantic models ────────────────────────────────────────────────────────

class CreateClassRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    description: str = Field("", max_length=500)
    course_id: str | None = None


class JoinClassRequest(BaseModel):
    code: str = Field(..., min_length=4, max_length=12)


# ─── Routes ─────────────────────────────────────────────────────────────────

@router.post("")
async def create_class(
    body: CreateClassRequest,
    teacher = Depends(require_teacher),
    db = Depends(get_db),
) -> Dict[str, Any]:
    """Create a new class. Teacher-only."""
    def _create():
        # Build a unique join code (retry up to 5 times in the very unlikely
        # case of a collision — alphabet space is 32^6 ≈ 1B).
        for _ in range(5):
            code = _new_join_code()
            existing = (
                db.collection("classes")
                  .where(field_path="join_code", op_string="==", value=code)
                  .limit(1)
                  .stream()
            )
            if not list(existing):
                break
        else:
            raise HTTPException(status_code=500, detail="Could not allocate join code")

        # Pick a stable, readable id.
        slug = "cls_" + secrets.token_hex(4)
        ref = db.collection("classes").document(slug)

        owner_doc = db.collection("users").document(teacher["uid"]).get()
        owner_name = (owner_doc.to_dict() or {}).get("full_name") if owner_doc.exists else None

        ref.set({
            "id": slug,
            "name": body.name.strip(),
            "description": body.description.strip(),
            "course_id": body.course_id,
            "owner_uid": teacher["uid"],
            "owner_name": owner_name,
            "owner_email": teacher.get("email"),
            "join_code": code,
            "member_count": 0,
            "student_uids": [],
            "created_at": firestore.SERVER_TIMESTAMP,
        })
        return ref.get()

    doc = await run_in_threadpool(_create)
    return _serialize_class(doc)


@router.get("/me")
async def list_my_classes(
    current_user = Depends(get_current_user),
    db = Depends(get_db),
) -> Dict[str, Any]:
    """
    List classes relevant to the caller.

    - Teachers / admins: classes they own.
    - Students: classes they've joined.
    """
    uid = current_user.get("uid")

    def _resolve_role():
        doc = db.collection("users").document(uid).get()
        return (doc.to_dict() or {}).get("role", "student") if doc.exists else "student"

    role = await run_in_threadpool(_resolve_role)

    def _list_owned():
        q = db.collection("classes").where(
            field_path="owner_uid", op_string="==", value=uid,
        )
        return [_serialize_class(d) for d in q.stream()]

    def _list_joined():
        # Use a denormalized `student_uids` array on the class doc so we
        # can list joined classes with a single `array_contains` query and
        # avoid needing a collection-group index in Firestore.
        q = db.collection("classes").where(
            field_path="student_uids", op_string="array_contains", value=uid,
        )
        return [_serialize_class(d) for d in q.stream()]

    if role in ("teacher", "admin"):
        owned = await run_in_threadpool(_list_owned)
        return {"role": role, "owned": owned, "joined": []}

    joined = await run_in_threadpool(_list_joined)
    return {"role": role, "owned": [], "joined": joined}


@router.get("/{class_id}")
async def get_class(
    class_id: str,
    current_user = Depends(get_current_user),
    db = Depends(get_db),
) -> Dict[str, Any]:
    """Get a class. Visible to the owner and to any member."""
    uid = current_user.get("uid")

    def _load():
        ref = db.collection("classes").document(class_id)
        snap = ref.get()
        if not snap.exists:
            raise HTTPException(status_code=404, detail="Class not found")
        meta = _serialize_class(snap)

        # Membership check: owner sees it, otherwise must be a member.
        is_owner = meta["owner_uid"] == uid
        member_doc = ref.collection("members").document(uid).get()
        if not is_owner and not member_doc.exists:
            raise HTTPException(status_code=403, detail="Not a member of this class")

        return {
            **meta,
            "is_owner": is_owner,
            "is_member": is_owner or member_doc.exists,
            # Hide the join code from non-owners.
            "join_code": meta["join_code"] if is_owner else None,
        }

    return await run_in_threadpool(_load)


@router.get("/{class_id}/students")
async def list_class_students(
    class_id: str,
    teacher = Depends(require_teacher),
    db = Depends(get_db),
) -> Dict[str, Any]:
    """List students in a class. Owner-only."""
    uid = teacher["uid"]

    def _list():
        ref = db.collection("classes").document(class_id)
        snap = ref.get()
        if not snap.exists:
            raise HTTPException(status_code=404, detail="Class not found")
        meta = snap.to_dict() or {}
        if meta.get("owner_uid") != uid:
            raise HTTPException(status_code=403, detail="Only the class owner can view students")

        members = list(ref.collection("members").stream())
        students: List[Dict[str, Any]] = []
        for m in members:
            mid = m.id
            md = m.to_dict() or {}
            udoc = db.collection("users").document(mid).get()
            udata = (udoc.to_dict() or {}) if udoc.exists else {}

            # Pull a quick BKT-mastery summary so the roster is useful at a
            # glance. We avg p_mastery across known skills.
            mastery_docs = list(
                db.collection("users").document(mid).collection("mastery").stream()
            )
            if mastery_docs:
                vals = [float((d.to_dict() or {}).get("p_mastery", 0.0)) for d in mastery_docs]
                avg = round(sum(vals) / len(vals) * 100, 1)
                weak = sorted(
                    [
                        {"skill": d.id, "score": round(float((d.to_dict() or {}).get("p_mastery", 0.0)) * 100, 1)}
                        for d in mastery_docs
                        if float((d.to_dict() or {}).get("p_mastery", 0.0)) < 0.4
                    ],
                    key=lambda x: x["score"],
                )[:3]
            else:
                avg = 0.0
                weak = []

            students.append({
                "user_id": mid,
                "email": udata.get("email"),
                "full_name": udata.get("full_name") or mid,
                "profile_segment": udata.get("profile_segment"),
                "joined_at": (md.get("joined_at").isoformat()
                              if hasattr(md.get("joined_at"), "isoformat") else None),
                "overall_mastery": avg,
                "weak_skills": weak,
            })

        students.sort(key=lambda s: s["overall_mastery"])
        return {
            "class_id": class_id,
            "name": meta.get("name"),
            "students": students,
            "count": len(students),
        }

    return await run_in_threadpool(_list)


@router.delete("/{class_id}/students/{student_uid}")
async def remove_student(
    class_id: str,
    student_uid: str,
    teacher = Depends(require_teacher),
    db = Depends(get_db),
) -> Dict[str, Any]:
    """Remove a student from a class. Owner-only."""
    def _remove():
        ref = db.collection("classes").document(class_id)
        snap = ref.get()
        if not snap.exists:
            raise HTTPException(status_code=404, detail="Class not found")
        meta = snap.to_dict() or {}
        if meta.get("owner_uid") != teacher["uid"]:
            raise HTTPException(status_code=403, detail="Only the class owner can remove students")

        member_ref = ref.collection("members").document(student_uid)
        if not member_ref.get().exists:
            raise HTTPException(status_code=404, detail="Student not in class")
        member_ref.delete()
        ref.update({
            "member_count": firestore.Increment(-1),
            "student_uids": firestore.ArrayRemove([student_uid]),
        })
        return {"removed": student_uid}

    return await run_in_threadpool(_remove)


@router.post("/join")
async def join_class(
    body: JoinClassRequest,
    current_user = Depends(get_current_user),
    db = Depends(get_db),
) -> Dict[str, Any]:
    """Join a class with a 6-char join code. Any signed-in user."""
    code = body.code.strip().upper()
    uid = current_user.get("uid")

    def _join():
        q = (
            db.collection("classes")
              .where(field_path="join_code", op_string="==", value=code)
              .limit(1)
              .stream()
        )
        match = next(iter(q), None)
        if match is None:
            raise HTTPException(status_code=404, detail="Invalid join code")

        class_ref = match.reference
        meta = match.to_dict() or {}

        if meta.get("owner_uid") == uid:
            raise HTTPException(status_code=400, detail="You own this class — you can't join it")

        member_ref = class_ref.collection("members").document(uid)
        if member_ref.get().exists:
            return {"joined": False, "class_id": class_ref.id, "already_member": True}

        # Pull the member's profile for a denormalized snapshot (so the
        # roster doesn't need an extra users/* read per row).
        udoc = db.collection("users").document(uid).get()
        udata = (udoc.to_dict() or {}) if udoc.exists else {}

        member_ref.set({
            "user_id": uid,
            "email": udata.get("email") or current_user.get("email"),
            "full_name": udata.get("full_name"),
            "joined_at": firestore.SERVER_TIMESTAMP,
        })
        class_ref.update({
            "member_count": firestore.Increment(1),
            "student_uids": firestore.ArrayUnion([uid]),
        })

        return {
            "joined": True,
            "class_id": class_ref.id,
            "class_name": meta.get("name"),
            "owner_name": meta.get("owner_name"),
        }

    return await run_in_threadpool(_join)
