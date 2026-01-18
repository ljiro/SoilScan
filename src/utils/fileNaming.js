import { sanitizeLocationName } from './sanitize';

export const generateImageFilename = (municipality, barangay, uuid, farmName = '') => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toISOString().slice(11, 19).replace(/:/g, '');

  const cleanMunicipality = sanitizeLocationName(municipality);
  const cleanBarangay = sanitizeLocationName(barangay);
  const cleanFarmName = farmName ? sanitizeLocationName(farmName) : '';

  // Build filename: municipality_barangay[_farmname]_date_time_uuid.jpg
  const parts = [cleanMunicipality, cleanBarangay];
  if (cleanFarmName) {
    parts.push(cleanFarmName);
  }
  parts.push(date, time, uuid);

  return `${parts.join('_')}.jpg`;
};
