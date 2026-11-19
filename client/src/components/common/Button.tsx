import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost'; icon?: ReactNode };
export default function Button({ variant = 'secondary', icon, className = '', children, ...props }: Props) {
  return <button className={`button ${variant} ${className}`.trim()} {...props}>{icon}{children}</button>;
}
