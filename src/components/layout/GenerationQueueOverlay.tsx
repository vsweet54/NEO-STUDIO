import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { GenerationJob } from '@/types/generation';
import { Activity, CheckCircle2, XCircle, Clock, AlertTriangle, RefreshCw, X } from 'lucide-react';

interface GenerationQueueOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: GenerationJob[];
  onCancelJob: (jobId: string) => void;
}

export const GenerationQueueOverlay: React.FC<GenerationQueueOverlayProps> = ({
  isOpen,
  onClose,
  jobs,
  onCancelJob,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generation Job Manager"
      description="Antrean proses generasi AI aktif dan riwayat eksekusi real-time."
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {jobs.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <Activity className="w-10 h-10 mx-auto text-gray-600 mb-3 opacity-40" />
            <p className="text-sm font-medium">Tidak ada job yang sedang berjalan</p>
            <p className="text-xs text-gray-400 mt-1">
              Saat Anda men-generate cerita, storyboard, gambar, atau video, status akan muncul di sini.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {jobs.map((job) => {
              const isProcessing = job.status === 'processing';
              const isCompleted = job.status === 'completed';
              const isFailed = job.status === 'failed';

              return (
                <div
                  key={job.id}
                  className="p-3.5 bg-[#0D0E1A] border border-border rounded-xl space-y-2.5 transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isProcessing && (
                        <Activity className="w-4 h-4 text-accent-cyan animate-spin shrink-0" />
                      )}
                      {isCompleted && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      {isFailed && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}

                      <span className="text-xs font-semibold text-gray-200 uppercase tracking-wider">
                        {job.taskType} ({job.modality})
                      </span>

                      <Badge
                        variant={
                          isProcessing ? 'cyan' : isCompleted ? 'success' : isFailed ? 'danger' : 'neutral'
                        }
                        size="sm"
                      >
                        {job.status}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-gray-400">
                        {job.providerId} / {job.modelId}
                      </span>
                      {isProcessing && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onCancelJob(job.id)}
                          className="h-6 px-2 text-xs text-red-400 hover:text-red-300"
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Prompt Preview */}
                  <p className="text-xs text-gray-300 line-clamp-2 bg-secondary/50 p-2 rounded-lg font-mono">
                    {job.prompt}
                  </p>

                  {/* Progress Bar */}
                  {isProcessing && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-gray-400 font-mono">
                        <span>Memproses dengan AI provider...</span>
                        <span>{job.progress}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent-cyan transition-all duration-300"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Result or Error info */}
                  <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                    <div className="flex items-center gap-3">
                      {job.durationMs && (
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3" />
                          {(job.durationMs / 1000).toFixed(1)}s
                        </span>
                      )}
                      {job.tokenUsage && (
                        <span className="font-mono">
                          {job.tokenUsage.totalTokens} tokens
                        </span>
                      )}
                      {job.estimatedCost !== undefined && (
                        <span className="font-mono text-emerald-400">
                          Est. ${job.estimatedCost.toFixed(4)}
                        </span>
                      )}
                    </div>
                  </div>

                  {isFailed && job.error && (
                    <div className="p-2.5 bg-red-950/40 border border-red-800/50 rounded-lg text-xs text-red-300 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div className="overflow-hidden">
                        <p className="font-medium">Error Details:</p>
                        <p className="font-mono text-[11px] break-words">{job.error}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-border">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </div>
    </Modal>
  );
};
