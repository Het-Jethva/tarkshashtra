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
          "flex h-10 w-full min-w-0 rounded-xl bg-white border border-zinc-200/80 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/10 focus-visible:border-zinc-900 focus-visible:bg-zinc-50/30 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-md hover:border-zinc-300",
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
          "flex min-h-[100px] w-full min-w-0 rounded-xl bg-white border border-zinc-200/80 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/10 focus-visible:border-zinc-900 focus-visible:bg-zinc-50/30 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-md hover:border-zinc-300 resize-y",
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
          "flex h-10 w-full min-w-0 rounded-xl bg-white border border-zinc-200/80 pl-3 pr-10 py-2 text-sm text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/10 focus-visible:border-zinc-900 focus-visible:bg-zinc-50/30 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-md hover:border-zinc-300 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%20stroke%3D%22currentColor%22%20stroke-width%3D%221.5%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20d%3D%22M6%208l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_0.75rem_center] bg-[length:1.25rem_1.25rem] bg-no-repeat",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Select.displayName = 'Select';

export const Card = React.forwardRef<HTMLDivElement, { className?: string; children: React.ReactNode }>(
  ({ className, children }, ref) => (
    <div ref={ref} className={cn("rounded-2xl border border-zinc-200/50 bg-white/80 backdrop-blur-xl text-zinc-950 shadow-[0_4px_24px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden transition-all hover:shadow-[0_8px_32px_rgba(0,0,0,0.04),0_2px_4px_rgba(0,0,0,0.04)]", className)}>
      {children}
    </div>
  )
);
Card.displayName = 'Card';

export const Badge = ({ children, variant = 'default', className }: { children: React.ReactNode, variant?: 'default' | 'success' | 'warning' | 'error' | 'info', className?: string }) => {
  const variants = {
    default: "bg-zinc-100 text-zinc-700 border-zinc-200/50 shadow-sm",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200/50 shadow-sm",
    warning: "bg-amber-50 text-amber-700 border-amber-200/50 shadow-sm",
    error: "bg-red-50 text-red-700 border-red-200/50 shadow-sm",
    info: "bg-blue-50 text-blue-700 border-blue-200/50 shadow-sm",
  };
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-bold tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", variants[variant], className)}>
      {children}
    </span>
  );
};
