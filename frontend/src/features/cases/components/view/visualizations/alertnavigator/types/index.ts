export interface AmountDto {
  value: number;
  currency: string;
}

export interface RuleDetailDto {
  id: string;
  weight: number;
  description?: string;
}

export interface TypologyDto {
  id: string;
  score: number;
  threshold: number;
  rules: RuleDetailDto[];
}

export interface RuleDto {
  id: string;
  weight: number;
}

export interface BlockStatusDto {
  status: string;
  reason: string;
}

export interface LinkDto {
  rel: string;
  href: string;
}

export interface RelatedLinksDto {
  transactionDetail: string;
  transactionHistory: string;
  conditionsView: string;
  alertHistory: string;
  jupyterLab: string;
}

export interface AlertNavigatorDto {
  alertMetadata: any;
  alertId: string;
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
