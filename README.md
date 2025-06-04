
# SoilScan

A mobile-first smart agriculture app built with React Native and hosted using Expo and will be up for deployment. Soil Scan allows users to scan and analyze soil using their phone's camera. The app uses a ResNet50 convolutional neural network to classify soil texture and a trained ExtraTreeClassifier model to recommend the most suitable fertilizer based on the detected soil texture.

The machine learning logic is powered by a Python backend hosted on Hugging Face Spaces, which exposes an API to handle soil texture classification and fertilizer recommendation tasks. All model inference is handled server-side to keep the app lightweight and efficient.

# Stack


- React Native (Expo) – for building cross-platform mobile UI

- ResNet50 – for soil color classification from images

- ExtraTreeClassifier – for fertilizer recommendation based on soil classification

- Python – backend logic and ML model hosting

- Hugging Face Spaces – lightweight cloud backend for API hosting

# Screenshots


# Screenshots

**_Soil Image Classification_**

The user can upload a photo or take a photo. This results in the following:
- Soil texture
- Description of soil texture
- Properties of the soil
<p align="center">
  <img src="https://github.com/user-attachments/assets/157204d5-6463-4590-804a-7e5e185a38ba" width="30%"/>
  <img src="https://github.com/user-attachments/assets/61b70fa4-83d5-4f03-9629-7e928477dec7" width="30%"/>
</p>

---

**_Fertilizer Recommendation_**

*_Note: The prediction from the texture classification automatically becomes a selected parameter when you choose to get fertilizer recommendations_*

The user can input NPK values, temperature, Moisture, and Crop-Type. It results in the following:
- Recommended fertilizer for the given soil properties
- A description of the fertilizer

<p align="center">
  <img src="https://github.com/user-attachments/assets/3d1acd8f-0389-43b0-b60a-4ff661fae864" width="30%"/>
  <img src="https://github.com/user-attachments/assets/e9d2c5ff-e96d-4e9e-be27-0c9e3be80b05" width="30%"/>
  <img src="https://github.com/user-attachments/assets/198a2c5a-3f70-48ef-9999-02a9c3f775ff" width="30%"/>
</p>

# How to Run


### Prerequisites
- npm: 10.9.0
- react-native: 0.78.2
- react: 18.x
  
To run the SoilScan app locally, follow these steps:

### 1. Clone the repository

```bash
git clone https://github.com/ljiro/SoilScan.git
cd SoilScan
```
### 2. Use npx to start the project

```bash
# Make sure all dependencies are installed
npm install

# For local testing
npx expo start

# For over the internet testing
npx expo start --tunnel
```







