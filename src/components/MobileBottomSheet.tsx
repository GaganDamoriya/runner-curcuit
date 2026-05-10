'use client';

import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileBottomSheetProps {
  collapsedContent: React.ReactNode;
  expandedContent: React.ReactNode;
}

export function MobileBottomSheet({ collapsedContent, expandedContent }: MobileBottomSheetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [startY, setStartY] = useState<number | null>(null);
  const [currentY, setCurrentY] = useState(0);

  // Handle touch drag
  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY === null) return;
    const diff = e.touches[0].clientY - startY;

    // Only allow dragging down when expanded, or up when collapsed
    if ((isExpanded && diff > 0) || (!isExpanded && diff < 0)) {
      setCurrentY(diff);
    }
  };

  const handleTouchEnd = () => {
    if (Math.abs(currentY) > 50) {
      // Threshold for toggling
      setIsExpanded(currentY < 0);
    }
    setStartY(null);
    setCurrentY(0);
  };

  return (
    <>
      {/* Desktop Sidebar - Hidden on mobile */}
      <div className="hidden sm:block">
        {expandedContent}
      </div>

      {/* Mobile Bottom Sheet */}
      <div
        className={cn(
          "sm:hidden fixed left-0 right-0 bottom-0 z-40",
          "bg-card border-t-2 border-border shadow-2xl",
          "transition-all duration-300 ease-out",
          isExpanded ? "top-20" : "top-auto"
        )}
        style={{
          transform: `translateY(${currentY}px)`
        }}
      >
        {/* Drag Handle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="w-full flex flex-col items-center py-2 active:bg-muted/50 touch-none"
        >
          <div className="w-12 h-1.5 bg-border rounded-full mb-2" />
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          )}
        </button>

        {/* Content */}
        <div className={cn(
          "overflow-y-auto",
          isExpanded ? "max-h-[calc(100vh-6rem)]" : "max-h-32"
        )}>
          {isExpanded ? expandedContent : collapsedContent}
        </div>
      </div>
    </>
  );
}
