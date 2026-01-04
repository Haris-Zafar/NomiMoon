/**
 * Input Component
 * 
 * Reusable input field with label, error handling, and validation.
 * Integrates with react-hook-form.
 */

import { forwardRef } from 'react';

const Input = forwardRef(
  (
    {
      label,
      type = 'text',
      error,
      placeholder,
      icon: Icon,
      className = '',
      ...props
    },
    ref
  ) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {label}
          </label>
        )}
        
        <div className="relative">
          {Icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Icon size={20} />
            </div>
          )}
          
          <input
            ref={ref}
            type={type}
            placeholder={placeholder}
            className={`
              input
              ${Icon ? 'pl-10' : ''}
              ${error ? 'input-error' : ''}
              ${className}
            `}
            {...props}
          />
        </div>
        
        {error && (
          <p className="mt-1 text-sm text-red-600">
            {error.message}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;

/**
 * USAGE EXAMPLE:
 * 
 * ```jsx
 * import { useForm } from 'react-hook-form';
 * import { Mail } from 'lucide-react';
 * import Input from './components/common/Input';
 * 
 * function MyForm() {
 *   const { register, formState: { errors } } = useForm();
 *   
 *   return (
 *     <form>
 *       <Input
 *         label="Email"
 *         type="email"
 *         placeholder="Enter your email"
 *         icon={Mail}
 *         error={errors.email}
 *         {...register('email', { required: 'Email is required' })}
 *       />
 *     </form>
 *   );
 * }
 * ```
 */
