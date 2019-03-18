/**
 * @flow strict-local
 */

const sharp = require('sharp');
const fs = require('fs').promises;

import type { Metadata } from 'sharp';
import type { AssetData, AssetDataPlugin } from 'metro/src/Assets';

const imageScales = [
  { scale: 1, suffix: '' },
  { scale: 2, suffix: '@2x' },
  { scale: 3, suffix: '@3x' },
];

async function reactNativeSvgAssetPlugin(
  assetData: AssetData,
): Promise<AssetData> {
  if (assetData.type === 'svg') {
    return convertSvg(assetData);
  } else {
    return assetData;
  }
}

async function convertSvg(assetData: AssetData): Promise<AssetData> {
  if (assetData.scales.length !== assetData.files.length) {
    throw new Error("Passed scales doesn't match passed files.");
  } else if (assetData.files.length === 0) {
    throw new Error('No files passed.');
  } else if (assetData.files.length > 1) {
    throw new Error('Multiple SVG scales not supported.');
  } else if (assetData.scales[0] !== 1) {
    throw new Error('Scaled SVGs not supported.');
  }

  const inputFilePath = assetData.files[0];
  const inputFileScale = assetData.scales[0];

  const imageData = await readSvg(inputFilePath);
  const outputImages = await Promise.all(
    imageScales.map(imageScale =>
      generatePng(
        imageData,
        imageScale.scale / inputFileScale,
        `${assetData.fileSystemLocation}/${assetData.name}${
          imageScale.suffix
        }.png`,
      ),
    ),
  );

  return {
    ...assetData,
    width: imageData.metadata.width,
    height: imageData.metadata.height,
    files: outputImages.map(outputImage => outputImage.filePath),
    scales: outputImages.map(outputImage => outputImage.scale),
    type: 'png',
  };
}

interface InputImage {
  buffer: Buffer;
  metadata: Metadata;
}

interface OutputImage {
  filePath: string;
  scale: number;
}

async function readSvg(inputFilePath: string): Promise<InputImage> {
  const fileBuffer = await fs.readFile(inputFilePath);
  const metadata = await sharp(fileBuffer).metadata();

  return {
    buffer: fileBuffer,
    metadata: metadata,
  };
}

async function generatePng(
  inputFile: InputImage,
  scale: number,
  outputFilePath: string,
): Promise<OutputImage> {
  if (inputFile.metadata.density === undefined) {
    throw new Error('Input image missing density information');
  }

  await sharp(inputFile.buffer, {
    density: inputFile.metadata.density * scale,
  })
    .png({
      adaptiveFiltering: false,
      compressionLevel: 9,
    })
    .toFile(outputFilePath);

  return {
    filePath: outputFilePath,
    scale: scale,
  };
}

const assetDataPlugin: AssetDataPlugin = reactNativeSvgAssetPlugin;
module.exports = assetDataPlugin;
