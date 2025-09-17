import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../components/AuthContext';
import type { LoginCredentials } from '../types/auth.types';

interface LoginProps {
  onLoginSuccess?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const { login, loading, error, isAuthenticated, clearError } = useAuth();

  const [credentials, setCredentials] = useState<LoginCredentials>({
    username: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      console.log('User is authenticated, redirecting to /alerts');
      navigate('/alerts', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (error) clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      console.log('Starting login process...');
      await login(credentials);

      // Call onLoginSuccess callback if provided
      if (onLoginSuccess) {
        console.log('Calling onLoginSuccess callback');
        onLoginSuccess();
      }
      // Don't manually navigate here - let the useEffect handle it
      // The login function will update isAuthenticated, which will trigger the useEffect
      console.log('Login function completed, waiting for auth state update...');
    } catch (error) {
      // Error is handled by the context
      console.error('Login failed:', error);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full mx-4">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="mx-auto h-12 w-12 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
            <LockClosedIcon className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Tazama Case Management System
          </h2>
          <p className="text-sm text-gray-600">Investigation Platform</p>
        </div>

        {/* Login Form */}
        <div className="card">
          <div className="card-body">
            <p className="text-base font-normal text-gray-900 mb-6 text-center">
              Sign in to your account
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username Field */}
              <div>
                <label htmlFor="username" className="form-label">
                  Login ID
                </label>
                <div className="relative">
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    className="form-input pl-10"
                    placeholder="Enter your login ID"
                    value={credentials.username}
                    onChange={handleInputChange}
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="form-label">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    className="form-input pl-10 pr-10"
                    placeholder="Enter your password"
                    value={credentials.password}
                    onChange={handleInputChange}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    disabled={loading}
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-5 w-5" />
                    ) : (
                      <EyeIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember me and Forgot password */}
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={loading}
                  />
                  <label
                    htmlFor="remember-me"
                    className="ml-2 block text-sm text-gray-700"
                  >
                    Remember me
                  </label>
                </div>

                <a
                  href="#"
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  Forgot password?
                </a>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={
                  loading || !credentials.username || !credentials.password
                }
                className="btn btn-primary btn-lg w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            {/* Development Info */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-6 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-yellow-800 text-xs font-medium mb-2">
                  Development Mode - Test Users
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-yellow-700 text-xs">
                      <span className="font-medium">Test User:</span>{' '}
                      <code className="bg-yellow-100 px-1 rounded">test-user</code>{' '}
                      / <code className="bg-yellow-100 px-1 rounded">abc.123</code>
                    </p>
                    <button
                      type="button"
                      onClick={() => setCredentials({ username: 'test-user', password: 'abc.123' })}
                      className="text-xs bg-yellow-200 hover:bg-yellow-300 px-2 py-1 rounded text-yellow-800"
                    >
                      Fill
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-yellow-700 text-xs">
                      <span className="font-medium">Supervisor:</span>{' '}
                      <code className="bg-yellow-100 px-1 rounded">supervisor</code>{' '}
                      / <code className="bg-yellow-100 px-1 rounded">abc.123</code>
                    </p>
                    <button
                      type="button"
                      onClick={() => setCredentials({ username: 'supervisor', password: 'abc.123' })}
                      className="text-xs bg-yellow-200 hover:bg-yellow-300 px-2 py-1 rounded text-yellow-800"
                    >
                      Fill
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-yellow-700 text-xs">
                      <span className="font-medium">Investigator:</span>{' '}
                      <code className="bg-yellow-100 px-1 rounded">investigator</code>{' '}
                      / <code className="bg-yellow-100 px-1 rounded">abc.123</code>
                    </p>
                    <button
                      type="button"
                      onClick={() => setCredentials({ username: 'investigator', password: 'abc.123' })}
                      className="text-xs bg-yellow-200 hover:bg-yellow-300 px-2 py-1 rounded text-yellow-800"
                    >
                      Fill
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm">
            © 2025 Tazama. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
