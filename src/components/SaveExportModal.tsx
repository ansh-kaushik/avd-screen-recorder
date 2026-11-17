import React, { useState, useEffect } from 'react';
import { Save, Folder, Trash2, CheckCircle2, Film, ExternalLink, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { RecordingResult } from '../types';

interface SaveExportModalProps {
  result: RecordingResult;
  onClose: () => void;
  onDiscard: () => void;
}

const CATEGORIES = [
  'Dashboard',
  'Invoices',
  'Sale',
  'Reports',
  'Help Center',
  'Recurring',
  'Debit Credit Note',
  'Journal Entry',
  'Balance Sheet',
  'Tutorial'
];

export const SaveExportModal: React.FC<SaveExportModalProps> = ({
  result,
  onClose,
  onDiscard
}) => {
  const defaultName = `avd_clip_${new Date().toISOString().slice(0, 10)}_${Date.now().toString().slice(-4)}.mp4`;
  const [fileName, setFileName] = useState<string>(defaultName);
  const [title, setTitle] = useState<string>('');
  const [category, setCategory] = useState<string>('Tutorial');
  const [tags, setTags] = useState<string>('tutorial, avd, mobile');
  const [description, setDescription] = useState<string>('');
  const [destinationFolder, setDestinationFolder] = useState<string>(result.defaultSaveDir);
  const [discardTemp, setDiscardTemp] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string>('');

  // Resolve playable video URL
  useEffect(() => {
    async function loadVideoSrc() {
      if (!result.tempFilePath) return;

      if (window.electronAPI) {
        try {
          const res = await window.electronAPI.getVideoUrl(result.tempFilePath);
          if (res.success && res.url) {
            setVideoSrc(res.url);
            return;
          }
        } catch (e) {}
      }

      // Fallback custom protocol
      const normalized = result.tempFilePath.replace(/\\/g, '/');
      setVideoSrc(`local-media://${normalized}`);
    }

    loadVideoSrc();
  }, [result.tempFilePath]);

  // Pick Directory using Native Dialog
  const handleBrowseFolder = async () => {
    if (!window.electronAPI) return;
    const selected = await window.electronAPI.selectDirectory(destinationFolder);
    if (selected) {
      setDestinationFolder(selected);
    }
  };

  // Save Video & Companion Metadata
  const handleSave = async () => {
    if (!window.electronAPI || !result.tempFilePath) return;
    setIsSaving(true);
    setErrorMessage(null);

    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);

    try {
      const res = await window.electronAPI.saveRecording({
        tempFilePath: result.tempFilePath,
        fileName,
        destinationFolder,
        title: title || fileName,
        category,
        tags: tagList,
        description,
        keepTemp: !discardTemp
      });

      if (res.success && res.savedPath) {
        setSaveSuccess(true);
        setSavedPath(res.savedPath);

        // Confetti celebration
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
          });
        } catch (e) {}
      } else {
        setErrorMessage(res.error || 'Failed to save recording');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error occurred while saving');
    } finally {
      setIsSaving(false);
    }
  };

  // Open Folder in Windows File Explorer
  const handleRevealInExplorer = async () => {
    if (!window.electronAPI || !savedPath) return;
    await window.electronAPI.openFolder(savedPath);
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(4, 6, 12, 0.85)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '24px'
    }}>
      <div className="glass-panel" style={{
        width: '880px',
        maxHeight: '90vh',
        overflowY: 'auto',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9)',
        padding: '28px',
        position: 'relative'
      }}>
        {/* Close / Discard Button */}
        <button
          onClick={onDiscard}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            color: 'var(--text-muted)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)'
          }}>
            <Film size={22} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Recording Captured Successfully</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
              Review video playback, edit clip metadata, and export directly to your tutorials folder.
            </p>
          </div>
        </div>

        {/* Video Player & Info Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '320px 1fr',
          gap: '24px',
          marginBottom: '24px'
        }}>
          {/* Left: Video Preview Player */}
          <div style={{
            background: '#030508',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {videoSrc ? (
              <video
                key={videoSrc}
                src={videoSrc}
                controls
                autoPlay
                playsInline
                style={{
                  width: '100%',
                  height: '320px',
                  objectFit: 'contain',
                  background: '#000'
                }}
              />
            ) : (
              <div style={{
                height: '320px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-dim)',
                fontSize: '12px'
              }}>
                Loading video preview...
              </div>
            )}
            <div style={{
              padding: '10px 14px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: 'var(--text-muted)'
            }}>
              <span>Size: <strong>{formatFileSize(result.fileSize)}</strong></span>
              <span>Segments: <strong>{result.chunkCount} stitched</strong></span>
            </div>
          </div>

          {/* Right: Metadata Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* File Name */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                File Name (.mp4)
              </label>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                style={{ width: '100%' }}
                placeholder="e.g. invoice_creation_clip.mp4"
              />
            </div>

            {/* Title / Description */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Clip Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ width: '100%' }}
                placeholder="e.g. Invoices Page Full Flow"
              />
            </div>

            {/* Category Chips */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Category
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: 'none',
                      background: category === cat ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'rgba(255, 255, 255, 0.06)',
                      color: category === cat ? '#fff' : 'var(--text-muted)',
                      transition: 'all 0.15s'
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags Input */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                style={{ width: '100%' }}
                placeholder="e.g. tutorial, invoices, accounting"
              />
            </div>

            {/* Description Textarea */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Description / Notes
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                style={{ width: '100%', resize: 'none' }}
                placeholder="Key highlights in this clip..."
              />
            </div>

            {/* Destination Folder */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Destination Folder
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={destinationFolder}
                  onChange={(e) => setDestinationFolder(e.target.value)}
                  style={{ flex: 1, fontSize: '12px' }}
                />
                <button
                  type="button"
                  onClick={handleBrowseFolder}
                  className="btn-secondary"
                  style={{ padding: '8px 12px', fontSize: '12px' }}
                >
                  <Folder size={14} /> Browse
                </button>
              </div>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '10px',
                fontSize: '12px',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={discardTemp}
                  onChange={(e) => setDiscardTemp(e.target.checked)}
                />
                Discard temp file after saving
              </label>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#fca5a5',
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '12px',
            marginBottom: '16px'
          }}>
            {errorMessage}
          </div>
        )}

        {/* Success Banner */}
        {saveSuccess && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            color: '#6ee7b7',
            padding: '12px 16px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={18} color="#10b981" />
              <span>Saved to {destinationFolder}</span>
            </div>
            <button
              onClick={handleRevealInExplorer}
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(16, 185, 129, 0.2)' }}
            >
              <ExternalLink size={14} /> Show in Explorer
            </button>
          </div>
        )}

        {/* Modal Actions Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '18px'
        }}>
          <button
            onClick={onDiscard}
            disabled={isSaving}
            className="btn-secondary"
            style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
          >
            <Trash2 size={15} /> Discard Clip
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            {saveSuccess ? (
              <button
                onClick={onClose}
                className="btn-primary"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
              >
                Done
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="btn-primary"
              >
                {isSaving ? (
                  'Saving & Exporting...'
                ) : (
                  <>
                    <Save size={16} /> Save Recording
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
