export class AlertNavigatorDto {
  alertId: string;
  transactionId: string;
  timestamp: string;
  transactionType: string;
  reason: string;
  typologies: TypologyDto[];
  rules: RuleDto[];
  blockStatus?: BlockStatusDto | null;
  relatedLinks: RelatedLinksDto;
}

export class TypologyDto {
  id: string;
  config: string;
  alertThreshold: number;
  interdictionThreshold: number;
}

export class RuleDto {
  id: string;
  config: string;
  weighting: number;
  independentVariable: string;
}

export class BlockStatusDto {
  status: string;
  reason: string;
}

export class RelatedLinksDto {
  transactionDetails: string;
  transactionHistory: string;
  conditionsView: string;
  alertHistory: string;
}
