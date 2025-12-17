"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface RadioGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}

const RadioGroupContext = React.createContext<{
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  name: string;
}>({ name: '' });

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, value, onValueChange, disabled, children, ...props }, ref) => {
    const name = React.useId();

    return (
      <RadioGroupContext.Provider value={{ value, onValueChange, disabled, name }}>
        <div
          ref={ref}
          role="radiogroup"
          className={cn("grid gap-2", className)}
          {...props}
        >
          {children}
        </div>
      </RadioGroupContext.Provider>
    )
  }
)
RadioGroup.displayName = "RadioGroup"

interface RadioGroupItemProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'value'> {
  value: string;
}

const RadioGroupItem = React.forwardRef<HTMLButtonElement, RadioGroupItemProps>(
  ({ className, value, disabled: itemDisabled, ...props }, ref) => {
    const context = React.useContext(RadioGroupContext);
    const isChecked = context.value === value;
    const isDisabled = itemDisabled || context.disabled;

    const handleClick = () => {
      if (!isDisabled && context.onValueChange) {
        context.onValueChange(value);
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        role="radio"
        aria-checked={isChecked}
        disabled={isDisabled}
        onClick={handleClick}
        className={cn(
          "aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {isChecked && (
          <span className="flex items-center justify-center">
            <span className="h-2.5 w-2.5 rounded-full bg-current" />
          </span>
        )}
      </button>
    )
  }
)
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }
