import React, { useState, useEffect } from 'react';
import { Save, Folder, Trash2, CheckCircle2, ExternalLink, X, AlertCircle, Loader2 } from 'lucide-react';
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
    <div className="modal-mask">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="save-title" style={{ maxWidth: '880px' }}>
        <div className="modal-header">
          <div>
            <h2 id="save-title">Save recording</h2>
            <p className="text-sm text-tertiary">Review the clip, add details, and export it.</p>
          </div>
          <button className="btn btn-text btn-icon" onClick={onClose} aria-label="Close without discarding" title="Close (keeps temp file)">
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
          <div className="card" style={{ overflow: 'hidden', alignSelf: 'start', boxShadow: 'none' }}>
            {videoSrc ? (
              <video key={videoSrc} src={videoSrc} controls autoPlay playsInline style={{ display: 'block', width: '100%', height: '360px', objectFit: 'contain', background: '#000' }} />
            ) : (
              <div className="text-tertiary" style={{ height: '360px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Loading preview…
              </div>
            )}
            <div className="text-sm text-secondary" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderTop: '1px solid var(--border-secondary)' }}>
              <span>{formatFileSize(result.fileSize)}</span>
              <span>{result.chunkCount} {result.chunkCount === 1 ? 'segment' : 'segments joined'}</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="field">
              <label className="field-label" htmlFor="file-name">File name</label>
              <input id="file-name" type="text" value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="invoice_creation_clip.mp4" />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="clip-title">Title</label>
              <input id="clip-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Invoices page full flow" />
            </div>

            <div className="field">
              <span className="field-label" id="category-label">Category</span>
              <div role="radiogroup" aria-labelledby="category-label" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    role="radio"
                    aria-checked={category === cat}
                    onClick={() => setCategory(cat)}
                    className={`tag ${category === cat ? 'tag-selected' : ''}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="clip-tags">Tags</label>
              <input id="clip-tags" type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tutorial, invoices" />
              <span className="text-sm text-tertiary">Separate with commas.</span>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="clip-notes">Notes</label>
              <textarea id="clip-notes" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Key highlights in this clip" />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="dest">Save to</label>
              <div className="field-row">
                <input id="dest" type="text" value={destinationFolder} onChange={(e) => setDestinationFolder(e.target.value)} />
                <button type="button" onClick={handleBrowseFolder} className="btn">
                  <Folder size={16} /> Browse
                </button>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={discardTemp} onChange={(e) => setDiscardTemp(e.target.checked)} />
                Delete temp file after saving
              </label>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="alert alert-error" role="alert" style={{ marginTop: '16px' }}>
            <AlertCircle size={16} /> {errorMessage}
          </div>
        )}

        {saveSuccess && (
          <div className="alert alert-success" role="status" style={{ marginTop: '16px' }}>
            <CheckCircle2 size={16} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Saved to {savedPath}</span>
            <button onClick={handleRevealInExplorer} className="btn">
              <ExternalLink size={16} /> Show in Explorer
            </button>
          </div>
        )}

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button onClick={onDiscard} disabled={isSaving} className="btn btn-danger">
            <Trash2 size={16} /> Discard
          </button>
          {saveSuccess ? (
            <button onClick={onClose} className="btn btn-primary">Done</button>
          ) : (
            <button onClick={handleSave} disabled={isSaving} className="btn btn-primary">
              {isSaving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
              {isSaving ? 'Saving…' : 'Save recording'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
