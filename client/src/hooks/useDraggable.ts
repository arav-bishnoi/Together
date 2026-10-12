import { useState, useRef, useCallback, useEffect } from 'react';

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

  // Viewport boundaries clamping helper
  const clampPosition = useCallback((x: number, y: number, width: number, height: number): Position => {
    const maxX = Math.max(10, window.innerWidth - width - 10);
    const maxY = Math.max(60, window.innerHeight - height - 80);
    return {
      x: Math.min(Math.max(10, x), maxX),
      y: Math.min(Math.max(60, y), maxY),
    };
  }, []);

  const [position, setPosition] = useState<Position>(() =>
    clampPosition(initialPosition.x, initialPosition.y, elementWidth, elementHeight)
  );

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ startX: number; startY: number; origX: number; origY: number }>({
    startX: 0,
    startY: 0,
    origX: initialPosition.x,
    origY: initialPosition.y,
  });

  // Keep element within viewport on window resize or Android orientation change
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => clampPosition(prev.x, prev.y, elementWidth, elementHeight));
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [elementWidth, elementHeight, clampPosition]);

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

    setPosition(clampPosition(nextX, nextY, elementWidth, elementHeight));
  }, [elementWidth, elementHeight, clampPosition]);

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
