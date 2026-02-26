import os
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import List, Dict, Any
from datetime import datetime

def get_db_connection():
    """Get database connection"""
    DATABASE_URL = os.getenv(
        "DATABASE_URL", 
        os.getenv("ML_DATABASE_URL", "postgresql://inventory:inventory123@localhost:5432/inventory_dev")
    )
    return psycopg2.connect(DATABASE_URL)

def get_transactions(product_id: str, organization_id: str) -> List[Dict[str, Any]]:
    """Fetch historical transactions for a product"""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT 
                    date,
                    type,
                    quantity,
                    "promoFlag"
                FROM transactions
                WHERE "productId" = %s 
                  AND "organizationId" = %s
                ORDER BY date ASC
            """, (product_id, organization_id))
            
            rows = cursor.fetchall()
            # Convert camelCase to snake_case for the script
            return [
                {
                    'date': row['date'],
                    'type': row['type'],
                    'quantity': row['quantity'],
                    'promo_flag': row['promoFlag']
                }
                for row in rows
            ]
    finally:
        conn.close()

def get_all_products(organization_id: str) -> List[Dict[str, Any]]:
    """Get all products for an organization"""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT 
                    id,
                    sku,
                    name,
                    current_stock,
                    min_threshold,
                    lead_time_days
                FROM products
                WHERE organization_id = %s
            """, (organization_id,))
            
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
    finally:
        conn.close()

def save_predictions(product_id: str, predictions: List[Dict[str, Any]], model_type: str):
    """Save predictions to database"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Clear existing predictions for this product (use camelCase)
            cursor.execute("""
                DELETE FROM predictions 
                WHERE "productId" = %s
            """, (product_id,))
            
            # Insert new predictions (use camelCase)
            for pred in predictions:
                cursor.execute("""
                    INSERT INTO predictions 
                        (id, "productId", "predictedDate", "predictedQty", "confidenceMin", "confidenceMax", "modelType")
                    VALUES 
                        (gen_random_uuid(), %s, %s, %s, %s, %s, %s)
                    ON CONFLICT ("productId", "predictedDate") DO UPDATE SET
                        "predictedQty" = EXCLUDED."predictedQty",
                        "confidenceMin" = EXCLUDED."confidenceMin",
                        "confidenceMax" = EXCLUDED."confidenceMax"
                """, (
                    product_id,
                    pred['date'],
                    pred['predicted_qty'],
                    pred.get('confidence_min'),
                    pred.get('confidence_max'),
                    model_type
                ))
            
            conn.commit()
    finally:
        conn.close()
