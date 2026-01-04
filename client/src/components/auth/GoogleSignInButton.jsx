/**
 * Google Sign-In Button Component
 * 
 * Uses @react-oauth/google for Google Sign-In.
 * 
 * SETUP REQUIRED:
 * npm install @react-oauth/google
 */

import { GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authAPI, getErrorMessage } from '../../services/api';
import toast from 'react-hot-toast';

const GoogleSignInButton = () => {
  const navigate = useNavigate();
  const { updateUser } = useAuth();

  const handleSuccess = async (credentialResponse) => {
    try {
      // Send the idToken to backend
      const { data } = await authAPI.googleLogin(credentialResponse.credential);

      // Save tokens
      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.data.user));

      // Update auth context
      updateUser(data.data.user);

      toast.success('Login successful!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleError = () => {
    toast.error('Google Sign-In failed. Please try again.');
  };

  return (
    <GoogleLogin
      onSuccess={handleSuccess}
      onError={handleError}
      useOneTap
      theme="outline"
      size="large"
      text="continue_with"
      shape="rectangular"
    />
  );
};

export default GoogleSignInButton;
