/**
 * Dashboard Component
 * 
 * Protected page for authenticated users.
 */

import { useAuth } from '../context/AuthContext';
import { LogOut, User as UserIcon } from 'lucide-react';
import Button from '../components/common/Button';

const Dashboard = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <Button
            variant="ghost"
            icon={LogOut}
            onClick={logout}
          >
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Card */}
        <div className="card mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
              <UserIcon className="text-primary-600" size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Welcome back, {user?.firstName || user?.email}!
              </h2>
              <p className="text-gray-600">
                Good to see you again
              </p>
            </div>
          </div>
        </div>

        {/* User Info Card */}
        <div className="card">
          <h3 className="text-xl font-semibold mb-4">Your Information</h3>
          <div className="space-y-3">
            <div>
              <span className="font-medium text-gray-700">Email:</span>
              <p className="text-gray-900">{user?.email}</p>
            </div>
            {user?.fullName && (
              <div>
                <span className="font-medium text-gray-700">Full Name:</span>
                <p className="text-gray-900">{user.fullName}</p>
              </div>
            )}
            <div>
              <span className="font-medium text-gray-700">Email Verified:</span>
              <p className="text-gray-900">
                {user?.isEmailVerified ? (
                  <span className="text-green-600">✓ Verified</span>
                ) : (
                  <span className="text-yellow-600">⚠ Not verified</span>
                )}
              </p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Member Since:</span>
              <p className="text-gray-900">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
