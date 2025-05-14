// Configuration for your ResNet50 model
export const MODEL_CONFIG = {
  inputSize: [224, 224],
  meanRGB: [0.485, 0.456, 0.406], // ImageNet normalization
  stdRGB: [0.229, 0.224, 0.225],
  classes: [
    { name: 'Dark Brown', hex: '#5C4033' },
    { name: 'Reddish Brown', hex: '#A52A2A' },
    // Add your soil color classes
  ]
};