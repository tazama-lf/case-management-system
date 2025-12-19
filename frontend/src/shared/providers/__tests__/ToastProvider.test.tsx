import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from '../ToastProvider';

const TestConsumer: React.FC = () => {
  const { success, error, toasts, removeToast } = useToast();

  return (
    <div>
      <button onClick={() => success('OK', 'it worked')}>success</button>
      <button onClick={() => error('Bad', 'it failed')}>error</button>
      <div data-testid="count">{toasts.length}</div>
      <div data-testid="consumer-toasts">
        {toasts.map((t) => (
          <div key={t.id}>
            <span>{t.title}</span>
            <button onClick={() => removeToast(t.id)}>remove</button>
          </div>
        ))}
      </div>
    </div>
  );
};

describe('ToastProvider', () => {
  it('shows toasts when methods called and can remove them', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('success'));
    // check consumer-rendered toast (avoid matching provider UI toast which also contains same text)
    expect(screen.getByTestId('consumer-toasts')).toHaveTextContent('OK');
    expect(screen.getByTestId('count')).toHaveTextContent('1');

    fireEvent.click(screen.getByText('error'));
    expect(screen.getByTestId('consumer-toasts')).toHaveTextContent('Bad');
    expect(screen.getByTestId('count')).toHaveTextContent('2');

    // remove first toast
    fireEvent.click(screen.getAllByText('remove')[0]);
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });
});
