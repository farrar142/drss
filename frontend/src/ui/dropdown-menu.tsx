"use client";

import * as React from "react";
import ReactDOM from "react-dom";
import { cn } from "@/lib/utils";

interface DropdownMenuProps {
  children: React.ReactNode;
}

interface DropdownMenuContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextType | null>(null);

const DropdownMenu: React.FC<DropdownMenuProps> = ({ children }) => {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLElement | null>(null);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, triggerRef }}>
      <div className="relative inline-block text-left">{children}</div>
    </DropdownMenuContext.Provider>
  );
};

interface DropdownMenuTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

const DropdownMenuTrigger: React.FC<DropdownMenuTriggerProps> = ({
  children,
  asChild,
}) => {
  const context = React.useContext(DropdownMenuContext);
  if (!context) throw new Error("DropdownMenuTrigger must be used within DropdownMenu");
  const { setOpen, open, triggerRef } = context;

  const handleClick = () => setOpen(!open);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: () => void; ref?: React.Ref<HTMLElement> }>, {
      onClick: handleClick,
      ref: triggerRef as React.Ref<HTMLElement>,
    });
  }

  return (
    <button type="button" onClick={handleClick} ref={triggerRef as React.Ref<HTMLButtonElement>}>
      {children}
    </button>
  );
};

interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  ({ className, align = "end", sideOffset = 4, children, ...props }, ref) => {
    const context = React.useContext(DropdownMenuContext);
    if (!context) throw new Error("DropdownMenuContent must be used within DropdownMenu");

    const { open, setOpen, triggerRef } = context;
    const contentRef = React.useRef<HTMLDivElement>(null);
    const [styles, setStyles] = React.useState<React.CSSProperties>({
      position: 'fixed',
      top: 0,
      left: 0,
      visibility: 'hidden', // 위치 계산 전까지 숨김
    });

    // 위치 계산 함수
    const updatePosition = React.useCallback(() => {
      const trigger = triggerRef.current;
      const content = contentRef.current;
      if (!trigger || !content) return;

      const triggerRect = trigger.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();

      let top = triggerRect.bottom + sideOffset;
      let left: number;

      if (align === "start") {
        left = triggerRect.left;
      } else if (align === "center") {
        left = triggerRect.left + (triggerRect.width - contentRect.width) / 2;
      } else {
        // end
        left = triggerRect.right - contentRect.width;
      }

      // 화면 밖으로 나가지 않도록 조정
      if (left < 0) left = 0;
      if (left + contentRect.width > window.innerWidth) {
        left = window.innerWidth - contentRect.width;
      }
      if (top + contentRect.height > window.innerHeight) {
        // 위로 표시
        top = triggerRect.top - contentRect.height - sideOffset;
      }

      setStyles({
        position: 'fixed',
        top,
        left,
        visibility: 'visible',
      });
    }, [triggerRef, align, sideOffset]);

    // useLayoutEffect로 paint 전에 위치 계산
    React.useLayoutEffect(() => {
      if (!open) return;
      updatePosition();
    }, [open, updatePosition]);

    // 스크롤 시 위치 업데이트 (useLayoutEffect + passive: false로 즉시 반영)
    React.useLayoutEffect(() => {
      if (!open) return;

      const handleScroll = () => {
        updatePosition();
      };

      // capture phase + passive false로 스크롤 이벤트 즉시 처리
      window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
      return () => window.removeEventListener("scroll", handleScroll, { capture: true });
    }, [open, updatePosition]);

    // 클릭 외부 영역 클릭 시 닫기
    React.useEffect(() => {
      if (!open) return;
      const handleClickOutside = (e: MouseEvent) => {
        if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      };
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }, [open, setOpen]);

    if (!open) return null;

    return ReactDOM.createPortal(
      <div
        ref={(node) => {
          (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        className={cn(
          "z-[99999] min-w-[8rem] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg",
          className
        )}
        style={styles}
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        {children}
      </div>,
      document.body
    );
  }
);
DropdownMenuContent.displayName = "DropdownMenuContent";

interface DropdownMenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  inset?: boolean;
}

const DropdownMenuItem = React.forwardRef<HTMLButtonElement, DropdownMenuItemProps>(
  ({ className, inset, children, onClick, ...props }, ref) => {
    const context = React.useContext(DropdownMenuContext);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      context?.setOpen(false);
    };

    return (
      <button
        ref={ref}
        className={cn(
          "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent/10 focus:bg-accent/10 disabled:pointer-events-none disabled:opacity-50",
          inset && "pl-8",
          className
        )}
        onClick={handleClick}
        {...props}
      >
        {children}
      </button>
    );
  }
);
DropdownMenuItem.displayName = "DropdownMenuItem";

const DropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

const DropdownMenuLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className)}
    {...props}
  />
));
DropdownMenuLabel.displayName = "DropdownMenuLabel";

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
};
