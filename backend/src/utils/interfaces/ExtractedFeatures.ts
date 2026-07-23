export interface ExtractedFeatures {
  features: number[];
}

export interface FeatureExtractionDetails {
  totalRules: number;
  foundRules: string[];
  missingRules: string[];
  ruleMapping: Record<string, { index: number; value: number }>;
  extractionSummary: string;
}

export interface DetailedFeatureExtraction {
  features: ExtractedFeatures;
  details: FeatureExtractionDetails;
}
