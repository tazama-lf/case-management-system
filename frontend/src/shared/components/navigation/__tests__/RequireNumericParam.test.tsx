import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RequireNumericParam, {
  isPositiveIntegerId,
} from '../RequireNumericParam';

const errorToast = vi.fn();

vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({ error: errorToast }),
}));

const renderAt = (path: string): ReturnType<typeof render> =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/cases/:caseId"
          element={
            <RequireNumericParam
              param="caseId"
              redirectTo="/cases"
              notFoundTitle="Case not found"
              notFoundMessage="The case id in the address is not valid."
            >
              <div>case page</div>
            </RequireNumericParam>
          }
        />
        <Route path="/cases" element={<div>cases list</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe('isPositiveIntegerId', () => {
  it.each(['1', '796', '123456', '9007199254740991'])('accepts %s', (value) => {
    expect(isPositiveIntegerId(value)).toBe(true);
  });

  it.each([
    undefined,
    '',
    ' ',
    'abc',
    'dbvjhdbvbfjhv',
    '0',
    '-5',
    '+5',
    '1.5',
    '007',
    '12abc',
    '1e3',
    '0x10',
    '9007199254740993',
    '99999999999999999999',
  ])('rejects %s', (value) => {
    expect(isPositiveIntegerId(value)).toBe(false);
  });
});

describe('RequireNumericParam', () => {
  beforeEach(() => {
    errorToast.mockClear();
  });

  it('renders the page for a valid id', () => {
    renderAt('/cases/796');

    expect(screen.getByText('case page')).toBeInTheDocument();
    expect(errorToast).not.toHaveBeenCalled();
  });

  it.each(['dbvjhdbvbfjhv', '0', '-5', '1.5', '007', '12abc'])(
    'reports "%s" as not found and redirects to the list',
    (id) => {
      renderAt(`/cases/${id}`);

      expect(screen.queryByText('case page')).not.toBeInTheDocument();
      expect(screen.getByText('cases list')).toBeInTheDocument();
      expect(errorToast).toHaveBeenCalledTimes(1);
      expect(errorToast).toHaveBeenCalledWith(
        'Case not found',
        'The case id in the address is not valid.',
      );
    },
  );
});
