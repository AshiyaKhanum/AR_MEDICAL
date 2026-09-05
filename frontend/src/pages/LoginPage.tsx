import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Eye, EyeOff, ShieldPlus } from 'lucide-react';
import { BUSINESS } from '../config/business';
import { useLogin } from '../hooks/useAuth';
import { useAuthStore } from '../store/authStore';
import { apiErrorMessage } from '../api/client';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type FormValues = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@armedical.in', password: 'Admin@123' },
  { label: 'Pharmacist', email: 'pharmacist@armedical.in', password: 'Pharma@123' },
  { label: 'Staff', email: 'staff@armedical.in', password: 'Staff@123' },
];

export default function LoginPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const location = useLocation() as { state?: { from?: Location } };
  const navigate = useNavigate();
  const login = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (accessToken) {
    return <Navigate to={location.state?.from?.pathname ?? '/'} replace />;
  }

  const onSubmit = (values: FormValues) => {
    login.mutate(values, {
      onSuccess: () => {
        toast.success('Welcome back!');
        navigate('/');
      },
      onError: (err) => toast.error(apiErrorMessage(err, 'Invalid email or password')),
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 p-4">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl md:grid md:grid-cols-2">
        <div className="hidden flex-col justify-between bg-brand-900 p-10 text-white md:flex">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-xl font-extrabold text-brand-800">AR</div>
              <div>
                <p className="text-xl font-bold">{BUSINESS.name}</p>
                <p className="text-xs text-brand-200">{BUSINESS.address}</p>
              </div>
            </div>
            <h2 className="mt-10 text-2xl font-bold leading-snug">
              Medical Billing &amp; Inventory<br /> Management System
            </h2>
            <p className="mt-3 text-sm text-brand-200">
              Manage medicines, batches, purchases, billing, GST invoices and reports — all in one place for
              {' '}{BUSINESS.name}.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-brand-200">
            <ShieldPlus className="h-5 w-5" />
            Role-based access for Admin, Pharmacist &amp; Staff
          </div>
        </div>

        <div className="p-8 sm:p-10">
          <div className="mb-6 md:hidden">
            <p className="text-lg font-bold text-brand-800">{BUSINESS.name}</p>
            <p className="text-xs text-slate-500">{BUSINESS.address}</p>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
          <p className="mt-1 text-sm text-slate-500">Enter your credentials to access the dashboard.</p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="label">Email address</label>
              <input type="email" className="input" placeholder="you@armedical.in" {...register('email')} />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="••••••••"
                  {...register('password')}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  onClick={() => setShowPassword((s) => !s)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
            </div>

            <button type="submit" className="btn-primary w-full" disabled={login.isPending}>
              {login.isPending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 rounded-lg border border-dashed border-slate-300 p-3">
            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Demo credentials</p>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  className="rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:border-brand-400 hover:text-brand-700"
                  onClick={() => {
                    setValue('email', acc.email);
                    setValue('password', acc.password);
                  }}
                >
                  {acc.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
