import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { buildRoute, matchesRoute, useUrlParams, ROUTES } from '../routeUtils';

describe('routeUtils', () => {
  it('builds dynamic routes', () => {
    const r = buildRoute('/cases/:caseId', { caseId: '123' });
    expect(r).toBe('/cases/123');
  });

  it('matches routes with params', () => {
    expect(matchesRoute('/cases/123', '/cases/:caseId')).toBe(true);
    expect(matchesRoute('/alerts/1', '/alerts/:alertId')).toBe(true);
    expect(matchesRoute('/alerts', '/alerts/:alertId')).toBe(false);
  });

  it('useUrlParams reads search params and getAllParams', () => {
    const TestComp: React.FC = () => {
      const { getParam, getAllParams } = useUrlParams();
      return (
        <div>
          <div data-testid="p">{getParam('foo')}</div>
          <div data-testid="all">{JSON.stringify(getAllParams())}</div>
        </div>
      );
    };

    render(
      <MemoryRouter initialEntries={[`/test?foo=bar&x=1`]}>
        <Routes>
          <Route path="/test" element={<TestComp />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('p')).toHaveTextContent('bar');
    expect(screen.getByTestId('all')).toHaveTextContent('foo');
    expect(ROUTES.CASES).toBe('/cases');
  });
});
