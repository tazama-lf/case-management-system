import React from 'react';
import { render, screen } from '@testing-library/react';
import { AlertDetails } from '../AlertDetails';
import { describe, it, expect, vi } from 'vitest';

describe('AlertDetailsRoot', () => {
  it('renders without crashing', () => {
    render(
      <AlertDetails.Root alert={{ id: '1', title: 'Test Alert', status: 'open' }} onClose={() => {}}>
        <div>Test Alert</div>
      </AlertDetails.Root>
    );
    expect(screen.getByText(/Test Alert/i)).toBeInTheDocument();
  });
});
