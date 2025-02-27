from flask import Flask, render_template, request, jsonify
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing import image
import numpy as np
import os
from PIL import Image
import io
import sqlite3
from datetime import datetime

app = Flask(__name__)

# Load the pre-trained model
model_path = os.path.join("model", "fake_news_detector_fixed.h5")
try:
    model = load_model(model_path)
    print("Model loaded successfully!")
    model.summary()
except Exception as e:
    print(f"Error loading model: {e}")

# Prediction function
def predict_fake_news(img_data):
    # Convert bytes to PIL Image
    img = Image.open(io.BytesIO(img_data)).convert('RGB')
    img = img.resize((224, 224))  # Resize to VGG16 input
    img_array = image.img_to_array(img) / 255.0  # Normalize
    img_array = np.expand_dims(img_array, axis=0)  # Add batch dimension
    
    # Predict
    prediction = model.predict(img_array)[0][0]  # Probability (0 to 1)
    label = "Real" if prediction > 0.5 else "Fake"  # Threshold at 0.5
    confidence = prediction if prediction > 0.5 else 1 - prediction  # Confidence score
    print(f"Predicted: {label}, Confidence: {confidence}")  # Debug log
    return label, confidence

# Initialize SQLite database
def init_db():
    conn = sqlite3.connect('predictions.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS predictions
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  image_id TEXT, label TEXT, confidence REAL, timestamp TEXT)''')
    conn.commit()
    conn.close()

# Routes
@app.route('/')
def home():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file:
        img_data = file.read()
        label, confidence = predict_fake_news(img_data)
        # Save to database
        conn = sqlite3.connect('predictions.db')
        c = conn.cursor()
        c.execute('INSERT INTO predictions (image_id, label, confidence, timestamp) VALUES (?, ?, ?, ?)',
                  (file.filename, label, confidence, datetime.now().isoformat()))
        conn.commit()
        conn.close()
        return jsonify({
            'label': label,
            'confidence': f"{confidence:.2%}"
        })

@app.route('/history', methods=['GET'])
def get_history():
    conn = sqlite3.connect('predictions.db')
    c = conn.cursor()
    c.execute('SELECT * FROM predictions ORDER BY timestamp DESC')
    history = [{'id': row[0], 'image_id': row[1], 'label': row[2], 'confidence': row[3], 'timestamp': row[4]} for row in c.fetchall()]
    conn.close()
    return jsonify(history)

if __name__ == '__main__':
    init_db()  # Initialize the database when the app starts
    app.run(debug=True, host='0.0.0.0', port=5000)