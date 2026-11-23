import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import ConditionsTab from '../conditions/ConditionsTab';

vi.mock('../network-analysis/VoilaFrame', () => ({
  default: ({ title, notebookPath, queryParams }: any) => (
    <div data-testid="voila-frame">
      <span>{title}</span>
      <span>{notebookPath}</span>
      <span>{queryParams?.transactionId}</span>
      <span data-testid="frame-as-of">{queryParams?.asOf}</span>
      <span data-testid="frame-tenant">{queryParams?.tenantId}</span>
    </div>
  ),
}));

describe('ConditionsTab', () => {
  it('renders VoilaFrame with conditions timeline', () => {
    render(<ConditionsTab transactionId="TXN-001" tenantId="DEFAULT" />);
    expect(screen.getByTestId('voila-frame')).toBeInTheDocument();
    expect(screen.getByText('Conditions Timeline')).toBeInTheDocument();
    expect(screen.getByText('conditions-timeline.ipynb')).toBeInTheDocument();
  });

  it('passes query params to VoilaFrame', () => {
    render(<ConditionsTab transactionId="TXN-002" tenantId="T1" />);
    expect(screen.getByText('TXN-002')).toBeInTheDocument();
    expect(screen.getByTestId('frame-tenant')).toHaveTextContent('T1');
  });

  describe('as-of switch', () => {
    it('offers "As of now" and "At transaction time" as a radio group, with "As of now" selected by default', () => {
      render(<ConditionsTab transactionId="TXN-001" tenantId="DEFAULT" />);

      expect(
        screen.getByRole('group', { name: /show conditions as of/i }),
      ).toBeInTheDocument();
      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(2);
      expect(screen.getByRole('radio', { name: /as of now/i })).toBeChecked();
      expect(
        screen.getByRole('radio', { name: /at transaction time/i }),
      ).not.toBeChecked();
    });

    it('asks the notebook for the current time by default', () => {
      render(<ConditionsTab transactionId="TXN-001" tenantId="DEFAULT" />);
      expect(screen.getByTestId('frame-as-of')).toHaveTextContent('now');
      expect(
        screen.getByTestId('conditions-as-of-description'),
      ).toHaveTextContent(/in force right now/i);
    });

    it('switches to the transaction time and back, updating the notebook request and the description', async () => {
      const user = userEvent.setup();
      render(<ConditionsTab transactionId="TXN-001" tenantId="DEFAULT" />);

      await user.click(
        screen.getByRole('radio', { name: /at transaction time/i }),
      );
      expect(
        screen.getByRole('radio', { name: /at transaction time/i }),
      ).toBeChecked();
      expect(screen.getByRole('radio', { name: /as of now/i })).not.toBeChecked();
      expect(screen.getByTestId('frame-as-of')).toHaveTextContent(
        'transaction',
      );
      expect(
        screen.getByTestId('conditions-as-of-description'),
      ).toHaveTextContent(/when the transaction was made/i);

      await user.click(screen.getByRole('radio', { name: /as of now/i }));
      expect(screen.getByTestId('frame-as-of')).toHaveTextContent('now');
    });

    it('can be operated from the keyboard', async () => {
      const user = userEvent.setup();
      render(<ConditionsTab transactionId="TXN-001" tenantId="DEFAULT" />);

      await user.tab();
      expect(screen.getByRole('radio', { name: /as of now/i })).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(
        screen.getByRole('radio', { name: /at transaction time/i }),
      ).toBeChecked();
    });

    it('keeps the transaction and tenant when the choice changes', async () => {
      const user = userEvent.setup();
      render(<ConditionsTab transactionId="TXN-009" tenantId="T9" />);

      await user.click(
        screen.getByRole('radio', { name: /at transaction time/i }),
      );
      expect(screen.getByText('TXN-009')).toBeInTheDocument();
      expect(screen.getByTestId('frame-tenant')).toHaveTextContent('T9');
    });
  });
});
