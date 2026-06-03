# AgriCapture — Field Data Collection for Soil Research

## Overview

AgriCapture is a React Native (Expo) Android app for collecting geotagged, annotated field photographs of agricultural soil. It is the data-collection companion to the [SoilScan](../model/classification-models/README.md) deep-learning pipeline: photos and metadata captured by this app feed directly into the ML training dataset.

Each capture records a photograph alongside GPS coordinates, device orientation, live weather conditions, and researcher-entered metadata (municipality, barangay, farm, crops). All data is written to a structured CSV file that can be exported as a ZIP archive and synced to Google Drive for offline-to-cloud handoff.

**Platform:** Android (primary). iOS is structurally supported but untested.

---

## Table of Contents

1. [Features](#features)
2. [Installation](#installation)
3. [Running the App](#running-the-app)
4. [First-Run Flow](#first-run-flow)
5. [Screens](#screens)
6. [CSV Data Schema](#csv-data-schema)
7. [Storage Behaviour](#storage-behaviour)
8. [Export and Sharing](#export-and-sharing)
9. [Google Drive Integration](#google-drive-integration)
10. [Project Structure](#project-structure)
11. [Permissions](#permissions)

---

## Features

- **Camera capture** with real-time GPS, compass heading, and pitch/roll tracking
- **Spot/shot organisation** — each field location is a numbered *spot*; configurable shots per spot (default 5)
- **Live weather enrichment** — temperature and humidity fetched at capture time
- **Structured CSV logging** — 25+ fields per capture written to a local CSV
- **Data viewer** — browse, search, and inspect captured records on-device
- **ZIP export** — bundles the CSV and all images into a single archive, shareable via any Android share target
- **Soil test entry** — separate screen for manually recording laboratory soil test results
- **Google Drive sync** — optional OAuth upload to a designated research Drive folder
- **Offline-first** — all capture and storage works without a network connection
- **Onboarding flow** — guided Terms → Permissions → Usage Guide on first launch

---

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- [Expo CLI](https://docs.expo.dev/get-started/installation/): `npm install -g expo-cli`
- Android device or emulator (Android 10+ recommended for external storage support)
- For physical device builds: [EAS CLI](https://docs.expo.dev/build/setup/): `npm install -g eas-cli`

### Steps

```bash
# 1. Clone the repository and switch to this branch
git clone https://github.com/ljiro/SoilScan.git
cd SoilScan
git checkout tool/agricapture-camera-directory

# 2. Install dependencies
npm install
```

---

## Running the App

### Development (Expo Go)

```bash
# Start the Metro bundler
npm start
# or
expo start
```

Scan the QR code with the [Expo Go](https://expo.dev/client) app on your Android device. Note that some native modules (camera, file system, external storage) may behave differently inside Expo Go vs a full build.

### Development Build (recommended for camera and storage features)

```bash
# Build a development APK via EAS
eas build --profile development --platform android

# Or run directly on a connected device
expo run:android
```

### Production APK

```bash
eas build --profile production --platform android
```

The EAS project ID is `8996121e-95d9-479e-ba44-ca0f0ff4d52c` (configured in `app.json`).

---

## First-Run Flow

On first launch the app walks through three screens before reaching the main interface:

1. **Terms Agreement** — the researcher accepts data collection terms.
2. **Permission Onboarding** — requests Camera, Location, and Storage permissions one by one, with context explaining why each is needed. Storage initialisation (internal or external) runs immediately after permissions are granted.
3. **Usage Guide** — a brief illustrated walkthrough of the capture workflow.

On subsequent launches these screens are skipped. Storage is re-verified on every start to pick up external storage if "Manage all files" access was enabled after initial setup.

---

## Screens

### Home

Dashboard showing:
- Current setup (municipality, barangay, farm, crops)
- Storage location and readiness status
- Total capture count from the CSV
- Quick-access buttons to Capture and Setup

### Setup

Configure the session metadata that is stamped onto every subsequent capture:

| Field | Description |
|-------|-------------|
| Municipality | One of 14 Benguet municipalities (La Trinidad, Atok, etc.) |
| Barangay | Barangay within the selected municipality |
| Farm name | Optional free-text label |
| Crops | Multi-select from a predefined list; custom crops can be added |
| Shots per spot | Number of photos taken per field location (default: 5) |
| Image quality | `720p` or `1080p` |
| Capture mode | `field` (outdoor) or `controlled` (lab/greenhouse) |

Setup is persisted to AsyncStorage and reloaded on next launch.

### Capture

The main data-collection screen:

- Live camera viewfinder with GPS accuracy indicator and compass heading overlay
- Automatically assigns a **spot number** (increments per new field location) and **shot number** (1–N within a spot)
- GPS is sampled continuously; capture is optionally gated on a minimum accuracy threshold
- Device orientation (pitch, roll, heading) is read from sensors at the moment of capture
- Weather data (temperature, humidity) is fetched from an open weather API using the capture GPS coordinates
- Image is saved to the configured storage location; metadata is appended to the CSV immediately

### Review

Browse captured records grouped by spot number and location. Each group shows the number of shots taken and the location label (`spot_number / municipality / barangay`). Tap a group to inspect individual shots.

### Data Viewer

Tabular view of all CSV records. Supports filtering by spot number, date, and location. Allows editing individual metadata fields via the **Edit Metadata Modal**.

### Export

Select groups of records (up to 20 at a time) and package them into a ZIP archive containing:
- The full CSV filtered to the selected records
- All corresponding image files

The ZIP is built in chunks to avoid memory pressure on low-RAM devices and shared via the Android share sheet (Files, Drive, WhatsApp, email, etc.).

### Soil Test

Manual entry of laboratory soil test results (N, P, K, pH, and other parameters) for a given sample. Results are saved to a separate `soil_tests.csv` and can be shared independently. This screen is separate from the photo capture workflow and is used after samples have been sent to a lab.

---

## CSV Data Schema

Every photo capture appends one row to the main CSV. The file is stored at:
```
{storage_root}/agricapture/data/captures.csv
```

| Column | Type | Description |
|--------|------|-------------|
| `uuid` | string | 8-character hex UUID — the primary key linking images to ML labels |
| `spot_number` | int | Field location index within this session |
| `shot_number` | int | Photo index within this spot |
| `shots_in_spot` | int | Total configured shots for this spot |
| `image_filename` | string | Filename of the saved image |
| `image_width` | int | Captured image width in pixels |
| `image_height` | int | Captured image height in pixels |
| `image_quality` | string | `720p` or `1080p` |
| `capture_datetime` | string | ISO 8601 timestamp at capture |
| `latitude` | float | GPS latitude in decimal degrees |
| `longitude` | float | GPS longitude in decimal degrees |
| `altitude_m` | float | GPS altitude in metres |
| `altitude_accuracy_m` | float | GPS altitude accuracy in metres |
| `gps_accuracy_m` | float | Horizontal GPS accuracy in metres |
| `gps_reading_count` | int | Number of GPS samples averaged for this fix |
| `camera_pitch` | float | Device pitch in degrees at capture |
| `camera_roll` | float | Device roll in degrees at capture |
| `camera_heading` | float | Compass heading in degrees at capture |
| `municipality` | string | Municipality from Setup (e.g. `La Trinidad`) |
| `barangay` | string | Barangay from Setup |
| `farm_name` | string | Optional farm label from Setup |
| `crops` | string | Comma-separated crop list from Setup |
| `temperature_c` | float | Ambient temperature at capture location (°C) |
| `humidity_percent` | float | Relative humidity at capture location (%) |
| `notes` | string | Optional researcher notes |

The `uuid` column is the join key to `datamaps/uuid_mapping_report.csv` in the ML pipeline.

---

## Storage Behaviour

AgriCapture prefers **external (device) storage** for captures so that files remain accessible via USB and the Files app:

```
/sdcard/AgriCapture/          (or equivalent external storage root)
├── images/                   # captured JPEGs
└── data/
    └── captures.csv          # main data log
```

If "Manage all files" (`MANAGE_EXTERNAL_STORAGE`) permission is not granted, the app falls back to **internal app storage**, which is private and requires ADB or a backup tool to retrieve.

Storage location is determined and cached at permission-grant time and re-verified on every app start. The Home screen shows the active storage path and a warning if only internal storage is available.

---

## Export and Sharing

From the Export screen:

1. **Select groups** — groups are shown as `spot_number / municipality / barangay`. Tap to select (max 20 groups per export to limit ZIP size).
2. **Build ZIP** — the app reads each selected image from storage and streams it into a ZIP archive alongside a filtered CSV. Large exports use chunked writing to avoid OOM errors.
3. **Share** — the ZIP is passed to the Android share sheet. Common targets: Google Drive, WhatsApp, email, local Files app.

The ZIP filename follows the pattern `agricapture_export_{timestamp}.zip`.

---

## Google Drive Integration

The `googleDriveService.js` implements OAuth 2.0 upload to a shared research Drive folder (`1y-w_LqKRDbpAcYvsoP1lIfsmjDwFOaJR`).

To enable this feature you must supply your own OAuth 2.0 client IDs:

1. Open [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create an OAuth 2.0 client for **Android** (package name: `com.agricapture.app`) and one for **Web**.
3. Edit `src/services/googleDriveService.js` and replace the placeholder values:

```js
const GOOGLE_CLIENT_ID = {
  android: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
  web:     'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
};
```

Without valid client IDs the Drive upload button will fail silently. The ZIP-based share flow (Export screen) works without any Google credentials.

---

## Project Structure

```
AgriCapture/
├── App.js                    # root component: nav stack, onboarding gate, font loading
├── app.json                  # Expo app config (version, permissions, EAS project ID)
├── index.js                  # Expo entry point
├── package.json
├── assets/                   # app icon, splash screen, fonts
├── plugins/
│   ├── withAndroidStoragePermissions.js   # adds MANAGE_EXTERNAL_STORAGE to manifest
│   └── enableLargeHeap.js                 # sets android:largeHeap="true"
└── src/
    ├── components/
    │   ├── AnimatedButton.js
    │   ├── CropSelector.js
    │   ├── EditMetadataModal.js
    │   ├── ExportRecordSelector.js
    │   ├── ExportRecordsList.js
    │   ├── GlassTabBar.js          # custom frosted-glass bottom tab bar
    │   ├── LocationSelector.js
    │   └── NetworkMonitor.js       # shows offline banner when no connectivity
    ├── constants/
    │   ├── crops.js                # predefined crop list
    │   ├── locations.js            # municipalities and barangays (Benguet, CAR)
    │   └── theme.js                # colours, fonts, spacing, shadow tokens
    ├── contexts/
    │   ├── NetworkContext.js       # provides network status to all screens
    │   └── PermissionContext.js    # provides permission state to all screens
    ├── screens/
    │   ├── CaptureScreen.js        # camera + GPS + orientation + weather capture
    │   ├── DataViewerScreen.js     # tabular CSV browser
    │   ├── ExportScreen.js         # ZIP builder and share sheet
    │   ├── HomeScreen.js           # dashboard
    │   ├── OnboardingGuide.js      # first-run usage walkthrough
    │   ├── PermissionOnboarding.js # guided permission request flow
    │   ├── ReviewScreen.js         # grouped capture review
    │   ├── SetupScreen.js          # session metadata configuration
    │   ├── SoilTestScreen.js       # manual lab result entry
    │   └── TermsAgreement.js       # first-run terms screen
    ├── services/
    │   ├── csvService.js           # CSV read/write/append, header management
    │   ├── googleDriveService.js   # OAuth + Drive upload
    │   ├── gpsService.js           # continuous location watching, accuracy helpers
    │   ├── orientationService.js   # device pitch/roll/heading via expo-sensors
    │   ├── permissionService.js    # onboarding completion flag
    │   ├── simpleStorageService.js # lightweight key/value storage wrapper
    │   ├── soilTestService.js      # soil test CSV CRUD
    │   ├── storageService.js       # storage path resolution, directory setup, config persistence
    │   └── weatherService.js       # current conditions fetch by GPS coordinates
    └── utils/
        ├── animations.js
        ├── fileNaming.js           # image filename generator
        ├── uuid.js                 # UUID generation
        └── zipChunkedWrite.js      # memory-safe ZIP writing helper
```

---

## Permissions

| Permission | Why it is needed |
|------------|-----------------|
| `CAMERA` | Taking field photographs |
| `ACCESS_FINE_LOCATION` | Geotagging captures with precise GPS coordinates |
| `ACCESS_COARSE_LOCATION` | Fallback location when fine GPS is unavailable |
| `HIGH_SAMPLING_RATE_SENSORS` | Reading orientation sensors (pitch/roll) at capture frame rate |
| `READ_EXTERNAL_STORAGE` | Reading images and CSV from device storage |
| `WRITE_EXTERNAL_STORAGE` | Saving images and CSV to device storage |
| `MANAGE_EXTERNAL_STORAGE` | Full external storage access (Android 11+); enables saving to `/sdcard/AgriCapture/` instead of sandboxed app storage |
