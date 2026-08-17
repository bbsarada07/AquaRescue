'use client';

import React, { useMemo, useRef, useState } from 'react';
import { GripVertical, Minus, Plus, X } from 'lucide-react';
import { DockTarget, PanelLayout } from '@/lib/panelWorkspace';

interface WorkspacePanelProps {
  title: string;
  icon: React.ReactNode;
  layout: PanelLayout;
  workspaceWidth: number;
  workspaceHeight: number;
  onLayoutChange: (patch: Partial<PanelLayout>) => void;
  onBringToFront: () => void;
  onSnapPreview: (target: DockTarget | null) => void;
  onSnapCommit: (target: DockTarget) => void;
  children: React.ReactNode;
}

const HEADER_HEIGHT = 38;
const MIN_WIDTH = 220;
const MIN_HEIGHT = 130;
const MAX_WIDTH_RATIO = 0.98;
const MAX_HEIGHT_RATIO = 0.94;

export const WorkspacePanel: React.FC<WorkspacePanelProps> = ({
  title,
  icon,
  layout,
  workspaceWidth,
  workspaceHeight,
  onLayoutChange,
  onBringToFront,
  onSnapPreview,
  onSnapCommit,
  children,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; sx: number; sy: number } | null>(null);
  const resizeStartRef = useRef<{ x: number; y: number; sw: number; sh: number } | null>(null);
  const snapCandidateRef = useRef<DockTarget | null>(null);

  const pxRect = useMemo(() => {
    return {
      left: layout.x * workspaceWidth,
      top: layout.y * workspaceHeight,
      width: layout.w * workspaceWidth,
      height: layout.collapsed ? HEADER_HEIGHT : layout.h * workspaceHeight,
    };
  }, [layout, workspaceWidth, workspaceHeight]);

  if (!layout.visible) return null;

  const detectSnapTarget = (left: number, top: number, width: number, height: number): DockTarget | null => {
    const threshold = 26;
    const dLeft = left;
    const dTop = top;
    const dRight = workspaceWidth - (left + width);
    const dBottom = workspaceHeight - (top + height);
    const distances: Array<{ target: DockTarget; distance: number }> = [
      { target: 'left', distance: dLeft },
      { target: 'right', distance: dRight },
      { target: 'top', distance: dTop },
      { target: 'bottom', distance: dBottom },
    ];
    const nearest = distances.sort((a, b) => a.distance - b.distance)[0];
    return nearest.distance <= threshold ? nearest.target : null;
  };

  const clampLayout = (nextX: number, nextY: number, nextW: number, nextH: number): Pick<PanelLayout, 'x' | 'y' | 'w' | 'h'> => {
    const minW = MIN_WIDTH / workspaceWidth;
    const minH = MIN_HEIGHT / workspaceHeight;
    const maxW = MAX_WIDTH_RATIO;
    const maxH = MAX_HEIGHT_RATIO;
    const w = Math.max(minW, Math.min(maxW, nextW));
    const h = Math.max(minH, Math.min(maxH, nextH));
    const x = Math.max(0, Math.min(1 - w, nextX));
    const y = Math.max(0, Math.min(1 - h, nextY));
    return { x, y, w, h };
  };

  const endPointerOps = () => {
    if (isDragging) {
      const snap = snapCandidateRef.current;
      if (snap) {
        onSnapCommit(snap);
      }
    }
    setIsDragging(false);
    setIsResizing(false);
    snapCandidateRef.current = null;
    onSnapPreview(null);
    dragStartRef.current = null;
    resizeStartRef.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  };

  const onPointerMove = (ev: PointerEvent) => {
    if (dragStartRef.current) {
      const dxRatio = (ev.clientX - dragStartRef.current.x) / workspaceWidth;
      const dyRatio = (ev.clientY - dragStartRef.current.y) / workspaceHeight;
      const moved = clampLayout(
        dragStartRef.current.sx + dxRatio,
        dragStartRef.current.sy + dyRatio,
        layout.w,
        layout.h
      );
      onLayoutChange(moved);
      const snap = detectSnapTarget(
        moved.x * workspaceWidth,
        moved.y * workspaceHeight,
        moved.w * workspaceWidth,
        moved.h * workspaceHeight
      );
      snapCandidateRef.current = snap;
      onSnapPreview(snap);
      return;
    }
    if (resizeStartRef.current) {
      const dwRatio = (ev.clientX - resizeStartRef.current.x) / workspaceWidth;
      const dhRatio = (ev.clientY - resizeStartRef.current.y) / workspaceHeight;
      const resized = clampLayout(
        layout.x,
        layout.y,
        resizeStartRef.current.sw + dwRatio,
        resizeStartRef.current.sh + dhRatio
      );
      onLayoutChange({ w: resized.w, h: resized.h });
    }
  };

  const onPointerUp = () => {
    endPointerOps();
  };

  const startPointerOps = () => {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const onHeaderPointerDown = (ev: React.PointerEvent<HTMLDivElement>) => {
    const target = ev.target as HTMLElement;
    if (target.closest('button')) return;
    ev.preventDefault();
    onBringToFront();
    setIsDragging(true);
    dragStartRef.current = {
      x: ev.clientX,
      y: ev.clientY,
      sx: layout.x,
      sy: layout.y,
    };
    startPointerOps();
  };

  const onResizePointerDown = (ev: React.PointerEvent<HTMLButtonElement>) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (layout.collapsed) return;
    onBringToFront();
    setIsResizing(true);
    resizeStartRef.current = {
      x: ev.clientX,
      y: ev.clientY,
      sw: layout.w,
      sh: layout.h,
    };
    startPointerOps();
  };

  return (
    <section
      className={`group absolute bg-[#0b1420]/95 border rounded-lg shadow-2xl overflow-hidden ${
        isDragging || isResizing ? 'border-[#06B6D4]/70' : 'border-[#1f293d]'
      }`}
      style={{
        left: `${pxRect.left}px`,
        top: `${pxRect.top}px`,
        width: `${pxRect.width}px`,
        height: `${pxRect.height}px`,
        zIndex: layout.z,
      }}
    >
      <header
        className="h-[38px] px-2.5 border-b border-[#1f293d] bg-[#111827] flex items-center justify-between cursor-grab active:cursor-grabbing"
        onPointerDown={onHeaderPointerDown}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <GripVertical className="w-3.5 h-3.5 text-gray-500 shrink-0" />
          <span className="text-[#67e8f9] shrink-0">{icon}</span>
          <span className="text-[11px] font-bold text-gray-100 truncate tracking-wide">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onLayoutChange({ collapsed: !layout.collapsed })}
            className="w-6 h-6 rounded border border-[#374151] text-gray-200 hover:border-[#06B6D4]/60 hover:text-white flex items-center justify-center"
            title={layout.collapsed ? 'Expand panel' : 'Collapse panel'}
          >
            {layout.collapsed ? <Plus className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onLayoutChange({ visible: false })}
            className="w-6 h-6 rounded border border-[#374151] text-gray-300 hover:border-[#ef4444]/60 hover:text-[#fecaca] flex items-center justify-center"
            title="Hide panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {!layout.collapsed && (
        <>
          <div className="h-[calc(100%-38px)] overflow-auto p-3">{children}</div>
          <button
            className="absolute bottom-0.5 right-0.5 w-4 h-4 text-gray-500 hover:text-[#67e8f9] opacity-0 group-hover:opacity-100"
            title="Resize panel"
            onPointerDown={onResizePointerDown}
          >
            ◢
          </button>
        </>
      )}
    </section>
  );
};

export default WorkspacePanel;
