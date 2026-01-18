// Benguet Highland Crops based on CAR agricultural data
// Reference: Thesis - Satellite Remote Sensing for Soil Nutrient Analysis in CAR

export const CROPS = [
  // Highland Vegetables (Primary crops in Benguet)
  { id: 'cabbage', label: 'Cabbage', category: 'highland' },
  { id: 'carrot', label: 'Carrot', category: 'highland' },
  { id: 'potato', label: 'Potato', category: 'highland' },
  { id: 'lettuce', label: 'Lettuce', category: 'highland' },
  { id: 'broccoli', label: 'Broccoli', category: 'highland' },
  { id: 'cauliflower', label: 'Cauliflower', category: 'highland' },
  { id: 'pechay', label: 'Pechay', category: 'highland' },
  { id: 'sayote', label: 'Sayote', category: 'highland' },
  { id: 'tomato', label: 'Tomato', category: 'highland' },
  { id: 'bell_pepper', label: 'Bell Pepper', category: 'highland' },
  { id: 'beans', label: 'Beans', category: 'highland' },
  { id: 'radish', label: 'Radish', category: 'highland' },
  { id: 'celery', label: 'Celery', category: 'highland' },
  { id: 'wombok', label: 'Wombok', category: 'highland' },

  // Root Crops
  { id: 'sweet_potato', label: 'Sweet Potato', category: 'root' },
  { id: 'gabi', label: 'Gabi', category: 'root' },

  // Fruits (La Trinidad specialty)
  { id: 'strawberry', label: 'Strawberry', category: 'fruit' },

  // Cereals
  { id: 'rice', label: 'Rice', category: 'cereal' },
  { id: 'corn', label: 'Corn', category: 'cereal' },

  // Cash Crops
  { id: 'coffee', label: 'Coffee', category: 'cash' },

  // Other
  { id: 'other', label: 'Other', category: 'other' },
];

// Default crops for Benguet highland vegetable farming
// These are the most common crops in La Trinidad, Tublay, Sablan, Tuba, Itogon
export const DEFAULT_CROP_IDS = [
  'cabbage',
  'carrot',
  'potato',
  'lettuce',
  'pechay',
  'sayote',
  'beans',
];

// Get default crops as full objects
export const getDefaultCrops = () => {
  return CROPS.filter(crop => DEFAULT_CROP_IDS.includes(crop.id));
};
