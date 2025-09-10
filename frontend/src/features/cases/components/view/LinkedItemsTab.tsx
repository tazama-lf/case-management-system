import React from 'react';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-2">
    <div className="text-sm font-semibold text-gray-700">{title}</div>
    <div className="pl-1">{children}</div>
  </div>
);

const LinkItem: React.FC<{ href?: string; children: React.ReactNode }> = ({ href = '#', children }) => (
  <a href={href} className="block text-indigo-700 hover:underline">
    {children}
  </a>
);

const Pill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{children}</span>
);

const TypologyItem: React.FC<{ title: string; score: number }> = ({ title, score }) => (
  <div className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
    <div>{title}</div>
    <div className="text-xs text-gray-500">Risk Score: {score}</div>
  </div>
);

const LinkedItemsTab: React.FC = () => {
  return (
    <div className="space-y-6">
      <Section title="Related Items">
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-600">Related Cases</div>
            <LinkItem>Case A-10023 – Investigation</LinkItem>
            <LinkItem>Case B-10024 – Under Investigation</LinkItem>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-600">Related Alerts</div>
            <LinkItem>
              A-001 – Alert Type 1<Pill>Active</Pill>
            </LinkItem>
            <LinkItem>
              A-002 – Alert Type 2<Pill>Closed</Pill>
            </LinkItem>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-600">Related Transactions</div>
            <LinkItem>ADPSPKR28392 – Increased Debtor Activity</LinkItem>
            <LinkItem>ADPSPKR28393 – Multiple Same-Amount Transfers</LinkItem>
            <LinkItem>ADPSPKR28394 – Unusual Geographic Pattern</LinkItem>
          </div>
        </div>
      </Section>

      <Section title="Typologies Triggered">
        <div className="space-y-2">
          <TypologyItem title="False promotions, phishing, or social engineering scams" score={85} />
          <TypologyItem title="Duplication of payments from a single account" score={75} />
        </div>
      </Section>
    </div>
  );
};

export default LinkedItemsTab;
