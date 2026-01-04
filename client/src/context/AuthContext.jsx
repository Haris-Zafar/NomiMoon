/**
 * Auth Context
 * 
 * Provides global authentication state and functions.
 * 
 * FEATURES:
 * - User state management
 * - Login/logout functions
 * - Persistent authentication (localStorage)
 * - Loading states
 * - Auto-fetch user on mount
 * 
 * CONTEXT API PATTERN:
 * 1. Create context
 * 2. Create provider component
 * 3. Create custom hook for easy access
 * 4. Wrap app with provider
 */

import { createContext, useState, useEffect, useContext } from 'react';
import { authAPI, getErrorMessage } from '../services/api';
import toast from 'react-hot-toast';

/**
 * Create Auth Context
 */
const AuthContext = createContext(null);

/**
 * Auth Provider Component
 * 
 * Wraps the app and provides auth state to all children
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  /**
   * Initialize auth state from localStorage
   * Runs once on mount
   */
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken');
      const storedUser = localStorage.getItem('user');

      if (token && storedUser) {
        try {
          // Verify token is still valid by fetching user
          const { data } = await authAPI.getMe();
          setUser(data.data.user);
          setIsAuthenticated(true);
          
          // Update stored user
          localStorage.setItem('user', JSON.stringify(data.data.user));
        } catch (error) {
          // Token invalid, clear storage
          console.error('Auth initialization failed:', error);
          clearAuth();
        }
      }

      setLoading(false);
    };

    initAuth();
  }, []);

  /**
   * Clear authentication data
   */
  const clearAuth = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  };

  /**
   * Login function
   */
  const login = async (credentials) => {
    try {
      const { data } = await authAPI.login(credentials);
      
      const { accessToken, refreshToken, user: userData } = data.data;

      // Store tokens
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(userData));

      // Update state
      setUser(userData);
      setIsAuthenticated(true);

      toast.success('Login successful!');
      
      return { success: true };
    } catch (error) {
      const message = getErrorMessage(error);
      toast.error(message);
      return { success: false, error: message };
    }
  };

  /**
   * Signup function
   */
  const signup = async (userData) => {
    try {
      const { data } = await authAPI.signup(userData);
      
      toast.success(data.message || 'Signup successful! Please check your email.');
      
      return { success: true, data: data.data };
    } catch (error) {
      const message = getErrorMessage(error);
      toast.error(message);
      return { success: false, error: message };
    }
  };

  /**
   * Logout function
   */
  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearAuth();
      toast.success('Logged out successfully');
    }
  };

  /**
   * Update user data
   */
  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  /**
   * Refresh user data from server
   */
  const refreshUser = async () => {
    try {
      const { data } = await authAPI.getMe();
      setUser(data.data.user);
      localStorage.setItem('user', JSON.stringify(data.data.user));
      return { success: true };
    } catch (error) {
      const message = getErrorMessage(error);
      return { success: false, error: message };
    }
  };

  /**
   * Context value
   */
  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    signup,
    logout,
    updateUser,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Custom hook to use auth context
 * 
 * Usage:
 * ```jsx
 * const { user, login, logout, isAuthenticated } = useAuth();
 * ```
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  
  return context;
};

export default AuthContext;

/**
 * USAGE IN APP:
 * 
 * 1. Wrap app with provider:
 * ```jsx
 * // main.jsx
 * import { AuthProvider } from './context/AuthContext';
 * 
 * ReactDOM.createRoot(document.getElementById('root')).render(
 *   <AuthProvider>
 *     <App />
 *   </AuthProvider>
 * );
 * ```
 * 
 * 2. Use in components:
 * ```jsx
 * import { useAuth } from './context/AuthContext';
 * 
 * function MyComponent() {
 *   const { user, isAuthenticated, logout } = useAuth();
 *   
 *   if (!isAuthenticated) {
 *     return <Navigate to="/login" />;
 *   }
 *   
 *   return (
 *     <div>
 *       <h1>Welcome, {user.firstName}!</h1>
 *       <button onClick={logout}>Logout</button>
 *     </div>
 *   );
 * }
 * ```
 */
