import React, { useState, useEffect, useRef } from 'react';
import {
  FolderKanban,
  Plus,
  Download,
  Upload,
  Copy,
  Trash2,
  Film,
  Calendar,
  Layers,
  ArrowRight,
  HardDrive,
  FileArchive,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { getAllProjects, deleteProject, duplicateProject } from '@/lib/db/projects';
import { exportProjectToZip, importProjectFromZip, backupAllProjects } from '@/lib/storage/export-import';
import { Project } from '@/types/project';

interface ProjectsViewProps {
  onSelectProject: (projectId: string) => void;
  onCreateNewProject: () => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  onSelectProject,
  onCreateNewProject,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProjects = async () => {
    try {
      const list = await getAllProjects();
      setProjects(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleDuplicate = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setActionLoading(`dup_${projectId}`);
      await duplicateProject(projectId);
      await loadProjects();
      setStatusMessage('Proyek berhasil diduplikasi.');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      alert(`Gagal menduplikasi: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (projectId: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Hapus proyek "${title}" secara permanen dari penyimpanan lokal?`)) return;

    try {
      setActionLoading(`del_${projectId}`);
      await deleteProject(projectId);
      await loadProjects();
      setStatusMessage('Proyek berhasil dihapus.');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      alert(`Gagal menghapus: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleExportZip = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setActionLoading(`exp_${projectId}`);
      await exportProjectToZip(projectId);
    } catch (err: any) {
      alert(`Gagal mengekspor ZIP: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setActionLoading('importing');
      const newProjectId = await importProjectFromZip(file);
      await loadProjects();
      setStatusMessage('Proyek berhasil diimpor dari file ZIP!');
      setTimeout(() => setStatusMessage(null), 4000);
      onSelectProject(newProjectId);
    } catch (err: any) {
      alert(`Gagal mengimpor ZIP: ${err.message}`);
    } finally {
      setActionLoading(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-accent-purple" />
            My Projects
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Semua storyboard dan konten tersimpan secara lokal di browser Anda (IndexedDB).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileImport}
            accept=".zip"
            className="hidden"
          />

          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            isLoading={actionLoading === 'importing'}
          >
            <Upload className="w-3.5 h-3.5" />
            Import ZIP
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                setActionLoading('backup');
                await backupAllProjects();
              } catch (err: any) {
                alert(`Gagal backup: ${err.message}`);
              } finally {
                setActionLoading(null);
              }
            }}
            isLoading={actionLoading === 'backup'}
          >
            <FileArchive className="w-3.5 h-3.5 text-accent-cyan" />
            Backup All ZIP
          </Button>

          <Button variant="primary" size="sm" onClick={onCreateNewProject}>
            <Plus className="w-3.5 h-3.5" />
            Proyek Baru
          </Button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-lg text-xs font-medium">
          {statusMessage}
        </div>
      )}

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="p-12 border border-dashed border-border rounded-xl text-center space-y-4 bg-[#0C0E1B]">
          <Film className="w-12 h-12 mx-auto text-gray-600" />
          <div>
            <h3 className="text-sm font-semibold text-gray-300">Belum Ada Proyek</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              Buat storyboard baru untuk iklan, animasi, film, atau konten sosial media menggunakan AI.
            </p>
          </div>
          <Button variant="primary" onClick={onCreateNewProject}>
            <Plus className="w-4 h-4" /> Buat Proyek Pertama
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((proj) => (
            <div
              key={proj.id}
              onClick={() => onSelectProject(proj.id)}
              className="p-5 bg-surface hover:bg-surface-light border border-border hover:border-accent-purple/60 rounded-xl transition-all cursor-pointer flex flex-col justify-between group space-y-4 shadow-sm"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="purple" size="sm" className="uppercase font-mono">
                    {proj.category}
                  </Badge>
                  <span className="text-[11px] font-mono text-gray-400">
                    {proj.aspectRatio}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-gray-100 group-hover:text-accent-cyan transition-colors truncate">
                    {proj.title}
                  </h3>
                  <p className="text-xs text-gray-400 line-clamp-3 mt-1.5 leading-relaxed">
                    {proj.synopsis || 'Belum ada sinopsis.'}
                  </p>
                </div>
              </div>

              {/* Bottom metadata & actions */}
              <div className="pt-3 border-t border-border/80 flex items-center justify-between">
                <div className="text-[11px] text-gray-400 flex items-center gap-1.5 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  {new Date(proj.updatedAt).toLocaleDateString()}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handleDuplicate(proj.id, e)}
                    disabled={actionLoading === `dup_${proj.id}`}
                    title="Duplikasi Proyek"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-secondary transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={(e) => handleExportZip(proj.id, e)}
                    disabled={actionLoading === `exp_${proj.id}`}
                    title="Ekspor Proyek ZIP (Lengkap dengan Aset)"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-accent-cyan hover:bg-secondary transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={(e) => handleDelete(proj.id, proj.title, e)}
                    disabled={actionLoading === `del_${proj.id}`}
                    title="Hapus Proyek"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
