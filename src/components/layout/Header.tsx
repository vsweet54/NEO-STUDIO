import React, { useState } from 'react';
import {
  Menu,
  Sparkles,
  Download,
  Upload,
  Play,
  Activity,
  User,
  Sliders,
  CheckCircle2,
  HardDrive,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { RouterMode } from '@/types/provider';

interface HeaderProps {
  onOpenMobileMenu: () => void;
  routerMode: RouterMode;
  onToggleRouterMode: (mode: RouterMode) => void;
  activeJobCount: number;
  onOpenQueue: () => void;
  onExportProject?: () => void;
  onImportProject?: () => void;
  currentProjectTitle?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileMenu,
  routerMode,
  onToggleRouterMode,
  activeJobCount,
  onOpenQueue,
  onExportProject,
  onImportProject,
  currentProjectTitle,
}) => {
  return (
    <header className="h-16 border-b border-border bg-[#0C0E1B]/95 backdrop-blur-md sticky top-0 z-20 px-4 sm:px-6 flex items-center justify-between">
      {/* Left: Mobile Toggle & Project Context */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-secondary focus:outline-none"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <Badge variant="purple" size="sm" className="hidden sm:inline-flex font-mono">
            v1.0.0
          </Badge>
          <Badge variant="cyan" size="sm" className="hidden sm:inline-flex font-mono">
            by xyrons
          </Badge>
          {currentProjectTitle && (
            <span className="text-sm font-semibold text-gray-200 truncate max-w-[200px] sm:max-w-xs">
              {currentProjectTitle}
            </span>
          )}
        </div>
      </div>

      {/* Right: Router Switch, Queue Button & Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Router Mode Pill */}
        <div className="flex items-center bg-[#131527] border border-border rounded-lg p-0.5 text-xs font-medium">
          <button
            onClick={() => onToggleRouterMode('auto')}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
              routerMode === 'auto'
                ? 'bg-accent-purple text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span className="hidden sm:inline">Auto Route</span>
            <span className="sm:hidden">Auto</span>
          </button>
          <button
            onClick={() => onToggleRouterMode('manual')}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
              routerMode === 'manual'
                ? 'bg-accent-cyan text-black font-semibold shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Sliders className="w-3 h-3" />
            <span className="hidden sm:inline">Manual</span>
          </button>
        </div>

        {/* Active Jobs Queue Indicator */}
        <Button
          variant={activeJobCount > 0 ? 'cyan' : 'secondary'}
          size="sm"
          onClick={onOpenQueue}
          className="relative text-xs"
        >
          <Activity className={`w-3.5 h-3.5 ${activeJobCount > 0 ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Queue</span>
          {activeJobCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 bg-black text-cyan-400 rounded-full text-[10px] font-bold">
              {activeJobCount}
            </span>
          )}
        </Button>

        {/* Project Quick Export / Import */}
        {onExportProject && (
          <Button
            variant="outline"
            size="sm"
            onClick={onExportProject}
            title="Export Project ZIP"
            className="hidden md:inline-flex text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export ZIP</span>
          </Button>
        )}

        {/* Studio Director Profile Pill (like in screenshot) */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-secondary/80 border border-border text-xs text-gray-200">
          <div className="w-5 h-5 rounded-full bg-accent-purple/30 border border-accent-purple/50 flex items-center justify-center">
            <User className="w-3 h-3 text-accent-purple" />
          </div>
          <span className="hidden sm:inline text-xs font-medium">Director Studio</span>
        </div>
      </div>
    </header>
  );
};
