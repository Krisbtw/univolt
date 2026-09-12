/**
 * barcode-detector.d.ts — Minimal ambient declaration for the BarcodeDetector API.
 * Only the subset used in ReferralScreen is declared here.
 * See: https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector
 */

interface DetectedBarcode {
  rawValue: string;
  format: string;
}

interface BarcodeDetectorOptions {
  formats?: string[];
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions);
  detect(image: ImageBitmapSource | HTMLVideoElement): Promise<DetectedBarcode[]>;
  static getSupportedFormats(): Promise<string[]>;
}
