"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SliderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue'> {
  value?: number[]
  defaultValue?: number[]
  min?: number
  max?: number
  step?: number
  onValueChange?: (value: number[]) => void
  disabled?: boolean
}

const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  ({ className, value, defaultValue = [0], min = 0, max = 100, step = 1, onValueChange, disabled, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue)
    const currentValue = value ?? internalValue
    const trackRef = React.useRef<HTMLDivElement>(null)
    const isDragging = React.useRef(false)

    const percentage = ((currentValue[0] - min) / (max - min)) * 100

    const updateValue = React.useCallback((clientX: number) => {
      if (!trackRef.current || disabled) return
      
      const rect = trackRef.current.getBoundingClientRect()
      const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      const rawValue = min + percent * (max - min)
      const steppedValue = Math.round(rawValue / step) * step
      const clampedValue = Math.max(min, Math.min(max, steppedValue))
      
      const newValue = [clampedValue]
      setInternalValue(newValue)
      onValueChange?.(newValue)
    }, [min, max, step, onValueChange, disabled])

    const handlePointerDown = React.useCallback((e: React.PointerEvent) => {
      if (disabled) return
      isDragging.current = true
      e.currentTarget.setPointerCapture(e.pointerId)
      updateValue(e.clientX)
    }, [updateValue, disabled])

    const handlePointerMove = React.useCallback((e: React.PointerEvent) => {
      if (!isDragging.current || disabled) return
      updateValue(e.clientX)
    }, [updateValue, disabled])

    const handlePointerUp = React.useCallback((e: React.PointerEvent) => {
      isDragging.current = false
      e.currentTarget.releasePointerCapture(e.pointerId)
    }, [])

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex w-full touch-none select-none items-center",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        {...props}
      >
        <div
          ref={trackRef}
          className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary cursor-pointer"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div
            className="absolute h-full bg-primary transition-all"
            style={{ width: `${percentage}%` }}
          />
          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-5 w-5 rounded-full border-2 border-primary bg-background",
              "ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "shadow-md hover:scale-110 active:scale-95",
              disabled && "pointer-events-none"
            )}
            style={{ left: `${percentage}%` }}
          />
        </div>
      </div>
    )
  }
)
Slider.displayName = "Slider"

export { Slider }
