import React, { useState } from 'react';
import { Ticket, Send, Copy, Check, Image as ImageIcon, Trash2, AlertCircle, Sparkles, Loader2 } from 'lucide-react';
import { generateJiraTicket } from './ai';

export const JiraTicketer: React.FC = () => {
    const [notes, setNotes] = useState('');
    const [image, setImage] = useState<{ data: string; mimeType: string; name: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState('');
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                setError('Please upload an image file.');
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = (event.target?.result as string).split(',')[1];
                setImage({ data: base64, mimeType: file.type, name: file.name });
                setError(null);
            };
            reader.readAsDataURL(file);
        }
    };

    const clearImage = () => setImage(null);

    const handleGenerate = async () => {
        if (!notes.trim() && !image) {
            setError('Please provide some notes or an image.');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const ticket = await generateJiraTicket({
                notes,
                image: image ? { data: image.data, mimeType: image.mimeType } : undefined
            });
            setResult(ticket);
        } catch (err: any) {
            setError(err.message || 'An error occurred during generation.');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        if (result) {
            navigator.clipboard.writeText(result);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-indigo-500/10 transition-colors"></div>
                <div className="relative flex items-center gap-4">
                    <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20">
                        <Ticket className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Jira Ticketer</h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">Turn raw notes and screenshots into structured tickets</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Input Column */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                    <Sparkles className="w-3 h-3 text-orange-500" />
                                    Raw Notes
                                </label>
                            </div>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Paste messy notes, bug details, or context here..."
                                className="w-full h-48 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all resize-none placeholder:text-slate-400 dark:placeholder:text-slate-700 font-medium"
                            />

                            <div className="space-y-3">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                    <ImageIcon className="w-3 h-3 text-orange-500" />
                                    Screenshot (Optional)
                                </label>

                                {!image ? (
                                    <div className="relative">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        />
                                        <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 bg-slate-50/50 dark:bg-slate-950/50 group-hover:bg-slate-50 dark:group-hover:bg-slate-900 transition-colors">
                                            <ImageIcon className="w-6 h-6 text-slate-400" />
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 text-center">
                                                Click or drag to upload screenshot
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative group rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                                        <img
                                            src={`data:${image.mimeType};base64,${image.data}`}
                                            alt="Upload preview"
                                            className="w-full h-32 object-cover opacity-80"
                                        />
                                        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-between">
                                            <span className="text-[10px] font-bold text-white truncate max-w-[150px]">{image.name}</span>
                                            <button
                                                onClick={clearImage}
                                                className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800">
                            <button
                                onClick={handleGenerate}
                                disabled={loading || (!notes.trim() && !image)}
                                className="w-full h-12 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-black rounded-xl shadow-lg shadow-orange-500/20 transition-all active:scale-95 group uppercase tracking-widest text-xs"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <Send className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                        Generate Ticket Draft
                                    </>
                                )}
                            </button>
                            {error && (
                                <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold border border-red-100 dark:border-red-900/30">
                                    <AlertCircle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Result Column */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 h-full flex flex-col min-h-[500px]">
                        <div className="p-6 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                            <span className="text-xs font-black uppercase tracking-widest text-slate-500">Draft Result</span>
                            {result && (
                                <button
                                    onClick={copyToClipboard}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${copied
                                            ? 'bg-teal-500 text-white'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-orange-500 hover:text-white'
                                        }`}
                                >
                                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                    {copied ? 'Copied' : 'Copy'}
                                </button>
                            )}
                        </div>

                        <div className="flex-1 p-6 relative">
                            {!result ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-950 rounded-full flex items-center justify-center mb-4 border border-slate-100 dark:border-slate-800">
                                        <Ticket className="w-8 h-8 text-slate-200 dark:text-slate-800" />
                                    </div>
                                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">Waiting for content</h3>
                                    <p className="text-xs text-slate-400 font-medium">Click generate to create your ticket</p>
                                </div>
                            ) : (
                                <pre className="text-sm font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-medium leading-relaxed">
                                    {result}
                                </pre>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
