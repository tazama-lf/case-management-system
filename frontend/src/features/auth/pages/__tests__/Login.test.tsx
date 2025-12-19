import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Login from '../Login';
import { useAuth } from '../../components/AuthContext';

vi.mock('../../components/AuthContext');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

const mockUseAuth = useAuth as vi.Mock;

const renderLogin = () => {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );
};

describe('Login', () => {
  const mockLogin = vi.fn();
  const mockClearError = vi.fn();
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      login: mockLogin,
      loading: false,
      error: null,
      isAuthenticated: false,
      clearError: mockClearError,
    });
    vi.doMock('react-router-dom', () => ({
      ...vi.importActual('react-router-dom'),
      useNavigate: () => mockNavigate,
    }));
  });

  it('renders login form with all fields', () => {
    renderLogin();

    expect(screen.getByLabelText(/Login ID/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign in/i })).toBeInTheDocument();
  });

  it('renders Tazama branding', () => {
    renderLogin();

    expect(screen.getByText('Tazama Case Management System')).toBeInTheDocument();
    expect(screen.getByText('Investigation Platform')).toBeInTheDocument();
  });

  it('displays error message when error is present', () => {
    mockUseAuth.mockReturnValue({
      login: mockLogin,
      loading: false,
      error: 'Invalid credentials',
      isAuthenticated: false,
      clearError: mockClearError,
    });

    renderLogin();

    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
  });

  it('allows user to enter username and password', async () => {
    const user = userEvent.setup();
    renderLogin();

    const usernameInput = screen.getByLabelText(/Login ID/i);
    const passwordInput = screen.getByLabelText(/Password/i);

    await user.type(usernameInput, 'test-user');
    await user.type(passwordInput, 'password123');

    expect(usernameInput).toHaveValue('test-user');
    expect(passwordInput).toHaveValue('password123');
  });

  it('clears error when user starts typing', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      login: mockLogin,
      loading: false,
      error: 'Invalid credentials',
      isAuthenticated: false,
      clearError: mockClearError,
    });

    renderLogin();

    const usernameInput = screen.getByLabelText(/Login ID/i);
    await user.type(usernameInput, 't');

    expect(mockClearError).toHaveBeenCalled();
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    renderLogin();

    const passwordInput = screen.getByLabelText(/Password/i) as HTMLInputElement;
    const toggleButton = screen.getByRole('button', { name: '' }); // Icon button

    expect(passwordInput.type).toBe('password');

    await user.click(toggleButton);

    await waitFor(() => {
      expect(passwordInput.type).toBe('text');
    });
  });

  it('disables submit button when fields are empty', () => {
    renderLogin();

    const submitButton = screen.getByRole('button', { name: /Sign in/i });
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when both fields are filled', async () => {
    const user = userEvent.setup();
    renderLogin();

    const usernameInput = screen.getByLabelText(/Login ID/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitButton = screen.getByRole('button', { name: /Sign in/i });

    await user.type(usernameInput, 'test-user');
    await user.type(passwordInput, 'password123');

    expect(submitButton).not.toBeDisabled();
  });

  it('calls login function on form submission', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue(undefined);

    renderLogin();

    const usernameInput = screen.getByLabelText(/Login ID/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitButton = screen.getByRole('button', { name: /Sign in/i });

    await user.type(usernameInput, 'test-user');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        username: 'test-user',
        password: 'password123',
      });
    });
  });

  it('shows loading state during login', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      login: mockLogin,
      loading: true,
      error: null,
      isAuthenticated: false,
      clearError: mockClearError,
    });

    renderLogin();

    expect(screen.getByText(/Signing in.../i)).toBeInTheDocument();
    const submitButton = screen.getByRole('button', { name: /Signing in.../i });
    expect(submitButton).toBeDisabled();
  });

  it('disables form fields during loading', () => {
    mockUseAuth.mockReturnValue({
      login: mockLogin,
      loading: true,
      error: null,
      isAuthenticated: false,
      clearError: mockClearError,
    });

    renderLogin();

    const usernameInput = screen.getByLabelText(/Login ID/i);
    const passwordInput = screen.getByLabelText(/Password/i);

    expect(usernameInput).toBeDisabled();
    expect(passwordInput).toBeDisabled();
  });

  it('renders remember me checkbox', () => {
    renderLogin();

    const rememberMeCheckbox = screen.getByLabelText(/Remember me/i);
    expect(rememberMeCheckbox).toBeInTheDocument();
    expect(rememberMeCheckbox).not.toBeChecked();
  });

  it('toggles remember me checkbox', async () => {
    const user = userEvent.setup();
    renderLogin();

    const rememberMeCheckbox = screen.getByLabelText(/Remember me/i);
    await user.click(rememberMeCheckbox);

    expect(rememberMeCheckbox).toBeChecked();
  });

  it('renders forgot password link', () => {
    renderLogin();

    const forgotPasswordLink = screen.getByText(/Forgot password/i);
    expect(forgotPasswordLink).toBeInTheDocument();
    expect(forgotPasswordLink.closest('a')).toHaveAttribute('href', '#');
  });

  it('renders development mode test users in development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    renderLogin();

    expect(screen.getByText(/Development Mode - Test Users/i)).toBeInTheDocument();
    expect(screen.getByText(/Test User:/i)).toBeInTheDocument();
    expect(screen.getByText(/Supervisor:/i)).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('fills credentials when test user fill button is clicked', async () => {
    const user = userEvent.setup();
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    renderLogin();

    const fillButtons = screen.getAllByText('Fill');
    await user.click(fillButtons[0]); // Click first fill button (test-user)

    const usernameInput = screen.getByLabelText(/Login ID/i);
    const passwordInput = screen.getByLabelText(/Password/i);

    await waitFor(() => {
      expect(usernameInput).toHaveValue('test-user');
      expect(passwordInput).toHaveValue('abc.123');
    });

    process.env.NODE_ENV = originalEnv;
  });

  it('renders copyright notice', () => {
    renderLogin();

    expect(screen.getByText(/© 2025 Tazama. All rights reserved./i)).toBeInTheDocument();
  });
});

