"use client";

import * as React from "react";
import ReactDOM from "react-dom";
import { cn } from "@/lib/utils";

interface DropdownMenuProps {
  children: React.ReactNode;
}

interface Position {
  top: number;
  left: number;
  right: number;
}

interface DropdownMenuContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
  position: Position | null;
  setPosition: (pos: Position | null) => void;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextType | null>(null);

const DropdownMenu: React.FC<DropdownMenuProps> = ({ children }) => {
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState<Position | null>(null);
  const triggerRef = React.useRef<HTMLElement | null>(null);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, triggerRef, position, setPosition }}>
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
  const { setOpen, open, triggerRef, setPosition } = context;

  const handleClick = (e?: React.MouseEvent) => {
    if (!open && triggerRef.current) {
      // 열릴 때 위치 저장
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom,
        left: rect.left,
        right: rect.right,
      });
    }
    setOpen(!open);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: () => void; ref?: any }>, {
      onClick: handleClick,
      ref: (el: HTMLElement) => {
        triggerRef.current = el;
        const origRef: any = (children as any).ref;
        if (typeof origRef === "function") origRef(el);
        else if (origRef && typeof origRef === "object") (origRef as any).current = el;
      },
    });
  }

  return (
    <button type="button" onClick={handleClick} ref={(el) => { triggerRef.current = el }}>
      {children}
    </button>
  );
};

interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end";
  sideOffset?: number;
  /** 스크롤 시 드롭다운을 닫을지 여부 (기본값: true) */
  closeOnScroll?: boolean;
}

const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  ({ className, align = "end", sideOffset = 4, closeOnScroll = true, children, ...props }, ref) => {
    const context = React.useContext(DropdownMenuContext);
    if (!context) throw new Error("DropdownMenuContent must be used within DropdownMenu");

    const { open, setOpen, position } = context;

    // 클릭 외부 영역 클릭 시 닫기
    React.useEffect(() => {
      const handleClickOutside = () => setOpen(false);
      if (open) {
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
      }
    }, [open, setOpen]);

    // 스크롤 시 드롭다운 닫기
    React.useEffect(() => {
      if (!open || !closeOnScroll) return;

      const handleScroll = () => {
        setOpen(false);
      };

      // 모든 스크롤 이벤트 캡처 (capture phase로 모든 스크롤 감지)
      window.addEventListener("scroll", handleScroll, true);
      return () => window.removeEventListener("scroll", handleScroll, true);
    }, [open, closeOnScroll, setOpen]);

    // 열려있지 않거나 위치가 없으면 렌더링 안함
    if (!open || !position) return null;

    // 저장된 위치 사용 (클릭 시점의 위치)
    const left = align === "start" ? position.left : align === "center" ? (position.left + position.right) / 2 : position.right;

    // body에 portal하여 어떤 부모의 overflow나 z-index에도 영향받지 않음
    return ReactDOM.createPortal(
      <div
        ref={ref}
        className={cn(
          "fixed z-[99999] min-w-[8rem] overflow-visible rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg",
          className
        )}
        style={{
          top: position.top + sideOffset,
          left: left,
          transform: align === "end" ? "translateX(-100%)" : align === "center" ? "translateX(-50%)" : undefined,
        }}
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
