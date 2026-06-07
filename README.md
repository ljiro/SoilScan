# SoilScan

SoilScan is a research project building an end-to-end pipeline for non-destructive soil nutrient analysis using field photography and deep learning. It targets smallholder farms in the Cordillera Administrative Region of the Philippines (Atok, La Trinidad, Benguet), where lab soil testing is inaccessible or cost-prohibitive.

The repository is split into focused branches. This page is your map.

---

## How the System Fits Together

```
Field researcher
      |
      v
[ AgriCapture app ]  ──── captures geotagged photos + metadata ────>  CSV + images
      |                                                                      |
      |                                                                      v
      |                                                        [ Soil BG Remover tool ]
      |                                                         (optional preprocessing)
      |                                                                      |
      v                                                                      v
[ SoilScan app ]  <──── on-device inference ────  [ ML Training Pipeline ]
  (end-user)                                        model/classification-models
```

- **AgriCapture** collects the raw data (photos + GPS + weather + labels) in the field.
- The **ML pipeline** trains deep learning models on that data to predict N, P, K levels.
- The **SoilScan app** delivers predictions to end-users via an on-device or API-backed interface.
- The **Soil BG Remover** is a preprocessing tool for cleaning controlled-environment images before training.

---

## Branch Guide

### Active Development

| Branch | What it is | Stack | README |
|--------|-----------|-------|--------|
| [`model/classification-models`](https://github.com/ljiro/SoilScan/tree/model/classification-models) | Deep learning training pipeline. Predicts N, P, K (Low/Medium/High) from field photos. Supports ResNet-50, EfficientNet-B4, ConvNeXt-Tiny, ViT-B/16. Full TensorBoard, AMP, early stopping. | Python · PyTorch · timm | [README](https://github.com/ljiro/SoilScan/blob/model/classification-models/README.md) |
| [`tool/agricapture-camera-directory`](https://github.com/ljiro/SoilScan/tree/tool/agricapture-camera-directory) | Android field data collection app. Camera + GPS + compass + weather per capture. Exports ZIP archives (CSV + images) for handoff to the ML pipeline. | React Native · Expo · Android | [README](https://github.com/ljiro/SoilScan/blob/tool/agricapture-camera-directory/README.md) |
| [`feature/soil-bg-remover`](https://github.com/ljiro/SoilScan/tree/feature/soil-bg-remover) | Desktop GUI for removing backgrounds from soil sample photos. Supports AI full removal, AI + lasso, zoom edit, and field mode for outdoor images. | Python · Tkinter | [README](https://github.com/ljiro/SoilScan/blob/feature/soil-bg-remover/README.md) |

### App Versions

| Branch | What it is | Stack |
|--------|-----------|-------|
| [`main`](https://github.com/ljiro/SoilScan/tree/main) *(this page)* | Original SoilScan app. Soil texture classification (ResNet-50) + fertilizer recommendation (ExtraTreeClassifier). Hugging Face Spaces backend. | React Native · Expo · Hugging Face |
| [`version/soilcan-texture-build`](https://github.com/ljiro/SoilScan/tree/version/soilcan-texture-build) | Soil texture + crop recommendation variant (ResNet-50 + XGBoost). | React Native · Expo |
| [`version/SoilScan-GIS-Web`](https://github.com/ljiro/SoilScan/tree/version/SoilScan-GIS-Web) | Web-based GIS version of the SoilScan interface. | Web |

### Other Branches

| Branch | What it is |
|--------|-----------|
| [`tool/agricapture-camera`](https://github.com/ljiro/SoilScan/tree/tool/agricapture-camera) | Earlier single-camera variant of AgriCapture. |
| [`feature/lens-cap-camera`](https://github.com/ljiro/SoilScan/tree/feature/lens-cap-camera) | Experimental lens-cap detection feature. |
| [`prototype/soilscan-GIS`](https://github.com/ljiro/SoilScan/tree/prototype/soilscan-GIS) | Early GIS integration prototype. |

---

## Where to Start

**I want to collect soil field data →** [`tool/agricapture-camera-directory`](https://github.com/ljiro/SoilScan/tree/tool/agricapture-camera-directory)

**I want to train or evaluate an NPK prediction model →** [`model/classification-models`](https://github.com/ljiro/SoilScan/tree/model/classification-models)

**I want to preprocess controlled-environment images →** [`feature/soil-bg-remover`](https://github.com/ljiro/SoilScan/tree/feature/soil-bg-remover)

**I want to run the end-user soil scanner app →** you are on the right branch — see [How to Run](#how-to-run) below.

---

## SoilScan App (this branch)

The original SoilScan mobile app. A user points their phone camera at soil, and the app returns the soil texture classification and fertilizer recommendations.

### Stack

| Layer | Technology |
|-------|-----------|
| Mobile app | React Native (Expo) |
| Soil classification | ResNet-50 CNN |
| Fertilizer recommendation | ExtraTreeClassifier |
| Backend / inference | Python on Hugging Face Spaces |

### Screenshots

**Soil Image Classification** — upload or capture a photo to get soil texture, description, and properties.

<p align="center">
  <img src="https://github.com/user-attachments/assets/157204d5-6463-4590-804a-7e5e185a38ba" width="30%"/>
  <img src="https://github.com/user-attachments/assets/61b70fa4-83d5-4f03-9629-7e928477dec7" width="30%"/>
</p>

**Fertilizer Recommendation** — input NPK values, temperature, moisture, and crop type to get a fertilizer recommendation and description.

<p align="center">
  <img src="https://github.com/user-attachments/assets/3d1acd8f-0389-43b0-b60a-4ff661fae864" width="30%"/>
  <img src="https://github.com/user-attachments/assets/e9d2c5ff-e96d-4e9e-be27-0c9e3be80b05" width="30%"/>
  <img src="https://github.com/user-attachments/assets/198a2c5a-3f70-48ef-9999-02a9c3f775ff" width="30%"/>
</p>

### How to Run

**Prerequisites:** Node.js, npm 10.9+, Expo Go on your device.

```bash
# 1. Clone and install
git clone https://github.com/ljiro/SoilScan.git
cd SoilScan
npm install

# 2. Start (local network)
npx expo start

# 3. Start (over the internet / tunnel)
npx expo start --tunnel
```

Scan the QR code with Expo Go on your Android or iOS device.

---

## Research Context

This project supports agricultural research in the **Cordillera Administrative Region, Philippines**. The primary study areas are Atok and La Trinidad, Benguet — highland vegetable-farming communities where soil health directly determines crop yields and food security.

The goal is to replace or supplement expensive laboratory soil testing with a phone camera, for nutrient prediction, making nutrient-level assessment accessible to individual farmers in the field.
