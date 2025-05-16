
# SoilScan

A mobile-first smart agriculture app built with React Native and hosted using Expo and will be up for deployment. Soil Scan allows users to scan and analyze soil using their phone's camera. The app uses a ResNet50 convolutional neural network to classify soil color and a trained XGBoost model to recommend the most suitable crops based on the detected soil type.

The machine learning logic is powered by a Python backend hosted on Hugging Face Spaces, which exposes an API to handle image classification and crop prediction tasks. All model inference is handled server-side to keep the app lightweight and efficient.

# Stack


📱 React Native (Expo) – for building cross-platform mobile UI

🧠 ResNet50 – for soil color classification from images

🌾 XGBoost – for crop recommendation based on soil classification

🐍 Python – backend logic and ML model hosting

☁️ Hugging Face Spaces – lightweight cloud backend for API hosting

# Screenshots


**_Soil Image Classification_**

_Result_
- Munsell color code
- Description of soil color
- soil properties
![Screenshot_20250516_150332_Expo Go](https://github.com/user-attachments/assets/2de63e5d-0da0-451e-88ef-8b26e649d2cb)



**_Crop Recommendation_**

_Result_
- Top 5 crop recommendations
- confidence level in the crop recommendation
![Screenshot_20250516_150417_Expo Go](https://github.com/user-attachments/assets/82588dc8-00d0-4430-bede-48775594c8d0)
