import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
// Use legacy API - supported until SDK 55
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Complete auth session for web browser redirect
WebBrowser.maybeCompleteAuthSession();

// Storage keys
const TOKEN_KEY = '@agricapture_google_token';
const USER_KEY = '@agricapture_google_user';

// Your target folder ID from the Google Drive link
const TARGET_FOLDER_ID = '1y-w_LqKRDbpAcYvsoP1lIfsmjDwFOaJR';

// Google OAuth Client IDs - YOU NEED TO SET THESE UP
// Go to: https://console.cloud.google.com/apis/credentials
// Create OAuth 2.0 Client IDs for Android and Web
const GOOGLE_CLIENT_ID = {
  android: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
  web: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
};

/**
 * Hook for Google authentication
 * Use this in your component: const [request, response, promptAsync] = useGoogleAuth();
 */
export const useGoogleAuth = () => {
  return Google.useAuthRequest({
    androidClientId: GOOGLE_CLIENT_ID.android,
    webClientId: GOOGLE_CLIENT_ID.web,
    scopes: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  });
};

/**
 * Save authentication token
 */
export const saveAuthToken = async (token) => {
  try {
    await AsyncStorage.setItem(TOKEN_KEY, JSON.stringify(token));
    console.log('[GoogleDrive] Token saved');
  } catch (error) {
    console.error('[GoogleDrive] Error saving token:', error);
  }
};

/**
 * Get saved authentication token
 */
export const getAuthToken = async () => {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    return token ? JSON.parse(token) : null;
  } catch (error) {
    console.error('[GoogleDrive] Error getting token:', error);
    return null;
  }
};

/**
 * Save user info
 */
export const saveUserInfo = async (user) => {
  try {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('[GoogleDrive] Error saving user:', error);
  }
};

/**
 * Get saved user info
 */
export const getUserInfo = async () => {
  try {
    const user = await AsyncStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  } catch (error) {
    console.error('[GoogleDrive] Error getting user:', error);
    return null;
  }
};

/**
 * Clear authentication (sign out)
 */
export const signOut = async () => {
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
    console.log('[GoogleDrive] Signed out');
  } catch (error) {
    console.error('[GoogleDrive] Error signing out:', error);
  }
};

/**
 * Fetch user profile from Google
 */
export const fetchUserProfile = async (accessToken) => {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error('Failed to fetch user profile');
    return await response.json();
  } catch (error) {
    console.error('[GoogleDrive] Error fetching profile:', error);
    return null;
  }
};

/**
 * Check if a folder exists in Google Drive
 */
const findFolder = async (accessToken, folderName, parentId) => {
  try {
    const query = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) throw new Error('Failed to search folders');

    const data = await response.json();
    return data.files && data.files.length > 0 ? data.files[0] : null;
  } catch (error) {
    console.error('[GoogleDrive] Error finding folder:', error);
    return null;
  }
};

/**
 * Create a folder in Google Drive
 */
const createFolder = async (accessToken, folderName, parentId) => {
  try {
    const metadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    };

    const response = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });

    if (!response.ok) throw new Error('Failed to create folder');

    return await response.json();
  } catch (error) {
    console.error('[GoogleDrive] Error creating folder:', error);
    throw error;
  }
};

/**
 * Get or create device folder
 */
export const getOrCreateDeviceFolder = async (accessToken, deviceId) => {
  try {
    // Check if folder exists
    let folder = await findFolder(accessToken, deviceId, TARGET_FOLDER_ID);

    if (!folder) {
      // Create the folder
      console.log('[GoogleDrive] Creating device folder:', deviceId);
      folder = await createFolder(accessToken, deviceId, TARGET_FOLDER_ID);
    }

    return folder;
  } catch (error) {
    console.error('[GoogleDrive] Error with device folder:', error);
    throw error;
  }
};

/**
 * Get or create images subfolder
 */
export const getOrCreateImagesFolder = async (accessToken, parentFolderId) => {
  try {
    let folder = await findFolder(accessToken, 'images', parentFolderId);

    if (!folder) {
      console.log('[GoogleDrive] Creating images folder');
      folder = await createFolder(accessToken, 'images', parentFolderId);
    }

    return folder;
  } catch (error) {
    console.error('[GoogleDrive] Error with images folder:', error);
    throw error;
  }
};

/**
 * Upload a file to Google Drive
 */
export const uploadFile = async (accessToken, filePath, fileName, folderId, mimeType, onProgress) => {
  try {
    console.log('[GoogleDrive] Uploading:', fileName);

    // Read file content
    const fileContent = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Create multipart request
    const boundary = 'agricapture_boundary_' + Date.now();
    const metadata = {
      name: fileName,
      parents: [folderId],
    };

    const multipartBody =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n` +
      `Content-Transfer-Encoding: base64\r\n\r\n` +
      `${fileContent}\r\n` +
      `--${boundary}--`;

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Upload failed: ${error}`);
    }

    const result = await response.json();
    console.log('[GoogleDrive] Uploaded:', result.name, 'ID:', result.id);

    if (onProgress) onProgress();

    return result;
  } catch (error) {
    console.error('[GoogleDrive] Upload error:', error);
    throw error;
  }
};

/**
 * Check if file exists in folder
 */
export const fileExistsInFolder = async (accessToken, fileName, folderId) => {
  try {
    const query = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) return false;

    const data = await response.json();
    return data.files && data.files.length > 0;
  } catch (error) {
    return false;
  }
};

/**
 * Delete a file from Google Drive (to replace with updated version)
 */
export const deleteFile = async (accessToken, fileName, folderId) => {
  try {
    const query = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) return;

    const data = await response.json();

    for (const file of data.files || []) {
      await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    }
  } catch (error) {
    console.warn('[GoogleDrive] Error deleting file:', error);
  }
};

/**
 * Full sync operation - uploads CSV and all images
 */
export const syncToGoogleDrive = async (accessToken, deviceId, csvPath, imagePaths, onProgress) => {
  const results = {
    success: true,
    csvUploaded: false,
    imagesUploaded: 0,
    totalImages: imagePaths.length,
    errors: [],
  };

  try {
    // Step 1: Get or create device folder
    onProgress?.({ step: 'folder', message: 'Creating device folder...' });
    const deviceFolder = await getOrCreateDeviceFolder(accessToken, deviceId);

    // Step 2: Get or create images subfolder
    const imagesFolder = await getOrCreateImagesFolder(accessToken, deviceFolder.id);

    // Step 3: Upload CSV (delete old one first to update)
    onProgress?.({ step: 'csv', message: 'Uploading CSV...' });
    await deleteFile(accessToken, 'agricapture_collections.csv', deviceFolder.id);
    await uploadFile(
      accessToken,
      csvPath,
      'agricapture_collections.csv',
      deviceFolder.id,
      'text/csv'
    );
    results.csvUploaded = true;

    // Step 4: Upload images
    for (let i = 0; i < imagePaths.length; i++) {
      const imagePath = imagePaths[i];
      const fileName = imagePath.split('/').pop();

      onProgress?.({
        step: 'images',
        message: `Uploading image ${i + 1}/${imagePaths.length}...`,
        current: i + 1,
        total: imagePaths.length,
      });

      try {
        // Check if image already exists
        const exists = await fileExistsInFolder(accessToken, fileName, imagesFolder.id);

        if (!exists) {
          await uploadFile(
            accessToken,
            imagePath,
            fileName,
            imagesFolder.id,
            'image/jpeg'
          );
        }

        results.imagesUploaded++;
      } catch (imgError) {
        console.error('[GoogleDrive] Error uploading image:', fileName, imgError);
        results.errors.push(`Failed to upload ${fileName}`);
      }
    }

    onProgress?.({ step: 'done', message: 'Sync complete!' });

  } catch (error) {
    console.error('[GoogleDrive] Sync error:', error);
    results.success = false;
    results.errors.push(error.message);
  }

  return results;
};
