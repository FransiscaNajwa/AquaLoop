import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Input, LSTM, Dense
from sklearn.preprocessing import MinMaxScaler

print("1. Membuat dummy data (Suhu & Waktu)...")
np.random.seed(42)
n_samples = 1000

temp = np.random.uniform(25.0, 32.0, n_samples)       # Suhu 25-32 °C
jam = np.random.randint(0, 24, n_samples)              # Jam (0 - 23)
do_aktual = 8.0 - (temp * 0.1) + np.sin(jam * np.pi / 12) * 1.5 + np.random.normal(0, 0.1, n_samples)

df = pd.DataFrame({
    'temperature': temp,
    'hour': jam,
    'dissolved_oxygen': do_aktual
})

scaler = MinMaxScaler()
scaled_data = scaler.fit_transform(df[['temperature', 'hour', 'dissolved_oxygen']])

def create_sequences(data, window_size=5):
    X, y = [], []
    for i in range(len(data) - window_size):
        X.append(data[i:(i + window_size), :-1]) 
        y.append(data[i + window_size, -1])      
    return np.array(X), np.array(y)

window_size = 5
X, y = create_sequences(scaled_data, window_size)

print("2. Membangun Arsitektur Model LSTM (Modern Input Layer)...")
model = Sequential([
    Input(shape=(X.shape[1], X.shape[2])), # Menggunakan Input layer modern agar tidak error dimensi
    LSTM(50, activation='relu'),
    Dense(1)
])

model.compile(optimizer='adam', loss='mse')

print("3. Melatih (Training) Model LSTM...")
model.fit(X, y, epochs=20, batch_size=16, verbose=1)

# Simpan model
model.save('lstm_do_model.h5')
print("\nSelesai! Model LSTM baru berhasil disimpan.")