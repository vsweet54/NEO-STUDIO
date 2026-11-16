'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar, NavigationTab } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { GenerationQueueOverlay } from '@/components/layout/GenerationQueueOverlay';
import { StoryboardWizardModal } from '@/components/storyboard/StoryboardWizardModal';

import { DashboardView } from '@/components/dashboard/DashboardView';
import { ProjectsView } from '@/components/projects/ProjectsView';
import { StoryboardStudio } from '@/components/storyboard/StoryboardStudio';
import { CharacterStudio } from '@/components/characters/CharacterStudio';
import { ImageStudio } from '@/components/image-gen/ImageStudio';
import { VideoStudio } from '@/components/video-gen/VideoStudio';
import { VoiceOverStudio } from '@/components/audio/VoiceOverStudio';
import { CreativeToolsHub } from '@/components/creative-tools/CreativeToolsHub';
import { ProviderManager } from '@/components/providers/ProviderManager';
import { GenerationHistoryView } from '@/components/history/GenerationHistoryView';
import { SettingsView } from '@/components/settings/SettingsView';

import { queueManager } from '@/lib/queue/generation-queue';
import { getStorageQuotaInfo, StorageQuotaInfo } from '@/lib/storage/quota';
import { getAllProjects, getProjectById } from '@/lib/db/projects';
import { getRouterConfig, saveRouterConfig } from '@/lib/db/settings';
import { exportProjectToZip } from '@/lib/storage/export-import';
import { RouterMode } from '@/types/provider';
import { GenerationJob } from '@/types/generation';
import { ProjectCategory } from '@/types/project';

export default function Home() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [activeParam, setActiveParam] = useState<string | undefined>(undefined);

  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [activeProjectTitle, setActiveProjectTitle] = useState<string>('');

  const [routerMode, setRouterMode] = useState<RouterMode>('auto');
  const [storageQuota, setStorageQuota] = useState<StorageQuotaInfo | null>(null);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardCategory, setWizardCategory] = useState<ProjectCategory>('video-ad');
  const [isQueueOpen, setIsQueueOpen] = useState(false);

  const [jobs, setJobs] = useState<GenerationJob[]>([]);

  // Subscribe to generation queue updates
  useEffect(() => {
    const unsubscribe = queueManager.subscribe((updatedJobs) => {
      setJobs(updatedJobs);
    });
    return unsubscribe;
  }, []);

  // Load initial settings, active project, and storage quota
  useEffect(() => {
    async function init() {
      try {
        const [q, rConfig, projects] = await Promise.all([
          getStorageQuotaInfo(),
          getRouterConfig(),
          getAllProjects(),
        ]);

        setStorageQuota(q);
        if (rConfig) setRouterMode(rConfig.mode);

        if (projects.length > 0) {
          setActiveProjectId(projects[0].id);
          setActiveProjectTitle(projects[0].title);
        }
      } catch (err) {
        console.error('App init error:', err);
      }
    }

    init();
  }, []);

  const handleSelectProject = async (projectId: string) => {
    setActiveProjectId(projectId);
    const p = await getProjectById(projectId);
    if (p) setActiveProjectTitle(p.title);
    setCurrentTab('storyboard');
  };

  const handleToggleRouterMode = async (mode: RouterMode) => {
    setRouterMode(mode);
    const cfg = await getRouterConfig();
    await saveRouterConfig({ ...cfg, mode });
  };

  const handleOpenNewProject = (category?: ProjectCategory) => {
    if (category) setWizardCategory(category);
    setIsWizardOpen(true);
  };

  const handleProjectCreated = (newId: string) => {
    handleSelectProject(newId);
  };

  const handleExportActiveProject = async () => {
    if (!activeProjectId) return;
    try {
      await exportProjectToZip(activeProjectId);
    } catch (err: any) {
      alert(`Gagal mengekspor proyek: ${err.message}`);
    }
  };

  const handleNavSelect = (tab: NavigationTab, param?: string) => {
    setCurrentTab(tab);
    setActiveParam(param);
    if (tab === 'storyboard' && param) {
      // If user clicked a specific category from sidebar (e.g. Video Iklan)
      setWizardCategory(param as ProjectCategory);
      setIsWizardOpen(true);
    }
  };

  const activeJobCount = jobs.filter((j) => j.status === 'processing' || j.status === 'queued').length;

  return (
    <div className="flex min-h-screen bg-background text-gray-100">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleNavSelect}
        activeProjectTitle={activeProjectTitle}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        storageUsageFormatted={storageQuota?.formattedUsed}
        storagePercent={storageQuota?.percentUsed}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <Header
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          routerMode={routerMode}
          onToggleRouterMode={handleToggleRouterMode}
          activeJobCount={activeJobCount}
          onOpenQueue={() => setIsQueueOpen(true)}
          onExportProject={activeProjectId ? handleExportActiveProject : undefined}
          currentProjectTitle={activeProjectTitle}
        />

        {/* View Surface */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-x-hidden">
          {currentTab === 'dashboard' && (
            <DashboardView
              onNavigate={handleNavSelect}
              onSelectProject={handleSelectProject}
              onCreateNewProject={() => handleOpenNewProject()}
            />
          )}

          {currentTab === 'projects' && (
            <ProjectsView
              onSelectProject={handleSelectProject}
              onCreateNewProject={() => handleOpenNewProject()}
            />
          )}

          {currentTab === 'storyboard' && (
            <StoryboardStudio
              projectId={activeProjectId}
              onOpenWizard={() => handleOpenNewProject()}
              onOpenProjects={() => setCurrentTab('projects')}
            />
          )}

          {currentTab === 'characters' && (
            <CharacterStudio projectId={activeProjectId} />
          )}

          {currentTab === 'image-gen' && (
            <ImageStudio projectId={activeProjectId} />
          )}

          {currentTab === 'video-gen' && (
            <VideoStudio projectId={activeProjectId} />
          )}

          {currentTab === 'voice-over' && (
            <VoiceOverStudio projectId={activeProjectId} />
          )}

          {currentTab === 'creative-tools' && (
            <CreativeToolsHub
              projectId={activeProjectId}
              initialToolId={activeParam}
            />
          )}

          {currentTab === 'providers' && (
            <ProviderManager />
          )}

          {currentTab === 'history' && (
            <GenerationHistoryView />
          )}

          {currentTab === 'settings' && (
            <SettingsView />
          )}
        </main>
      </div>

      {/* Generation Queue Modal */}
      <GenerationQueueOverlay
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
        jobs={jobs}
        onCancelJob={(id) => queueManager.cancelJob(id)}
      />

      {/* Storyboard Generator Wizard Modal */}
      <StoryboardWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onProjectCreated={handleProjectCreated}
        defaultCategory={wizardCategory}
      />
    </div>
  );
}
