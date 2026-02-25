import React, { useState, useEffect } from 'react';
import { X, Save, Terminal, Loader2, Info, AlertTriangle, Lock, Unlock } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

export interface UnifiedToolSettingsModalProps {
  toolId: string;
  isOpen: boolean;
  onClose: () => void;
  /**
   * Default prompt used when no Firestore config exists yet.
   */
  defaultPrompt: string;
  /**
   * Optional: read-only locked core prompt to display above the editable
   * section. Used by System-B tools that have a hardcoded methodology block
   * (e.g. TNStandardizer). When provided the editable textarea becomes
   * "Additional Instructions" rather than the full prompt.
   */
  lockedPromptDisplay?: string;
  /**
   * Human-readable tool label for the modal title.
   */
  toolLabel?: string;
  /**
   * AI model attribution string shown in the footer.
   * Defaults to "Gemini 3 Flash Pro".
   */
  modelAttribution?: string;
}

export const UnifiedToolSettingsModal: React.FC<UnifiedToolSettingsModalProps> = ({
  toolId,
  isOpen,
  onClose,
  defaultPrompt,
  lockedPromptDisplay,
  toolLabel,
  modelAttribution = 'Gemini 3 Flash Pro',
}) => {
  const { isAdmin } = useAuth();
  const [instruction, setInstruction] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const hasSplitLayout = Boolean(lockedPromptDisplay);
  const displayTitle = toolLabel ?? toolId.replace(/-/g, ' ');

  useEffect(() => {
    if (!isOpen) return;
    const fetchConfig = async () => {
      setLoading(true);
      try {
        const d = await getDoc(doc(db, 'configurations', toolId));
        if (d.exists()) {
          const data = d.data();
          setInstruction(data.instruction ?? defaultPrompt);
          setIsLocked(!!data.isLocked);
        } else {
          setInstruction(defaultPrompt);
          setIsLocked(false);
        }
      } catch {
        setInstruction(defaultPrompt);
        setIsLocked(false);
      }
      setLoading(false);
    };
    fetchConfig();
  }, [isOpen, toolId, defaultPrompt]);

  const handleSave = async () => {
    if (!isAdmin) {
      alert('Access Denied: Admin privileges required.');
      return;
    }
    setSaving(true);
    try {
      await setDoc(doc(db, 'configurations', toolId), {
        instruction,
        isLocked,
        updatedAt: new Date().toISOString(),
        toolId,
      });
      alert('System Instructions updated successfully.');
      onClose();
    } catch (e) {
      console.error('Save Error:', e);
      alert('Error saving configuration.');
    }
    setSaving(false);
  };

  const toggleLock = () => {
    if (!isAdmin) return;
    if (isLocked && !confirm("Unlock this tool's logic? This allows modifications that could break existing quality standards.")) {
      return;
    }
    setIsLocked(!isLocked);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800">

        {/* ── Header ── */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-3 text-orange-500">
            <Terminal className="w-6 h-6" />
            <div>
              <h3 className="text-xl font-bold dark:text-white capitalize leading-tight">
                {displayTitle} System Prompt
              </h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                Global AI Configuration
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">

          {/* Stable Mode / Danger Zone banner — governance signal */}
          {isLocked ? (
            <div className="p-4 bg-teal-50 dark:bg-teal-900/20 rounded-xl flex items-start gap-3 border border-teal-100 dark:border-teal-800">
              <Lock className="w-5 h-5 text-teal-600 dark:text-teal-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-teal-800 dark:text-teal-400 mb-1">
                  STABLE MODE: Component Locked
                </p>
                <p className="text-[11px] text-teal-700 dark:text-teal-300 leading-relaxed">
                  This tool has been certified as Stable. Prompt modifications are disabled to prevent quality regressions. Unlock to edit.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-start gap-3 border border-amber-100 dark:border-amber-800">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-800 dark:text-amber-400 mb-1">DANGER ZONE: Admin Only</p>
                <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                  You are editing live System Instructions. These changes are sent to the AI for every user. Test thoroughly before locking.
                </p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="animate-spin text-orange-500 w-10 h-10 mb-4" />
              <p className="text-sm text-slate-500">Fetching live configuration...</p>
            </div>
          ) : (
            <>
              {/* Split layout: locked core + editable additional instructions */}
              {hasSplitLayout && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                      <Lock className="w-3 h-3" /> Core Methodology (Read-only)
                    </label>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border dark:border-slate-700 uppercase">
                      Locked
                    </span>
                  </div>
                  <textarea
                    readOnly
                    value={lockedPromptDisplay}
                    rows={10}
                    className="w-full p-4 font-mono text-xs bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 dark:text-slate-500 resize-none cursor-not-allowed opacity-70 outline-none leading-relaxed"
                  />
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
                      Additional Admin Instructions (Optional)
                    </span>
                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                  </div>
                </div>
              )}

              {/* Editable area */}
              <div className="relative group">
                {!hasSplitLayout && (
                  <div className="absolute top-3 right-3 text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border dark:border-slate-700 pointer-events-none uppercase">
                    {isLocked ? 'READ ONLY' : 'Markdown / Text'}
                  </div>
                )}
                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  disabled={isLocked}
                  rows={hasSplitLayout ? 5 : 14}
                  className={`w-full p-6 font-mono text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-slate-800 dark:text-slate-300 shadow-inner resize-none leading-relaxed transition-opacity ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                  placeholder={hasSplitLayout
                    ? 'Add any clarification notes or extra rules here. These will be appended after the locked methodology...'
                    : 'Enter the system instruction for the AI model...'}
                />
              </div>
            </>
          )}
        </div>

        {/* ── Footer — governance controls ── */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
          <div className="flex items-center gap-4">
            {/* Lock badge — Locked (Verified) state */}
            <button
              onClick={toggleLock}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                isLocked
                  ? 'bg-teal-500 text-white shadow-md'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              {isLocked ? 'Locked (Verified)' : 'Unlocked (Beta)'}
            </button>
            {/* Model attribution */}
            <div className="flex items-center gap-2 text-slate-400">
              <Info className="w-4 h-4" />
              <span className="text-[10px] font-medium italic">{modelAttribution}</span>
            </div>
          </div>
          {/* Save disabled when locked */}
          <button
            onClick={handleSave}
            disabled={saving || isLocked || !isAdmin}
            className="px-8 py-3 bg-orange-500 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-orange-600 shadow-lg shadow-orange-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};
