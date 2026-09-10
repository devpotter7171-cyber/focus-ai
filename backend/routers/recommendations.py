from fastapi import APIRouter, Depends, HTTPException
from database import get_db
import logging

router = APIRouter()

@router.get("/")
async def get_recommendation(user_id: str, context: str = "general", db = Depends(get_db)):
    # 1. Fetch User
    doc = db.collection("users").document(user_id).get()
    if not doc.exists:
        # Warning: For now assuming if not found, we just proceed or raise 404
        # raise HTTPException(status_code=404, detail="User not found")
        pass 
    
    # 2. Contextual Bandit Logic
    context_features = {"user_id": user_id, "context": context} 
    
    # Run in threadpool
    from fastapi.concurrency import run_in_threadpool
    from services.ml_service import ml_service
    
    selected_type = await run_in_threadpool(ml_service.predict_bandit, context_features)
    
    # 3. Fetch Content based on recommendation
    return {
        "user_id": user_id,
        "context": context,
        "recommended_action": selected_type,
        "reason": f"AI recommended {selected_type.replace('_', ' ')} based on your learning profile.",
        "content_id": "dbms_u1_s2_visual" 
    }
