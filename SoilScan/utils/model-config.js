// Complete Munsell Soil Color Chart Reference with Range-Based Descriptions
export const MUNSELL_COLORS = {
  // 11YR Hue Range (Yellowish Brown to Brown)
  '11YR 2/1': {
    name: 'Very Dark Grayish Brown',
    hex: '#4E3A36',
    description: 'Very dark grayish soils (Value 3, Chroma 1-2) indicate high organic matter content, typically found in forest floors or wetlands. These soils have excellent water retention but may need drainage improvements for agriculture.',
    range: '11YR 2/1-2/2',
    properties: ['High OM', 'Poor Drainage', 'Forest/Wetland']
  },
  '10YR 2/2': {
    name: 'Very Dark Brown',
    hex: '#3D2B1F',
    description: 'Very dark brown soils (Value 2, Chroma 2) are characteristic of fertile, organic-rich surfaces. Ideal for moisture-loving crops with good nutrient retention.',
    range: '10YR 2/1-2/2',
    properties: ['Rich Nutrients', 'Water Retentive', 'High CEC']
  },
  '10YR 3/1': {
    name: 'Dark Grayish Brown',
    hex: '#4A423B',
    description: 'Dark grayish brown soils (Value 3, Chroma 1-2) suggest moderate organic matter with some drainage limitations. Common in transitional zones between wetlands and uplands.',
    range: '10YR 3/1-3/2',
    properties: ['Moderate OM', 'Seasonal Wetness', 'Transitional']
  },
  '10YR 3/2': {
    name: 'Dark Brown',
    hex: '#4E3524',
    description: 'Dark brown agricultural soils (Value 3, Chroma 2-3) represent productive topsoil with good structure and balanced properties for most crops.',
    range: '10YR 3/2-3/3',
    properties: ['Good Fertility', 'Balanced Drainage', 'Versatile']
  },
  '10YR 3/3': {
    name: 'Dark Brown',
    hex: '#5C4033',
    description: 'Dark brown soils (Value 4, Chroma 3-4) indicate excellent tilth and biological activity. The slightly higher chroma suggests good aeration and root development.',
    range: '10YR 3/2-3/3',
    properties: ['High CEC', 'Good Tilth', 'Well-Aerated']
  },
  '10YR 4/2': {
    name: 'Brown',
    hex: '#5D4E3D',
    description: 'Medium brown soils (Value 4, Chroma 2-3) are typical of cultivated areas with moderate organic matter. May require occasional amendments for optimal productivity.',
    range: '10YR 4/2-4/3',
    properties: ['Medium Fertility', 'Responsive', 'Agricultural']
  },
  '10YR 4/3': {
    name: 'Brown',
    hex: '#6E4F3A',
    description: 'Brown soils (Value 4, Chroma 3-4) have good workability and drainage. The increased chroma suggests better oxidation and mineral content.',
    range: '10YR 4/2-4/3',
    properties: ['Good Workability', 'Moderate Drainage', 'Mineral Rich']
  },
  '10YR 4/4': {
    name: 'Brown',
    hex: '#7A5C43',
    description: 'Brown soils (Value 4, Chroma 4-6) with stronger color indicate well-aerated conditions. May be slightly coarse-textured but responsive to management.',
    range: '10YR 4/4-4/6',
    properties: ['Well-Aerated', 'Sandy Loam', 'Responsive']
  },
  '10YR 5/2': {
    name: 'Light Brown',
    hex: '#7D6B58',
    description: 'Light brown soils (Value 5, Chroma 2-3) suggest some topsoil loss or naturally lower organic content. Benefit from conservation practices.',
    range: '10YR 5/2-5/3',
    properties: ['Eroded', 'Low OM', 'Needs Conservation']
  },
  '10YR 5/4': {
    name: 'Light Brown',
    hex: '#8C6F52',
    description: 'Light brown soils (Value 5, Chroma 4-6) are often found in sandy or eroded areas. Require organic amendments to improve water retention.',
    range: '10YR 5/4-5/6',
    properties: ['Sandy', 'Low Water Holding', 'Amendment Needed']
  },
  '10YR 5/6': {
    name: 'Yellowish Brown',
    hex: '#9E7E58',
    description: 'Yellowish brown soils (Value 5, Chroma 6-8) indicate sandy textures with rapid drainage. Low nutrient retention but easy to work.',
    range: '10YR 5/4-5/8',
    properties: ['Fast Draining', 'Low CEC', 'Easy Tillage']
  },
  '10YR 5/8': {
    name: 'Yellowish Brown',
    hex: '#D2B48C',
    description: 'Strong yellowish brown (Value 5-6, Chroma 6-8) suggests very sandy composition. Requires frequent irrigation and fertilization.',
    range: '10YR 5/6-6/8',
    properties: ['Very Sandy', 'High Permeability', 'Frequent Inputs']
  },
  '10YR 6/2': {
    name: 'Pale Brown',
    hex: '#A08F7A',
    description: 'Pale brown soils (Value 6, Chroma 2-3) indicate significant organic matter loss. Typically subsoil material or highly weathered surfaces.',
    range: '10YR 6/2-6/3',
    properties: ['Weathered', 'Low Fertility', 'Subsoil']
  },
  '10YR 6/4': {
    name: 'Pale Brown',
    hex: '#B09A7A',
    description: 'Pale brown to yellowish soils (Value 6, Chroma 4-6) are characteristic of arid or highly leached environments. Often require substantial amendments.',
    range: '10YR 6/4-6/6',
    properties: ['Arid', 'Leached', 'High Maintenance']
  },

  // 7.5YR Hue Range (Reddish Brown)
  '7.5YR 2/1': {
    name: 'Very Dark Brown',
    hex: '#3A2E23',
    description: 'Very dark reddish brown soils (7.5YR 2/1-2/2) contain more iron oxides than 10YR equivalents. Found in forest soils with good structure.',
    range: '7.5YR 2/1-2/2',
    properties: ['Iron Rich', 'Forest Soils', 'High OM']
  },
  '7.5YR 3/2': {
    name: 'Dark Brown',
    hex: '#4A3B2A',
    description: 'Dark reddish brown soils (7.5YR 3/2-3/4) indicate good agricultural potential with stable structure. Slightly more weathered than 10YR equivalents.',
    range: '7.5YR 3/2-3/4',
    properties: ['Stable Structure', 'Good Aggregation', 'Versatile']
  },
  '7.5YR 4/4': {
    name: 'Brown',
    hex: '#755C48',
    description: 'Reddish brown soils (7.5YR 4/4-4/6) show moderate iron oxidation. Well-drained with good workability for most crops.',
    range: '7.5YR 4/4-4/6',
    properties: ['Iron Oxides', 'Well-Drained', 'Good Tilth']
  },

  // 5YR Hue Range (Reddish Brown to Red)
  '5YR 3/3': {
    name: 'Dark Reddish Brown',
    hex: '#5E3A2E',
    description: 'Dark reddish brown soils (5YR 3/3-3/4) indicate significant iron content and good structure. Common in temperate climates with good drainage.',
    range: '5YR 3/3-3/4',
    properties: ['High Iron', 'Well-Structured', 'Temperate']
  },
  '5YR 4/4': {
    name: 'Reddish Brown',
    hex: '#7F4F3A',
    description: 'Reddish brown soils (5YR 4/4-4/6) are typical of well-drained, weathered soils. Excellent for root crops but may need pH adjustment.',
    range: '5YR 4/4-4/6',
    properties: ['Weathered', 'Good Drainage', 'Root Crops']
  },
  '5YR 4/6': {
    name: 'Red',
    hex: '#A52A2A',
    description: 'Red soils (5YR 4/6-5/8) show advanced oxidation and weathering. Often acidic with high mineral content but low organic matter.',
    range: '5YR 4/6-5/8',
    properties: ['Highly Oxidized', 'Acidic', 'Mineral Rich']
  },

  // 2.5YR Hue Range (Red)
  '2.5YR 3/6': {
    name: 'Dark Red',
    hex: '#8B2E16',
    description: 'Dark red soils (2.5YR 3/6-4/6) are highly weathered and often nutrient-deficient. Require careful management and regular fertilization.',
    range: '2.5YR 3/6-4/6',
    properties: ['Highly Weathered', 'Leached', 'Nutrient Poor']
  },

  // 5Y Hue Range (Gray)
  '5Y 5/1': {
    name: 'Gray',
    hex: '#8C8C8C',
    description: 'Gray soils (5Y 5/1-6/1) indicate poor drainage and reducing conditions. Often found in wetlands or compacted subsoils.',
    range: '5Y 5/1-6/1',
    properties: ['Gleyed', 'Anaerobic', 'Poor Drainage']
  },
  '5Y 6/1': {
    name: 'Light Gray',
    hex: '#C0C0C0',
    description: 'Light gray colors (5Y 6/1-6/2) are diagnostic of prolonged water saturation. Typically subsoil material needing drainage improvements.',
    range: '5Y 6/1-6/2',
    properties: ['Waterlogged', 'Subsoil', 'Compacted']
  },
  '5Y 6/2': {
    name: 'Light Olive Gray',
    hex: '#A8A892',
    description: 'Olive gray soils (5Y 6/2-7/2) show transitional hydrology. Exhibit mottling from seasonal water table fluctuations.',
    range: '5Y 6/2-7/2',
    properties: ['Mottled', 'Seasonal Wetness', 'Transitional']
  },

  // Gley Colors (10G, 5G, etc.)
  '10G 5/1': {
    name: 'Greenish Gray',
    hex: '#7A918D',
    description: 'Greenish gray soils (10G 5/1-6/1) indicate permanent reducing conditions. Characteristic of wetlands with high water tables.',
    range: '10G 5/1-6/1',
    properties: ['Anaerobic', 'Wetland', 'Reduced Iron']
  }
};

// Model output mapping
export const MODEL_OUTPUT_MAPPING = Object.keys(MUNSELL_COLORS);

// Color family groupings
export const MUNSELL_FAMILIES = {
  browns: Object.keys(MUNSELL_COLORS).filter(k => k.includes('YR') && !k.includes('5/6') && !k.includes('5/8') && !k.includes('6/')),
  reds: Object.keys(MUNSELL_COLORS).filter(k => k.includes('YR') && (k.includes('5/6') || k.includes('5/8') || k.includes('4/6')) 
           .concat(Object.keys(MUNSELL_COLORS).filter(k => k.includes('2.5YR')) 
           .concat(Object.keys(MUNSELL_COLORS).filter(k => k.includes('5YR') && parseInt(k.split('/')[1]) >= 4)),
  grays: Object.keys(MUNSELL_COLORS).filter(k => k.includes('Y ') || k.includes('G ')),
  yellows: Object.keys(MUNSELL_COLORS).filter(k => k.includes('10YR') && (k.includes('5/6') || k.includes('5/8') || k.includes('6/'))),
};