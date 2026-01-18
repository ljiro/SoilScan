import * as Crypto from 'expo-crypto';

export const generateUUID = () => {
  return Crypto.randomUUID().split('-')[0]; // Short 8-char UUID
};

export const generateFullUUID = () => {
  return Crypto.randomUUID();
};
