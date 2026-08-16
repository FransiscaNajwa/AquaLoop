import numpy as np
import tensorflow as tf
from sklearn.preprocessing import MinMaxScaler
import datetime

print("Memuat model LSTM...")
model = tf.keras.models.load_model('lstm_do_model.h5', compile=False)
print("Model berhasil dimuat!")

# Simulasi data input sensor terbaru (5 baris data terakhir: [Suhu, Jam])
current_hour = datetime.datetime.now().hour
input_sensor_baru = np.array([
    [28.2, max(0, current_hour - 4)],
    [28.3, max(0, current_hour - 3)],
    [28.4, max(0, current_hour - 2)],
    [28.5, max(0, current_hour - 1)],
    [28.5, current_hour]  # Jam saat ini
])

scaler_feature = MinMaxScaler()
scaler_feature.fit([[25, 0], [32, 23]]) 
scaled_input = scaler_feature.transform(input_sensor_baru)

X_test = np.reshape(scaled_input, (1, scaled_input.shape[0], scaled_input.shape[1]))

prediksi_scaled = model.predict(X_test, verbose=0)
prediksi_do = prediksi_scaled[0][0] * 10.0 

print(f"\n==========================================")
print(f"  HASIL PREDIKSI SOFT-SENSOR LSTM")
print(f"==========================================")
print(f"  Jam Sekarang                   : {current_hour}:00")
print(f"  Prediksi Oksigen Terlarut (DO) : {prediksi_do:.2f} mg/L")
print(f"==========================================")