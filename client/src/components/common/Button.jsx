/**
 * Button Component
 * 
 * Reusable button with loading state and variants.
 */

import { Loader2 } from 'lucide-react';

const Button = ({
  children,
  type = 'button',
  variant = 'primary',
  loading = false,
  disabled = false,
  className = '',
  icon: Icon,
  ...props
}) => {
  const baseClasses = 'btn flex items-center justify-center gap-2';
  
  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-400',
    ghost: 'bg-transparent hover:bg-gray-100 text-gray-700',
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin" size={20} />
          Loading...
        </>
      ) : (
        <>
          {Icon && <Icon size={20} />}
          {children}
        </>
      )}
    </button>
  );
};

export default Button;

/**
 * USAGE EXAMPLES:
 * 
 * ```jsx
 * // Primary button with loading
 * <Button 
 *   loading={isSubmitting}
 *   onClick={handleSubmit}
 * >
 *   Submit
 * </Button>
 * 
 * // Secondary button with icon
 * <Button 
 *   variant="secondary"
 *   icon={LogOut}
 *   onClick={handleLogout}
 * >
 *   Logout
 * </Button>
 * 
 * // Danger button
 * <Button 
 *   variant="danger"
 *   onClick={handleDelete}
 * >
 *   Delete Account
 * </Button>
 * ```
 */
