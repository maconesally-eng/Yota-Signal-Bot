import React from 'react';
import { Check } from 'lucide-react';

export const Card: React.FC<{ children: React.ReactNode; className?: string; title?: string }> = ({ children, className = '', title }) => (
  <div className={`bg-navy-700 border border-border rounded-xl p-6 shadow-lg hover:shadow-[0_0_20px_rgba(139,92,246,0.15)] hover:border-accent-primary/50 hover:scale-[1.01] transition-all duration-300 ${className}`}>
    {title && <h3 className="text-lg font-bold text-white mb-4">{title}</h3>}
    {children}
  </div>
);

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' }> = ({ children, className = '', variant = 'primary', ...props }) => {
  const baseStyle = "px-4 py-2 rounded-full font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-gradient-to-r from-accent-primary to-accent-secondary text-white hover:shadow-[0_0_15px_rgba(139,92,246,0.5)] hover:scale-105 active:scale-95",
    secondary: "bg-transparent border border-accent-primary text-accent-primary hover:bg-accent-primary/10",
    outline: "bg-transparent border border-border text-text-primary hover:border-accent-primary hover:text-white",
    danger: "bg-danger text-white hover:bg-red-600",
    ghost: "bg-transparent text-text-secondary hover:text-white hover:bg-navy-800"
  };
  
  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string, icon?: React.ReactNode }> = ({ label, icon, className = '', ...props }) => (
  <div className="w-full">
    {label && <label className="block text-sm text-text-secondary mb-1.5">{label}</label>}
    <div className="relative">
      {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">{icon}</div>}
      <input 
        className={`w-full bg-navy-900 border border-border rounded-lg py-2.5 ${icon ? 'pl-10' : 'pl-3'} pr-3 text-white placeholder-text-muted focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all ${className}`}
        {...props}
      />
    </div>
  </div>
);

export const Checkbox: React.FC<{ label: string, checked: boolean, onChange: (checked: boolean) => void }> = ({ label, checked, onChange }) => (
  <label className="flex items-center gap-2 cursor-pointer group select-none">
    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${checked ? 'bg-accent-primary border-accent-primary' : 'bg-navy-900 border-border group-hover:border-accent-secondary'}`}>
      {checked && <Check size={14} className="text-white" />}
    </div>
    <input type="checkbox" className="hidden" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span className={`text-sm ${checked ? 'text-white' : 'text-text-secondary group-hover:text-text-primary'}`}>{label}</span>
  </label>
);

export const Badge: React.FC<{ type: 'LONG' | 'SHORT' | 'WIN' | 'LOSS' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NEUTRAL' | 'Bullish' | 'Bearish' | string }> = ({ type }) => {
  let styles = "px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider";
  
  switch(type) {
    case 'LONG':
    case 'WIN':
    case 'Bullish':
    case 'HIGH':
      styles += " bg-success/20 text-success";
      break;
    case 'SHORT':
    case 'LOSS':
    case 'Bearish':
    case 'LOW':
      styles += " bg-danger/20 text-danger";
      break;
    case 'MEDIUM':
    case 'warning':
      styles += " bg-warning/20 text-warning";
      break;
    default:
      styles += " bg-accent-primary/20 text-accent-primary";
  }

  return <span className={styles}>{type}</span>;
};
