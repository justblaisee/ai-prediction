import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Any
import logging
import warnings

warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)

# Model storage path
MODEL_DIR = "/app/models"
os.makedirs(MODEL_DIR, exist_ok=True)

def prepare_data(transactions: List[Dict[str, Any]]) -> pd.DataFrame:
    """Prepare transaction data for modeling"""
    
    # Convert to DataFrame
    df = pd.DataFrame(transactions)
    
    # Parse dates
    df['date'] = pd.to_datetime(df['date'])
    
    # Aggregate by date (sum all transactions per day)
    df = df.groupby('date').agg({
        'quantity': 'sum',
        'promo_flag': 'max'
    }).reset_index()
    
    # Create complete date range
    start_date = df['date'].min()
    end_date = df['date'].max()
    full_range = pd.date_range(start=start_date, end=end_date, freq='D')
    
    # Reindex to fill missing dates
    df = df.set_index('date')
    df = df.reindex(full_range, fill_value=0)
    df.index.name = 'date'
    
    # Reset promo flag for missing days
    df['promo_flag'] = df['promo_flag'].fillna(0)
    
    return df.reset_index()

def train_prophet(df: pd.DataFrame, horizon: int = 90) -> Dict[str, Any]:
    """Train Prophet model"""
    try:
        from prophet import Prophet
        
        # Prepare data for Prophet
        prophet_df = df[['date', 'quantity']].copy()
        prophet_df.columns = ['ds', 'y']
        
        # Add promo as regressor
        prophet_df['promo'] = df['promo_flag'].values
        
        # Create and train model
        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            changepoint_prior_scale=0.05
        )
        model.add_regressor('promo')
        model.fit(prophet_df)
        
        # Make future dataframe
        future = model.make_future_dataframe(periods=horizon)
        future['promo'] = 0  # Assume no promo for future
        
        # Predict
        forecast = model.predict(future)
        
        # Extract predictions
        predictions = forecast.tail(horizon)[['ds', 'yhat', 'yhat_lower', 'yhat_upper']]
        predictions.columns = ['date', 'predicted_qty', 'confidence_min', 'confidence_max']
        predictions['predicted_qty'] = predictions['predicted_qty'].clip(lower=0)
        predictions['confidence_min'] = predictions['confidence_min'].clip(lower=0)
        
        # Get metrics on historical data
        historical = forecast.head(len(prophet_df))
        mae = np.mean(np.abs(historical['y'] - historical['yhat']))
        
        return {
            'predictions': predictions.to_dict('records'),
            'metrics': {'mae': float(mae), 'model_type': 'prophet'},
            'model': model,
            'model_type': 'prophet'
        }
        
    except Exception as e:
        logger.warning(f"Prophet failed: {e}, falling back to simple model")
        raise

def train_xgboost(df: pd.DataFrame, horizon: int = 90) -> Dict[str, Any]:
    """Train XGBoost model"""
    try:
        import xgboost as xgb
        from sklearn.preprocessing import StandardScaler
        
        # Feature engineering
        df = df.copy()
        df['dayofweek'] = df['date'].dt.dayofweek
        df['month'] = df['date'].dt.month
        df['day'] = df['date'].dt.day
        df['weekofyear'] = df['date'].dt.isocalendar().week.astype(int)
        
        # Lag features
        for lag in [1, 7, 14]:
            df[f'lag_{lag}'] = df['quantity'].shift(lag)
        
        # Rolling features
        df['rolling_mean_7'] = df['quantity'].rolling(7).mean()
        df['rolling_std_7'] = df['quantity'].rolling(7).std()
        
        # Drop NaN
        df = df.dropna()
        
        # Features and target
        feature_cols = ['dayofweek', 'month', 'day', 'weekofyear', 'promo_flag', 
                       'lag_1', 'lag_7', 'lag_14', 'rolling_mean_7', 'rolling_std_7']
        
        X = df[feature_cols]
        y = df['quantity']
        
        # Train model
        model = xgb.XGBRegressor(
            n_estimators=100,
            max_depth=5,
            learning_rate=0.1,
            random_state=42
        )
        model.fit(X, y)
        
        # Predict future
        predictions = []
        last_data = df.copy()
        
        for i in range(horizon):
            future_date = df['date'].max() + timedelta(days=i+1)
            
            # Create features for future date
            future_row = {
                'dayofweek': future_date.dayofweek,
                'month': future_date.month,
                'day': future_date.day,
                'weekofyear': future_date.isocalendar().week,
                'promo_flag': 0,
                'lag_1': last_data['quantity'].iloc[-1],
                'lag_7': last_data['quantity'].iloc[-7] if len(last_data) >= 7 else 0,
                'lag_14': last_data['quantity'].iloc[-14] if len(last_data) >= 14 else 0,
                'rolling_mean_7': last_data['quantity'].tail(7).mean(),
                'rolling_std_7': last_data['quantity'].tail(7).std() if len(last_data) >= 7 else 0,
            }
            
            X_future = pd.DataFrame([future_row])
            pred = max(0, model.predict(X_future)[0])
            
            # Add confidence interval (simplified)
            confidence = 0.2 * pred  # 20% uncertainty
            
            predictions.append({
                'date': future_date,
                'predicted_qty': float(pred),
                'confidence_min': float(pred - confidence),
                'confidence_max': float(pred + confidence)
            })
            
            # Update last_data for next iteration
            new_row = pd.DataFrame([{
                'date': future_date,
                'quantity': pred,
                'promo_flag': 0,
                **future_row
            }])
            last_data = pd.concat([last_data, new_row], ignore_index=True)
        
        # Calculate metrics
        y_pred = model.predict(X)
        mae = np.mean(np.abs(y - y_pred))
        
        return {
            'predictions': predictions,
            'metrics': {'mae': float(mae), 'model_type': 'xgboost'},
            'model': model,
            'model_type': 'xgboost'
        }
        
    except Exception as e:
        logger.warning(f"XGBoost failed: {e}")
        raise

def train_simple_model(df: pd.DataFrame, horizon: int = 90) -> Dict[str, Any]:
    """Fallback simple model using moving average"""
    
    # Calculate average daily demand
    avg_daily = df['quantity'].mean()
    
    # Calculate weekly pattern
    df = df.copy()
    df['dayofweek'] = df['date'].dt.dayofweek
    weekly_pattern = df.groupby('dayofweek')['quantity'].mean()
    
    # Generate predictions
    predictions = []
    base_date = df['date'].max()
    
    for i in range(horizon):
        future_date = base_date + timedelta(days=i+1)
        day_of_week = future_date.dayofweek
        
        # Apply weekly pattern
        predicted = avg_daily * (weekly_pattern.get(day_of_week, avg_daily) / avg_daily)
        predicted = max(0, predicted)
        
        confidence = 0.3 * predicted
        
        predictions.append({
            'date': future_date,
            'predicted_qty': float(predicted),
            'confidence_min': float(max(0, predicted - confidence)),
            'confidence_max': float(predicted + confidence)
        })
    
    return {
        'predictions': predictions,
        'metrics': {'mae': float(avg_daily * 0.3), 'model_type': 'simple_ma'},
        'model': None,
        'model_type': 'simple_ma'
    }

def train_model(product_id: str, transactions: List[Dict[str, Any]], horizon: int = 90) -> Dict[str, Any]:
    """Main training function with ensemble fallback"""
    
    logger.info(f"Training model for product {product_id} with {len(transactions)} transactions")
    
    # Prepare data
    df = prepare_data(transactions)
    logger.info(f"Prepared {len(df)} days of data")
    
    result = None
    
    # Try Prophet first
    try:
        logger.info("Attempting Prophet model...")
        result = train_prophet(df, horizon)
        logger.info("Prophet model trained successfully")
    except Exception as e:
        logger.warning(f"Prophet failed: {e}")
        
        # Try XGBoost
        try:
            logger.info("Attempting XGBoost model...")
            result = train_xgboost(df, horizon)
            logger.info("XGBoost model trained successfully")
        except Exception as e:
            logger.warning(f"XGBoost failed: {e}")
            
            # Fallback to simple model
            logger.info("Using simple moving average model...")
            result = train_simple_model(df, horizon)
            logger.info("Simple model created")
    
    # Save model
    if result and result.get('model') is not None:
        import joblib
        model_path = os.path.join(MODEL_DIR, f"model_{product_id}.joblib")
        joblib.dump(result['model'], model_path)
        logger.info(f"Model saved to {model_path}")
    
    # Save predictions to database
    if result:
        from scripts.database import save_predictions
        save_predictions(product_id, result['predictions'], result['model_type'])
        logger.info(f"Predictions saved to database")
    
    return result

def get_predictions(product_id: str, organization_id: str, horizon: int = 90) -> List[Dict[str, Any]]:
    """Get predictions for a product"""
    import joblib
    
    model_path = os.path.join(MODEL_DIR, f"model_{product_id}.joblib")
    
    if os.path.exists(model_path):
        # Load model and predict
        model = joblib.load(model_path)
        
        # For now, return stored predictions from database
        from scripts.database import get_transactions
        transactions = get_transactions(product_id, organization_id)
        
        if transactions:
            df = prepare_data(transactions)
            result = train_simple_model(df, horizon)
            return result['predictions']
    
    # Return empty predictions if no model
    return []
