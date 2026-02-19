import { LinkDto } from "./transaction-detail.dto";

export class AlertNavigatorDto {
  alertId: number;
  transactionId: string;
  timestamp: string;
  transactionType: string;
  amount: AmountDto;
  status: string;
  reason: string;
  blockReason: string;
  typologies: TypologyDto[];
  rules: RuleDto[];
  blockStatus?: BlockStatusDto | null;
  relatedLinks: RelatedLinksDto;
  links: LinkDto[];
}

export class AmountDto {
  value: number;
  currency: string;
}

export class TypologyDto {
  id: string;
  score: number;
  threshold: number;
  rules: RuleDetailDto[];
}

export class RuleDetailDto {
  id: string;
  weight: number;
  description?: string; // Optional for additional details
}

export class RuleDto {
  id: string;
  weight: number;
}

export class BlockStatusDto {
  status: string;
  reason: string;
}

export class RelatedLinksDto {
  transactionDetail: string;
  transactionHistory: string;
  conditionsView: string;
  alertHistory: string;
  jupyterLab: string;
}
