import React from 'react';

interface PersonInformation {
  name: string;
  accountId: string;
  fsp: string;
}

interface PersonInformationCardProps {
  title: string;
  personInformation: PersonInformation;
}

const PersonInformationCard: React.FC<PersonInformationCardProps> = ({
  title,
  personInformation,
}) => {
  const informationItems = [
    { label: 'Name', value: personInformation.name },
    { label: 'Account ID', value: personInformation.accountId },
    { label: 'FSP', value: personInformation.fsp },
  ];

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-3">
        {informationItems.map((item) => (
          <div key={item.label} className="flex justify-between">
            <span className="text-sm text-gray-600">{item.label}</span>
            <span className="text-sm text-gray-900">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PersonInformationCard;
