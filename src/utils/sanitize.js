export const sanitizeLocationName = (name) => {
  if (!name) return 'unknown';

  return name
    .toLowerCase()
    .replace(/\s+/g, '')      // Remove spaces
    .replace(/[^a-z0-9]/g, '') // Remove special chars
    .slice(0, 15);             // Max 15 chars
};
