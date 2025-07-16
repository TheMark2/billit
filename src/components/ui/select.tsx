'use client';

import { useState, useRef, useEffect } from 'react';
import { IconChevronDown, IconCheck } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function Select({ 
  options, 
  value, 
  onChange, 
  placeholder = 'Seleccionar...', 
  className = '',
  disabled = false
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown cuando se hace click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(option => option.value === value);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className={cn('relative', className)} ref={selectRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-left flex items-center justify-between transition-colors',
          {
            'opacity-50 cursor-not-allowed': disabled,
            'hover:border-gray-400': !disabled,
            'border-blue-500 ring-2 ring-blue-500': isOpen
          }
        )}
      >
        <span className="flex items-center gap-2">
          {selectedOption?.icon && selectedOption.icon}
          <span className={cn(
            'text-sm',
            selectedOption ? 'text-gray-900' : 'text-gray-500'
          )}>
            {selectedOption?.label || placeholder}
          </span>
        </span>
        <IconChevronDown 
          className={cn(
            'h-4 w-4 text-gray-500 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={cn(
                'w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none flex items-center justify-between transition-colors',
                {
                  'bg-blue-50 text-blue-600': option.value === value
                }
              )}
            >
              <span className="flex items-center gap-2">
                {option.icon && option.icon}
                <span className="text-sm">{option.label}</span>
              </span>
              {option.value === value && (
                <IconCheck className="h-4 w-4 text-blue-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
} 