# 📘 Frontend Testing Guide

This guide outlines the testing standards, tools, and patterns used in the Case Management System frontend.

## 🛠 Tools & Frameworks

- **Vitest**: Test runner (fast, compatible with Jest)
- **React Testing Library**: Component testing (user-centric)
- **Mock Service Worker (MSW)**: API mocking
- **User Event**: Simulating user interactions

## 🏃‍♂️ Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run coverage report
npm run coverage
```

## 📝 Writing Tests

### 1. Component Tests

Use `render` from `src/test/testUtils.tsx` to ensure all providers are wrapped.

```tsx
import { render, screen, userEvent } from '../../../test/testUtils';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    const user = userEvent.setup();
    render(<MyComponent />);

    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Clicked')).toBeInTheDocument();
  });
});
```

### 2. API Mocking with MSW

We use MSW to intercept network requests. Handlers are defined in `src/test/mocks/handlers.ts`.

To override a handler for a specific test:

```tsx
import { server } from '../../../test/mocks/server';
import { http, HttpResponse } from 'msw';

it('should handle error state', async () => {
  server.use(
    http.get('/api/resource', () => {
      return HttpResponse.error();
    }),
  );

  render(<MyComponent />);
  expect(await screen.findByText('Error loading data')).toBeInTheDocument();
});
```

### 3. Testing Hooks

Use `renderHook` from `@testing-library/react`.

```tsx
import { renderHook, act } from '@testing-library/react';
import useMyHook from '../useMyHook';

it('should update state', () => {
  const { result } = renderHook(() => useMyHook());

  act(() => {
    result.current.update();
  });

  expect(result.current.value).toBe(true);
});
```

## 💡 Best Practices

1. **Test Behavior, Not Implementation**: Focus on what the user sees and does.
2. **Use `userEvent`**: Prefer `userEvent` over `fireEvent` for more realistic interactions.
3. **Avoid `act` Warnings**: Ensure all state updates are wrapped in `act` (React Testing Library handles most of this automatically with `userEvent` and `findBy*`).
4. **Mock External Services**: Mock API calls, local storage, and timers to ensure tests are deterministic.
5. **Use `findBy*` for Async**: When waiting for elements to appear (e.g., after API call), use `await screen.findByText(...)`.

## 📂 Test Structure

- `__tests__` folder co-located with the component/hook.
- Test files named `*.test.tsx` or `*.test.ts`.
- `src/test/` contains global setup, mocks, and utilities.

## 🐛 Common Issues & Fixes

- **"localStorage is not defined"**: Ensure `src/test/pre-setup.ts` is running (it mocks localStorage before MSW).
- **"Unable to find element"**: Check if the element is present. Use `screen.debug()` to print the DOM.
- **"Not wrapped in act"**: You likely need to await an async action or use `waitFor`.
