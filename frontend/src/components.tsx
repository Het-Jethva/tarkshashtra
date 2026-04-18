import React, { type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

import { cn } from './lib/utils';

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }>(
  ({ className, type = 'button', variant = 'primary', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-[background-color,border-color,color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 select-none shadow-sm active:scale-[0.98]",
          variant === 'primary' && "bg-zinc-900 text-white hover:bg-zinc-800 shadow-[0_1px_2px_rgba(0,0,0,0.1)]",
          variant === 'secondary' && "bg-white text-zinc-900 hover:bg-zinc-50 border border-zinc-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.05)]",
          variant === 'danger' && "bg-red-600 text-white hover:bg-red-700 shadow-[0_1px_2px_rgba(0,0,0,0.1)]",
          variant === 'ghost' && "bg-transparent text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 shadow-none",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export const Input = React.forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full min-w-0 rounded-lg bg-white border border-zinc-200/80 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/10 focus-visible:border-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 transition-[border-color,box-shadow] shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[100px] w-full min-w-0 rounded-lg bg-white border border-zinc-200/80 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/10 focus-visible:border-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 transition-[border-color,box-shadow] shadow-[0_1px_2px_rgba(0,0,0,0.02)] resize-y",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => {
    return (
      <select
        className={cn(
          "flex h-10 w-full min-w-0 rounded-lg bg-white border border-zinc-200/80 px-3 py-2 text-sm text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/10 focus-visible:border-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 transition-[border-color,box-shadow] shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Select.displayName = 'Select';

export const Card = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn("rounded-xl border border-zinc-200/60 bg-white text-zinc-950 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden", className)}>
    {children}
  </div>
);

export const Badge = ({ children, variant = 'default', className }: { children: React.ReactNode, variant?: 'default' | 'success' | 'warning' | 'error' | 'info', className?: string }) => {
  const variants = {
    default: "bg-zinc-100 text-zinc-700 border-zinc-200/50",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200/50",
    warning: "bg-amber-50 text-amber-700 border-amber-200/50",
    error: "bg-red-50 text-red-700 border-red-200/50",
    info: "bg-blue-50 text-blue-700 border-blue-200/50",
  };
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", variants[variant], className)}>
      {children}
    </span>
  );
};
