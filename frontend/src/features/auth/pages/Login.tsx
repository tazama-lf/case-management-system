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

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (error) clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await login(credentials);

      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full mx-4">
        { }
        <div className="text-center mb-8">
          <div className="mx-auto h-12 w-12 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
            <LockClosedIcon className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Tazama Case Management System
          </h2>
          <p className="text-sm text-gray-600">Investigation Platform</p>
        </div>

        { }
        <div className="card">
          <div className="card-body">
            <p className="text-base font-normal text-gray-900 mb-6 text-center">
              Sign in to your account
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-600 text-sm">{error || 'An error occurred during login'}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              { }
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

              { }
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

            { }
          </div>
        </div>

        { }
        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} Tazama. Powered by Paysys Labs.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
