import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import {
  buildRoute,
  matchesRoute,
  useUrlParams,
  useDynamicRoute,
  ROUTES,
} from '../routeUtils';

describe('routeUtils', () => {
  describe('buildRoute', () => {
    it('builds dynamic routes with single param', () => {
      const r = buildRoute('/cases/:caseId', { caseId: '123' });
      expect(r).toBe('/cases/123');
    });

    it('builds dynamic routes with multiple params', () => {
      const r = buildRoute('/cases/:caseId/tasks/:taskId', {
        caseId: '123',
        taskId: '456',
      });
      expect(r).toBe('/cases/123/tasks/456');
    });

    it('handles routes without params', () => {
      const r = buildRoute('/cases', {});
      expect(r).toBe('/cases');
    });
  });

  describe('matchesRoute', () => {
    it('matches routes with single param', () => {
      expect(matchesRoute('/cases/123', '/cases/:caseId')).toBe(true);
      expect(matchesRoute('/alerts/1', '/alerts/:alertId')).toBe(true);
    });

    it('does not match routes without required params', () => {
      expect(matchesRoute('/alerts', '/alerts/:alertId')).toBe(false);
      expect(matchesRoute('/cases', '/cases/:caseId')).toBe(false);
    });

    it('matches routes with multiple params', () => {
      expect(
        matchesRoute('/cases/123/tasks/456', '/cases/:caseId/tasks/:taskId'),
      ).toBe(true);
    });

    it('does not match completely different routes', () => {
      expect(matchesRoute('/dashboard', '/cases/:caseId')).toBe(false);
    });
  });

  describe('ROUTES', () => {
    it('defines all route constants', () => {
      expect(ROUTES.HOME).toBe('/');
      expect(ROUTES.LOGIN).toBe('/login');
      expect(ROUTES.DASHBOARD).toBe('/dashboard');
      expect(ROUTES.CASES).toBe('/cases');
      expect(ROUTES.CASE_DETAIL).toBe('/cases/:caseId');
      expect(ROUTES.ALERTS).toBe('/alerts');
      expect(ROUTES.ALERT_DETAIL).toBe('/alerts/:alertId');
      expect(ROUTES.WORK_QUEUE).toBe('/work-queue');
      expect(ROUTES.WORK_QUEUE_TASK).toBe('/work-queue/:taskId');
      expect(ROUTES.REPORTS).toBe('/reports');
      expect(ROUTES.REPORT_DETAIL).toBe('/reports/:reportType');
      expect(ROUTES.ADMIN).toBe('/admin');
    });
  });

  describe('useUrlParams', () => {
    it('reads search params', () => {
      const TestComp: React.FC = () => {
        const { getParam, getAllParams } = useUrlParams();
        return (
          <div>
            <div data-testid="p">{getParam('foo') || ''}</div>
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
      const allParams = JSON.parse(
        screen.getByTestId('all').textContent || '{}',
      );
      expect(allParams.foo).toBe('bar');
      expect(allParams.x).toBe('1');
    });

    it('handles setParam and removeParam', async () => {
      const { userEvent } = await import('@testing-library/user-event');
      const user = userEvent.setup();
      const TestComp: React.FC = () => {
        const { getParam, setParam, removeParam } = useUrlParams();
        return (
          <div>
            <div data-testid="value">{getParam('test') || ''}</div>
            <button onClick={() => setParam('test', 'value')}>Set</button>
            <button onClick={() => removeParam('test')}>Remove</button>
          </div>
        );
      };

      render(
        <MemoryRouter initialEntries={[`/test`]}>
          <Routes>
            <Route path="/test" element={<TestComp />} />
          </Routes>
        </MemoryRouter>,
      );

      const setButton = screen.getByText('Set');
      await user.click(setButton);

      await waitFor(() => {
        expect(screen.getByTestId('value')).toHaveTextContent('value');
      });

      const removeButton = screen.getByText('Remove');
      await user.click(removeButton);

      await waitFor(() => {
        expect(screen.getByTestId('value')).toHaveTextContent('');
      });
    });
  });

  describe('useDynamicRoute', () => {
    it('provides navigation helpers', () => {
      const TestComp: React.FC = () => {
        const { goToCaseDetail, goToAlertDetail, getCurrentRoute } =
          useDynamicRoute();
        return (
          <div>
            <button
              onClick={() => {
                goToCaseDetail('CASE-1');
              }}
            >
              Go to Case
            </button>
            <button
              onClick={() => {
                goToAlertDetail('ALERT-1');
              }}
            >
              Go to Alert
            </button>
            <div data-testid="route">{getCurrentRoute().pathname}</div>
          </div>
        );
      };

      render(
        <MemoryRouter initialEntries={[`/test`]}>
          <Routes>
            <Route path="/test" element={<TestComp />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByTestId('route')).toHaveTextContent('/test');
    });
  });
});
