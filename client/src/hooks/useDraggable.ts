import { useState, useRef, useCallback } from 'react';

interface Position {
  x: number;
  y: number;
}

interface DraggableOptions {
  initialPosition?: Position;
  elementWidth?: number;
  elementHeight?: number;
}

export function useDraggable(options: DraggableOptions = {}) {
  const {
    initialPosition = { x: 20, y: 80 },
    elementWidth = 220,
    elementHeight = 155,
  } = options;

  const [position, setPosition] = useState<Position>(initialPosition);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ startX: number; startY: number; origX: number; origY: number }>({
    startX: 0,
    startY: 0,
    origX: initialPosition.x,
    origY: initialPosition.y,
  });

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Prevent dragging if clicking button inside the card
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }

    isDraggingRef.current = true;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: position.x,
      origY: position.y,
    };
  }, [position]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;

    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;

    const nextX = dragStartRef.current.origX + deltaX;
    const nextY = dragStartRef.current.origY + deltaY;

    // Viewport boundaries clamping
    const maxX = Math.max(0, window.innerWidth - elementWidth - 10);
    const maxY = Math.max(0, window.innerHeight - elementHeight - 70);

    const clampedX = Math.min(Math.max(10, nextX), maxX);
    const clampedY = Math.min(Math.max(60, nextY), maxY);

    setPosition({ x: clampedX, y: clampedY });
  }, [elementWidth, elementHeight]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      const target = e.currentTarget as HTMLElement;
      target.releasePointerCapture(e.pointerId);
    } catch {
      // Ignored if already released
    }
  }, []);

  return {
    position,
    setPosition,
    dragHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}
