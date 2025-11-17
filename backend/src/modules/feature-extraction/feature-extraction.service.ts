import { Injectable } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { ExtractedFeatures, DetailedFeatureExtraction, FeatureExtractionDetails } from './interfaces/ExtractedFeatures';
import { IngestAlertDto } from 'src/dtos/IngestAlert.dto';

@Injectable()
export class FeatureExtractionService {
  private readonly RULE_SEQUENCE = [
    'result',
    '001',
    '002',
    '003',
    '004',
    '006',
    '007',
    '008',
    '010',
    '011',
    '016',
    '017',
    '018',
    '020',
    '021',
    '024',
    '025',
    '026',
    '027',
    '028',
    '030',
    '044',
    '045',
    '048',
    '054',
    '063',
    '074',
    '075',
    '076',
    '078',
    '083',
    '084',
    '090',
    '091',
  ];

  constructor(private readonly logger: LoggerService) {}

  async extractFeatures(alert: IngestAlertDto): Promise<ExtractedFeatures> {
    try {
      const features: number[] = new Array(this.RULE_SEQUENCE.length).fill(0);

      if (!alert.report?.tadpResult?.typologyResult?.[0]) {
        this.logger.warn('No typology results found in alert');
        return { features };
      }

      const typologyResults = alert.report.tadpResult.typologyResult[0];
      const ruleResults = typologyResults.ruleResults || [];
      features[0] = typologyResults.result;

      for (const ruleResult of ruleResults) {
        const ruleId = this.extractRuleId((ruleResult as any).id);
        const indpdntVarbl = Number((ruleResult as any).indpdntVarbl) || 0;

        const ruleIndex = this.RULE_SEQUENCE.indexOf(ruleId);
        if (ruleIndex !== -1) {
          features[ruleIndex] = indpdntVarbl;
          this.logger.debug(`Mapped rule ${ruleId} (index ${ruleIndex}) with value ${indpdntVarbl}`);
        } else {
          this.logger.warn(`Rule ${ruleId} not found in rule sequence`);
        }
      }

      const extractedFeatures: ExtractedFeatures = { features };
      this.logger.log(`Successfully extracted ${features.length} features from rule sequence`);

      return extractedFeatures;
    } catch (error) {
      this.logger.error(`Error extracting features: ${error.message}`, error.stack);
      throw new Error(`Feature extraction failed: ${error.message}`);
    }
  }

  private extractRuleId(fullRuleId: string): string {
    return fullRuleId.split('@')[0];
  }
}
