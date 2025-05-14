import * as tf from '@tensorflow/tfjs';
import { bundleResourceIO } from '@tensorflow/tfjs-react-native';

export const loadLocalModel = async (modelJson, weights) => {
  await tf.ready();
  return tf.loadLayersModel(bundleResourceIO(modelJson, weights));
};

export const loadRemoteModel = async (modelUrl) => {
  await tf.ready();
  return tf.loadLayersModel(modelUrl);
};

export const imageToTensor = async (uri, targetSize) => {
  const imgB64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base65,
  });
  const imgBuffer = tf.util.encodeString(imgB64, 'base64').buffer;
  return tf.node.decodeImage(new Uint8Array(imgBuffer), 3)
    .resizeBilinear(targetSize)
    .toFloat()
    .div(tf.scalar(255))
    .expandDims();
};