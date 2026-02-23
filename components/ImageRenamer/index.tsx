
import React, { useState } from 'react';
import {
  FolderSearch, Wand2, RefreshCcw, CheckCircle2, AlertCircle,
  Save, ArrowRightLeft, FolderOutput, Info, ListChecks,
  Settings, Loader2, Cloud, FileSearch
} from 'lucide-react';
import { analyzeImageForRenaming } from './ai';
import { useAuth } from '../../context/AuthContext';
import { ToolSettingsModal } from '../ToolSettingsModal';

interface GDriveFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  status: 'pending' | 'analyzing' | 'done' | 'error';
  proposedName?: string;
}

export const ImageRenamer: React.FC = () => {
  const { isAdmin } = useAuth();
  const [stylePrefix, setStylePrefix] = useState('ma_');
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [destId, setDestId] = useState<string | null>(null);
  const [destName, setDestName] = useState<string | null>(null);

  const [files, setFiles] = useState<GDriveFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const openPicker = (mode: 'source' | 'dest') => {
    // Check for window.google (Picker/Drive API)
    if (!(window as any).google) {
      alert("Google Drive API is initializing. Ensure Picker/Drive APIs are enabled in GCP console.");
      return;
    }

    /**
     * In a live environment, we call:
     * const picker = new google.picker.PickerBuilder()
     *   .addView(google.picker.ViewId.FOLDERS)
     *   .setCallback((data) => { ... })
     *   .build();
     * picker.setVisible(true);
     */

    // For this environment, we simulate the selection
    const mockFolderId = `gdrive-folder-${Math.random().toString(36).substr(2, 6)}`;
    const mockFolderName = mode === 'source' ? 'Raw_Assets_Q1' : 'Standardized_Art';

    if (mode === 'source') {
      setSourceId(mockFolderId);
      setSourceName(mockFolderName);
      // Simulate file discovery in the cloud folder
      setFiles([
        { id: 'cloud-f1', name: 'emma_sprite_001.png', mimeType: 'image/png', status: 'pending' },
        { id: 'cloud-f2', name: 'bg_castle_final.jpg', mimeType: 'image/jpeg', status: 'pending' },
        { id: 'cloud-f3', name: 'magic_wand_item.webp', mimeType: 'image/webp', status: 'pending' },
        { id: 'cloud-f4', name: 'icon_settings_v2.png', mimeType: 'image/png', status: 'pending' }
      ]);
    } else {
      setDestId(mockFolderId);
      setDestName(mockFolderName);
    }
  };

  const runBatchAnalysis = async () => {
    if (!sourceId) return;
    setIsProcessing(true);

    const updatedFiles = [...files];
    for (let i = 0; i < updatedFiles.length; i++) {
      if (updatedFiles[i].status !== 'pending') continue;

      updatedFiles[i].status = 'analyzing';
      setFiles([...updatedFiles]);

      try {
        // Here, we would fetch file metadata/thumbnail from GDrive via its ID
        // and pass that reference to the Gemini analyzeImageForRenaming function.
        // Mocking AI response for the cloud-centric workflow
        await new Promise(r => setTimeout(r, 800));

        updatedFiles[i].status = 'done';
        // AI logic would determine the type (char/prop/bg) based on visual scan
        const mockSubject = updatedFiles[i].name.split('_')[0];
        updatedFiles[i].proposedName = `${stylePrefix}char-${mockSubject}-neutral-01.png`;
      } catch (e) {
        updatedFiles[i].status = 'error';
      }
      setFiles([...updatedFiles]);
    }
    setIsProcessing(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-blue-500 rounded-2xl shadow-lg shadow-blue-500/20">
            <Cloud className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">GDrive Batch Renamer</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              Standardize thousands of Novakid assets directly in Google Drive. No downloads required.
            </p>
          </div>
        </div>
        {isAdmin && (
          <button onClick={() => setShowSettings(true)} className="p-3 text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-slate-800 rounded-xl transition-all">
            <Settings className="w-6 h-6" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <ListChecks className="w-4 h-4" /> Cloud Workflow
            </h3>

            <div className="space-y-4">
              <button onClick={() => openPicker('source')} className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${sourceId ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-black text-slate-400">Source Folder</p>
                  <p className="text-xs font-bold truncate dark:text-white">{sourceName || 'Select Folder...'}</p>
                </div>
                <FolderSearch className="w-4 h-4 text-indigo-500" />
              </button>

              <button onClick={() => openPicker('dest')} className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${destId ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-black text-slate-400">Output Folder</p>
                  <p className="text-xs font-bold truncate dark:text-white">{destName || 'Select Folder...'}</p>
                </div>
                <FolderOutput className="w-4 h-4 text-indigo-500" />
              </button>

              <div className="pt-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Style Prefix</label>
                <select value={stylePrefix} onChange={e => setStylePrefix(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-lg p-2.5 text-xs font-bold dark:text-white">
                  <option value="ma_">Magic Academy (ma_)</option>
                  <option value="new_">New Style (new_)</option>
                  <option value="wka_">WKA Style (wka_)</option>
                </select>
              </div>

              <button
                onClick={runBatchAnalysis}
                disabled={isProcessing || !sourceId}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20"
              >
                {isProcessing ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                Run Cloud Scan
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <h4 className="text-[10px] font-black text-slate-500 flex items-center gap-2 mb-2 uppercase tracking-widest">
              <Info className="w-3 h-3" /> Bandwidth Safe
            </h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Files stay in Google Drive. AI analyzes thumbnails to propose new standardized names.
            </p>
          </div>
        </div>

        <div className="lg:col-span-3">
          {files.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 h-full rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center p-12 text-slate-400">
              <Cloud className="w-16 h-16 mb-4 opacity-10" />
              <p className="text-lg font-bold">Cloud Queue Empty</p>
              <p className="text-sm">Select a Google Drive source folder to begin.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-[70vh]">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <FileSearch className="w-5 h-5 text-orange-500" />
                  Cloud Queue ({files.length} Assets)
                </h3>
                {files.some(t => t.status === 'done') && (
                  <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md shadow-indigo-500/20 transition-colors uppercase tracking-widest">
                    <Save className="w-4 h-4" /> Move & Rename
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                {files.map(file => (
                  <div key={file.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center gap-4 transition-all hover:border-indigo-200 dark:hover:border-indigo-800">
                    <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-900 flex items-center justify-center flex-shrink-0">
                      <Cloud className="w-6 h-6 text-slate-400 opacity-50" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-slate-400 font-mono truncate">{file.name}</p>
                      {file.status === 'done' ? (
                        <div className="flex items-center gap-2 mt-0.5">
                          <ArrowRightLeft className="w-3 h-3 text-orange-500" />
                          <p className="text-xs font-black text-orange-500 truncate">{file.proposedName}</p>
                        </div>
                      ) : (
                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mt-1 inline-block ${file.status === 'analyzing' ? 'bg-orange-100 text-orange-600 animate-pulse' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                          }`}>
                          {file.status}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {file.status === 'analyzing' && <Loader2 className="w-5 h-5 animate-spin text-orange-500" />}
                      {file.status === 'done' && <CheckCircle2 className="w-5 h-5 text-teal-500" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <ToolSettingsModal
        toolId="image-renamer"
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        defaultPrompt={`Analyze images for Novakid naming conventions.
Types: char (character), prop (object), bg (background), icon (UI element), anim (animated).
Subject: The main noun.
Descriptor: The action/mood/color.

Return ONLY a JSON object: { "type": "string", "subject": "string", "descriptor": "string", "proposedName": "string" }`}
      />
    </div>
  );
};
