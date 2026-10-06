import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

type ModalPortalProps = {
  children: ReactNode;
  onClose?: () => void;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  blocked?: boolean;
  className?: string;
};

type BodySnapshot = {
  scrollX: number;
  scrollY: number;
  overflow: string;
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  paddingRight: string;
};

let openModalCount = 0;
let bodySnapshot: BodySnapshot | null = null;

function lockPageScroll() {
  openModalCount += 1;
  if (openModalCount > 1) return;

  const body = document.body;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  bodySnapshot = {
    scrollX,
    scrollY,
    overflow: body.style.overflow,
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    paddingRight: body.style.paddingRight,
  };

  body.style.overflow = "hidden";
  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.left = `-${scrollX}px`;
  body.style.right = "0";
  body.style.width = "100%";
  if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
}

function unlockPageScroll() {
  openModalCount = Math.max(0, openModalCount - 1);
  if (openModalCount > 0 || !bodySnapshot) return;

  const body = document.body;
  const snapshot = bodySnapshot;
  bodySnapshot = null;
  body.style.overflow = snapshot.overflow;
  body.style.position = snapshot.position;
  body.style.top = snapshot.top;
  body.style.left = snapshot.left;
  body.style.right = snapshot.right;
  body.style.width = snapshot.width;
  body.style.paddingRight = snapshot.paddingRight;
  window.scrollTo(snapshot.scrollX, snapshot.scrollY);
}

export function ModalPortal({
  children,
  onClose,
  closeOnBackdrop = true,
  closeOnEscape = true,
  blocked = false,
  className = "",
}: ModalPortalProps) {
  const closeRef = useRef(onClose);
  const blockedRef = useRef(blocked);
  closeRef.current = onClose;
  blockedRef.current = blocked;

  useEffect(() => {
    lockPageScroll();
    return unlockPageScroll;
  }, []);

  useEffect(() => {
    if (!closeOnEscape) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !blockedRef.current) closeRef.current?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeOnEscape]);

  return createPortal(
    <div
      className={`modal-backdrop participant-modal-backdrop ${className}`.trim()}
      role="presentation"
      onMouseDown={(event) => {
        if (
          closeOnBackdrop &&
          event.target === event.currentTarget &&
          !blockedRef.current
        ) {
          closeRef.current?.();
        }
      }}
    >
      {children}
    </div>,
    document.body
  );
}
