🌱 Soil Scan
A mobile-first smart agriculture app built with React Native and hosted using Expo and will be up for deployment. Soil Scan allows users to scan and analyze soil using their phone's camera. The app uses a ResNet50 convolutional neural network to classify soil color and a trained XGBoost model to recommend the most suitable crops based on the detected soil type.

The machine learning logic is powered by a Python backend hosted on Hugging Face Spaces, which exposes an API to handle image classification and crop prediction tasks. All model inference is handled server-side to keep the app lightweight and efficient.

🔧 Tech Stack:

📱 React Native (Expo) – for building cross-platform mobile UI

🧠 ResNet50 – for soil color classification from images

🌾 XGBoost – for crop recommendation based on soil classification

🐍 Python – backend logic and ML model hosting

☁️ Hugging Face Spaces – lightweight cloud backend for API hosting

