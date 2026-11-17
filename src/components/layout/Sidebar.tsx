import React, { useState } from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  Film,
  Users,
  Image as ImageIcon,
  Video,
  Mic,
  Wand2,
  Cpu,
  History,
  Settings,
  ChevronDown,
  ChevronRight,
  HardDrive,
  Clapperboard,
  Sparkles,
  Megaphone,
  Palette,
  Tv,
  FileSpreadsheet,
  Layers,
  HelpCircle,
  FlaskConical,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export type NavigationTab =
  | 'dashboard'
  | 'projects'
  | 'storyboard'
  | 'characters'
  | 'image-gen'
  | 'video-gen'
  | 'voice-over'
  | 'creative-tools'
  | 'providers'
  | 'model-lab'
  | 'history'
  | 'settings';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab, categoryParam?: string) => void;
  activeProjectTitle?: string;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  storageUsageFormatted?: string;
  storagePercent?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  activeProjectTitle,
  isOpenMobile,
  onCloseMobile,
  storageUsageFormatted,
  storagePercent = 0,
}) => {
  const [storyboardExpanded, setStoryboardExpanded] = useState(true);
  const [imageGenExpanded, setImageGenExpanded] = useState(false);

  const handleNavClick = (tab: NavigationTab, param?: string) => {
    onSelectTab(tab, param);
    onCloseMobile();
  };

  const storyboardCategories = [
    { id: 'video-ad', label: 'Video Iklan', icon: Megaphone },
    { id: 'creative-content', label: 'Konten Kreatif', icon: Sparkles },
    { id: 'animation', label: 'Animasi', icon: Palette },
    { id: 'drama', label: 'Drama & Film', icon: Film },
    { id: 'podcast', label: 'Podcast & Edukasi', icon: Mic },
    { id: 'social-media', label: 'Social Media', icon: Tv },
  ];

  const imageTools = [
    { id: 'photo', label: 'FotoGenerate' },
    { id: 'thumbnail', label: 'Thumbnail' },
    { id: 'infographic', label: 'Infographic' },
    { id: 'ugc', label: 'UGC / Product Ads' },
    { id: 'character-sheet', label: 'Character Sheet' },
    { id: 'poster', label: 'Poster Generator' },
  ];

  const navContent = (
    <div className="flex flex-col h-full bg-[#080910] border-r border-border text-gray-300 select-none">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-[#0C0E1B]">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-accent-purple to-accent-cyan p-0.5 flex items-center justify-center shadow-lg shadow-purple-950/50">
          <div className="w-full h-full bg-[#080910] rounded-[10px] flex items-center justify-center">
            <Clapperboard className="w-5 h-5 text-accent-cyan" />
          </div>
        </div>
        <div className="overflow-hidden">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm tracking-wide text-white">NEO STUDIO</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-accent-purple/30 text-accent-purple border border-accent-purple/50">
              AI
            </span>
          </div>
          <p className="text-[11px] text-gray-400 truncate">AI Storyboard & Video by xyrons</p>
        </div>
      </div>

      {/* Active Project Banner */}
      {activeProjectTitle && (
        <div className="mx-3 mt-3 px-3 py-2 bg-secondary/80 border border-border/80 rounded-lg">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
            Proyek Aktif
          </div>
          <div className="text-xs font-medium text-accent-cyan truncate mt-0.5">
            {activeProjectTitle}
          </div>
        </div>
      )}

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1 text-xs">
        {/* Dashboard */}
        <button
          onClick={() => handleNavClick('dashboard')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium',
            currentTab === 'dashboard'
              ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/40 font-semibold'
              : 'hover:bg-secondary/60 text-gray-300'
          )}
        >
          <LayoutDashboard className="w-4 h-4 shrink-0" />
          <span>Dashboard</span>
        </button>

        {/* My Projects */}
        <button
          onClick={() => handleNavClick('projects')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium',
            currentTab === 'projects'
              ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/40 font-semibold'
              : 'hover:bg-secondary/60 text-gray-300'
          )}
        >
          <FolderKanban className="w-4 h-4 shrink-0" />
          <span>My Projects</span>
        </button>

        {/* Storyboard Studio (Accordion) */}
        <div>
          <button
            onClick={() => {
              setStoryboardExpanded(!storyboardExpanded);
              if (currentTab !== 'storyboard') handleNavClick('storyboard');
            }}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors font-medium',
              currentTab === 'storyboard'
                ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/40 font-semibold'
                : 'hover:bg-secondary/60 text-gray-300'
            )}
          >
            <div className="flex items-center gap-3">
              <Film className="w-4 h-4 shrink-0 text-accent-purple" />
              <span>Storyboard Studio</span>
            </div>
            {storyboardExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            )}
          </button>

          {storyboardExpanded && (
            <div className="ml-5 pl-2 border-l border-border/80 my-1 space-y-0.5">
              {storyboardCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleNavClick('storyboard', cat.id)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-gray-400 hover:text-gray-100 hover:bg-secondary/50 transition-colors text-[11px]"
                >
                  <cat.icon className="w-3 h-3 text-gray-400" />
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Character Studio */}
        <button
          onClick={() => handleNavClick('characters')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium',
            currentTab === 'characters'
              ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/40 font-semibold'
              : 'hover:bg-secondary/60 text-gray-300'
          )}
        >
          <Users className="w-4 h-4 shrink-0 text-cyan-400" />
          <span>Character Studio</span>
        </button>

        {/* Image Generator (Accordion) */}
        <div>
          <button
            onClick={() => {
              setImageGenExpanded(!imageGenExpanded);
              if (currentTab !== 'image-gen') handleNavClick('image-gen');
            }}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors font-medium',
              currentTab === 'image-gen'
                ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/40 font-semibold'
                : 'hover:bg-secondary/60 text-gray-300'
            )}
          >
            <div className="flex items-center gap-3">
              <ImageIcon className="w-4 h-4 shrink-0 text-pink-400" />
              <span>Image Generator</span>
            </div>
            {imageGenExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            )}
          </button>

          {imageGenExpanded && (
            <div className="ml-5 pl-2 border-l border-border/80 my-1 space-y-0.5">
              {imageTools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => handleNavClick('creative-tools', tool.id)}
                  className="w-full text-left px-2.5 py-1.5 rounded-md text-gray-400 hover:text-gray-100 hover:bg-secondary/50 transition-colors text-[11px]"
                >
                  {tool.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Video Generator */}
        <button
          onClick={() => handleNavClick('video-gen')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium',
            currentTab === 'video-gen'
              ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/40 font-semibold'
              : 'hover:bg-secondary/60 text-gray-300'
          )}
        >
          <Video className="w-4 h-4 shrink-0 text-amber-400" />
          <span>Video Generator</span>
        </button>

        {/* Voice Over Studio */}
        <button
          onClick={() => handleNavClick('voice-over')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium',
            currentTab === 'voice-over'
              ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/40 font-semibold'
              : 'hover:bg-secondary/60 text-gray-300'
          )}
        >
          <Mic className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>Voice Over Studio</span>
        </button>

        {/* Creative Tools */}
        <button
          onClick={() => handleNavClick('creative-tools')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium',
            currentTab === 'creative-tools'
              ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/40 font-semibold'
              : 'hover:bg-secondary/60 text-gray-300'
          )}
        >
          <Wand2 className="w-4 h-4 shrink-0 text-purple-400" />
          <span>Creative Tools (10)</span>
        </button>

        <div className="pt-2 pb-1">
          <div className="h-px bg-border/60" />
        </div>

        {/* AI Provider Manager */}
        <button
          onClick={() => handleNavClick('providers')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium',
            currentTab === 'providers'
              ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/40 font-semibold'
              : 'hover:bg-secondary/60 text-gray-300'
          )}
        >
          <Cpu className="w-4 h-4 shrink-0 text-cyan-400" />
          <span>AI Provider Manager</span>
        </button>

        {/* Model Intelligence Lab */}
        <button
          onClick={() => handleNavClick('model-lab')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium',
            currentTab === 'model-lab'
              ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/40 font-semibold'
              : 'hover:bg-secondary/60 text-gray-300'
          )}
        >
          <FlaskConical className="w-4 h-4 shrink-0 text-accent-purple" />
          <div className="flex items-center justify-between flex-1">
            <span>Model Intelligence Lab</span>
            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-accent-purple/30 text-purple-300">
              NEW
            </span>
          </div>
        </button>

        {/* Generation History */}
        <button
          onClick={() => handleNavClick('history')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium',
            currentTab === 'history'
              ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/40 font-semibold'
              : 'hover:bg-secondary/60 text-gray-300'
          )}
        >
          <History className="w-4 h-4 shrink-0 text-gray-400" />
          <span>Generation History</span>
        </button>

        {/* Settings */}
        <button
          onClick={() => handleNavClick('settings')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium',
            currentTab === 'settings'
              ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/40 font-semibold'
              : 'hover:bg-secondary/60 text-gray-300'
          )}
        >
          <Settings className="w-4 h-4 shrink-0 text-gray-400" />
          <span>Settings</span>
        </button>
      </nav>

      {/* Local Storage Indicator */}
      <div className="p-3 border-t border-border bg-[#0C0E1B]">
        <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1.5">
          <span className="flex items-center gap-1.5 font-medium">
            <HardDrive className="w-3.5 h-3.5 text-accent-cyan" />
            Penyimpanan Lokal
          </span>
          <span className="font-mono">{storageUsageFormatted || '0 B'}</span>
        </div>
        <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent-purple to-accent-cyan transition-all"
            style={{ width: `${Math.min(100, Math.max(5, storagePercent))}%` }}
          />
        </div>
        <p className="text-[10px] text-gray-400 mt-1">100% Offline IndexedDB</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-64 h-screen sticky top-0 shrink-0 z-30">
        {navContent}
      </aside>

      {/* Mobile Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
};
