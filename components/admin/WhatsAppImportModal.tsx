'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
    parseContactImport,
    type ContactImportSource,
    type ParsedWhatsAppContact,
} from '@/lib/whatsapp-contacts';

type Step = 'instructions' | 'upload' | 'preview' | 'results';

interface WhatsAppImportModalProps {
    open: boolean;
    onClose: () => void;
    onImported: () => void;
}

interface ImportApiResult {
    imported: number;
    updated: number;
    skipped: number;
    failed: number;
    rows: Array<{
        previewId: string;
        fullName: string;
        phone: string;
        status: string;
        message?: string;
    }>;
}

const ACCEPTED_EXTENSIONS = ['.vcf', '.csv', '.txt'];

export default function WhatsAppImportModal({ open, onClose, onImported }: WhatsAppImportModalProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [step, setStep] = useState<Step>('instructions');
    const [format, setFormat] = useState<ContactImportSource | 'auto'>('auto');
    const [rawContent, setRawContent] = useState('');
    const [contacts, setContacts] = useState<ParsedWhatsAppContact[]>([]);
    const [invalidRows, setInvalidRows] = useState<Array<{ raw: string; reason: string }>>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [mergeDuplicates, setMergeDuplicates] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [importResult, setImportResult] = useState<ImportApiResult | null>(null);

    const reset = useCallback(() => {
        setStep('instructions');
        setFormat('auto');
        setRawContent('');
        setContacts([]);
        setInvalidRows([]);
        setSelectedIds(new Set());
        setMergeDuplicates(true);
        setLoading(false);
        setError(null);
        setImportResult(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, []);

    const handleClose = () => {
        reset();
        onClose();
    };

    const parseContent = (content: string, selectedFormat: ContactImportSource | 'auto' = 'auto') => {
        const parsed = parseContactImport(content, selectedFormat);
        setContacts(parsed.contacts);
        setInvalidRows(parsed.invalid);
        setSelectedIds(new Set(parsed.contacts.map((c) => c.previewId)));
        setFormat(parsed.format);
        setStep('preview');
    };

    const handleFileChange = async (file: File | null) => {
        if (!file) return;
        setError(null);

        const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
        if (!ACCEPTED_EXTENSIONS.includes(ext)) {
            setError('Please upload a .vcf, .csv, or .txt file');
            return;
        }

        try {
            const text = await file.text();
            setRawContent(text);
            parseContent(text, ext === '.vcf' ? 'vcard' : ext === '.csv' ? 'csv' : 'auto');
        } catch {
            setError('Could not read the file. Try again or paste contacts manually.');
        }
    };

    const handlePasteParse = () => {
        if (!rawContent.trim()) {
            setError('Paste your contacts or upload a file first');
            return;
        }
        setError(null);
        parseContent(rawContent, format);
    };

    const selectedContacts = useMemo(
        () => contacts.filter((c) => selectedIds.has(c.previewId)),
        [contacts, selectedIds]
    );

    const toggleAll = () => {
        if (selectedIds.size === contacts.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(contacts.map((c) => c.previewId)));
        }
    };

    const toggleOne = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const runImport = async () => {
        if (selectedContacts.length === 0) {
            setError('Select at least one contact to import');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                setError('Your session expired. Please sign in again.');
                return;
            }

            const response = await fetch('/api/admin/customers/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    contacts: selectedContacts,
                    mergeDuplicates,
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                setError(data.error || 'Import failed');
                return;
            }

            setImportResult(data);
            setStep('results');
            onImported();
        } catch {
            setError('Network error during import. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand-cream flex items-center justify-center">
                            <i className="ri-whatsapp-line text-brand-brown text-xl"></i>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Import from WhatsApp</h2>
                            <p className="text-sm text-gray-500">Bring your WhatsApp contacts into Customers</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500"
                        aria-label="Close"
                    >
                        <i className="ri-close-line text-xl"></i>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-brand-cream border border-brand-brown/20 text-brand-brown text-sm">
                            {error}
                        </div>
                    )}

                    {step === 'instructions' && (
                        <div className="space-y-5">
                            <div className="rounded-xl bg-brand-cream border border-brand-brown/20 p-4">
                                <p className="text-sm text-brand-brown font-medium mb-2">How to export from WhatsApp</p>
                                <ol className="text-sm text-brand-brown space-y-2 list-decimal list-inside">
                                    <li>Open <strong>WhatsApp</strong> on your phone</li>
                                    <li>Go to <strong>Settings → Chats</strong></li>
                                    <li>Tap <strong>Chat history → Export contacts</strong></li>
                                    <li>Save the <strong>.vcf</strong> file and upload it below</li>
                                </ol>
                            </div>

                            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-sm text-gray-700 space-y-2">
                                <p className="font-medium text-gray-900">Also supported</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>CSV with columns: Name, Phone (optional Email)</li>
                                    <li>Pasted lines like: <code className="bg-white px-1 rounded">Ama Mensah 0241234567</code></li>
                                </ul>
                                <p className="text-gray-500 pt-1">
                                    Contacts without email get a placeholder address. Duplicates are matched by phone number.
                                </p>
                            </div>

                            <button
                                onClick={() => setStep('upload')}
                                className="w-full py-3 bg-gray-900 hover:bg-brand-bag-dark text-white rounded-lg font-semibold"
                            >
                                Continue to Upload
                            </button>
                        </div>
                    )}

                    {step === 'upload' && (
                        <div className="space-y-5">
                            <div
                                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-brand-brown transition-colors cursor-pointer"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <i className="ri-upload-cloud-2-line text-4xl text-gray-400 mb-3"></i>
                                <p className="font-semibold text-gray-900">Upload contact file</p>
                                <p className="text-sm text-gray-500 mt-1">.vcf from WhatsApp, or .csv / .txt</p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".vcf,.csv,.txt,text/vcard,text/csv"
                                    className="hidden"
                                    onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                                />
                            </div>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-3 bg-white text-gray-500">or paste contacts</span>
                                </div>
                            </div>

                            <textarea
                                value={rawContent}
                                onChange={(e) => setRawContent(e.target.value)}
                                placeholder={'BEGIN:VCARD\nFN:Jane Doe\nTEL:+233241234567\nEND:VCARD\n\n--- or ---\n\nJane Doe, 0241234567'}
                                rows={8}
                                className="w-full border-2 border-gray-300 rounded-lg p-3 text-sm font-mono focus:ring-2 focus:ring-gray-600 focus:border-gray-600"
                            />

                            <div className="flex items-center gap-3">
                                <select
                                    value={format}
                                    onChange={(e) => setFormat(e.target.value as ContactImportSource | 'auto')}
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                >
                                    <option value="auto">Auto-detect format</option>
                                    <option value="vcard">vCard (.vcf)</option>
                                    <option value="csv">CSV</option>
                                    <option value="text">Plain text</option>
                                </select>
                                <button
                                    onClick={handlePasteParse}
                                    className="flex-1 py-2.5 bg-brand-brown hover:bg-brand-bag-dark text-white rounded-lg font-semibold"
                                >
                                    Preview Contacts
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="text-sm text-gray-600">
                                    <span className="font-semibold text-gray-900">{contacts.length}</span> valid contacts
                                    {invalidRows.length > 0 && (
                                        <span className="text-brand-brown"> · {invalidRows.length} skipped (invalid)</span>
                                    )}
                                </p>
                                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={mergeDuplicates}
                                        onChange={(e) => setMergeDuplicates(e.target.checked)}
                                        className="rounded border-gray-300"
                                    />
                                    Merge with existing customers (by phone)
                                </label>
                            </div>

                            <div className="border border-gray-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2 text-left">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.size === contacts.length && contacts.length > 0}
                                                    onChange={toggleAll}
                                                />
                                            </th>
                                            <th className="px-4 py-2 text-left font-semibold text-gray-700">Name</th>
                                            <th className="px-4 py-2 text-left font-semibold text-gray-700">Phone</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {contacts.map((c) => (
                                            <tr key={c.previewId} className="hover:bg-gray-50">
                                                <td className="px-4 py-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(c.previewId)}
                                                        onChange={() => toggleOne(c.previewId)}
                                                    />
                                                </td>
                                                <td className="px-4 py-2 font-medium text-gray-900">{c.fullName}</td>
                                                <td className="px-4 py-2 text-gray-600">{c.phone}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {invalidRows.length > 0 && (
                                <details className="text-sm">
                                    <summary className="cursor-pointer text-brand-brown font-medium">
                                        View {invalidRows.length} invalid entries
                                    </summary>
                                    <ul className="mt-2 space-y-1 text-gray-600 max-h-32 overflow-y-auto">
                                        {invalidRows.map((row, i) => (
                                            <li key={i}>
                                                <span className="font-mono text-xs">{row.raw}</span> — {row.reason}
                                            </li>
                                        ))}
                                    </ul>
                                </details>
                            )}
                        </div>
                    )}

                    {step === 'results' && importResult && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="rounded-lg bg-brand-cream border border-brand-brown/20 p-3 text-center">
                                    <p className="text-2xl font-bold text-brand-brown">{importResult.imported}</p>
                                    <p className="text-xs text-brand-brown">Imported</p>
                                </div>
                                <div className="rounded-lg bg-brand-cream border border-brand-brown/20 p-3 text-center">
                                    <p className="text-2xl font-bold text-brand-brown">{importResult.updated}</p>
                                    <p className="text-xs text-brand-brown">Updated</p>
                                </div>
                                <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-center">
                                    <p className="text-2xl font-bold text-gray-700">{importResult.skipped}</p>
                                    <p className="text-xs text-gray-600">Skipped</p>
                                </div>
                                <div className="rounded-lg bg-brand-cream border border-brand-brown/20 p-3 text-center">
                                    <p className="text-2xl font-bold text-brand-brown">{importResult.failed}</p>
                                    <p className="text-xs text-red-800">Failed</p>
                                </div>
                            </div>

                            {importResult.failed > 0 && (
                                <div className="border border-brand-brown/20 rounded-lg p-3 max-h-40 overflow-y-auto text-sm">
                                    {importResult.rows
                                        .filter((r) => r.status === 'failed')
                                        .map((r) => (
                                            <p key={r.previewId} className="text-brand-brown">
                                                {r.fullName} ({r.phone}): {r.message}
                                            </p>
                                        ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-gray-200 flex justify-between gap-3">
                    {step === 'upload' && (
                        <button
                            onClick={() => setStep('instructions')}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                        >
                            Back
                        </button>
                    )}
                    {step === 'preview' && (
                        <button
                            onClick={() => setStep('upload')}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                        >
                            Back
                        </button>
                    )}
                    <div className="flex-1" />
                    {step === 'preview' && (
                        <button
                            onClick={runImport}
                            disabled={loading || selectedContacts.length === 0}
                            className="px-6 py-2.5 bg-brand-brown hover:bg-brand-bag-dark disabled:opacity-50 text-white rounded-lg font-semibold"
                        >
                            {loading ? 'Importing…' : `Import ${selectedContacts.length} Contact${selectedContacts.length !== 1 ? 's' : ''}`}
                        </button>
                    )}
                    {step === 'results' && (
                        <button
                            onClick={handleClose}
                            className="px-6 py-2.5 bg-gray-900 hover:bg-brand-bag-dark text-white rounded-lg font-semibold"
                        >
                            Done
                        </button>
                    )}
                    {(step === 'instructions' || step === 'upload') && (
                        <button
                            onClick={handleClose}
                            className="px-4 py-2 text-gray-600 hover:text-gray-900"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
