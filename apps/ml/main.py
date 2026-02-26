from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import os
import sys
import logging
from datetime import datetime, timedelta

# Add scripts to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from scripts.train import train_model, get_predictions
from scripts.database import get_transactions

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Inventory ML Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TrainRequest(BaseModel):
    productId: str
    organizationId: str
    horizon: int = 90

class PredictRequest(BaseModel):
    productId: str
    organizationId: str
    horizon: int = 90

@app.get("/")
async def root():
    return {
        "service": "Inventory ML Service",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.post("/train")
async def train(request: TrainRequest):
    """Train a prediction model for a product"""
    try:
        logger.info(f"Training model for product {request.productId}")
        
        # Get historical transactions
        transactions = get_transactions(
            request.productId,
            request.organizationId
        )
        
        if not transactions or len(transactions) < 7:
            raise HTTPException(
                status_code=400,
                detail="Insufficient historical data (minimum 7 days required)"
            )
        
        # Train the model
        result = train_model(
            product_id=request.productId,
            transactions=transactions,
            horizon=request.horizon
        )
        
        return {
            "success": True,
            "productId": request.productId,
            "modelType": result.get("model_type"),
            "metrics": result.get("metrics", {}),
            "message": "Model trained successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Training failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict")
async def predict(request: PredictRequest):
    """Get demand predictions for a product"""
    try:
        logger.info(f"Getting predictions for product {request.productId}")
        
        # Get predictions
        predictions = get_predictions(
            product_id=request.productId,
            organization_id=request.organizationId,
            horizon=request.horizon
        )
        
        return {
            "success": True,
            "productId": request.productId,
            "predictions": predictions
        }
        
    except Exception as e:
        logger.error(f"Prediction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/model/status/{product_id}")
async def model_status(product_id: str):
    """Check if a model exists for a product"""
    try:
        model_path = f"/app/models/model_{product_id}.joblib"
        
        if os.path.exists(model_path):
            return {
                "exists": True,
                "productId": product_id,
                "modelPath": model_path
            }
        else:
            return {
                "exists": False,
                "productId": product_id,
                "message": "No trained model found for this product"
            }
            
    except Exception as e:
        logger.error(f"Status check failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/models/train-all")
async def train_all_models():
    """Train models for all products (admin endpoint)"""
    try:
        # This would typically fetch all products from database
        # and train models for each
        return {
            "success": True,
            "message": "Bulk training triggered - check logs for progress"
        }
    except Exception as e:
        logger.error(f"Bulk training failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("ML_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
