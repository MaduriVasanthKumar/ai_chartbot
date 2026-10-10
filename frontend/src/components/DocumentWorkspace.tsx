import { useState } from 'react';
import { FileText, Upload, MessageSquare, Clock } from 'lucide-react';
import type { DocumentItem } from '../types';
import { uploadDocument } from '../services/api';

interface DocumentWorkspaceProps {
  documents: DocumentItem[];
  onDocumentUploaded: (doc: DocumentItem) => void;
  onAskDocument: (doc: DocumentItem) => void;
}

export const DocumentWorkspace: React.FC<DocumentWorkspaceProps> = ({
  documents,
  onDocumentUploaded,
  onAskDocument,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFileUpload = async (file: File) => {
    try {
      setIsUploading(true);
      const newDoc = await uploadDocument(file);
      onDocumentUploaded(newDoc);
    } catch (e) {
      alert("Failed to upload document");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-900 space-y-6">
      {/* Workspace Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <FileText className="w-6 h-6 text-violet-400" />
          Document Library & Note Q&A
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Upload PDFs, lecture slides, or study notes for instant AI summaries, key-point extraction, and page-referenced answers.
        </p>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
          dragOver ? 'border-violet-500 bg-violet-500/10' : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
        }`}
      >
        <div className="w-12 h-12 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center mx-auto mb-3 text-violet-400">
          <Upload className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-200">
          Upload PDF or Text Notes
        </h3>
        <p className="text-xs text-slate-400 mt-1 mb-4">
          Drag & drop your study documents here, or click to browse files
        </p>
        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs cursor-pointer shadow-lg shadow-violet-600/20 transition-all">
          <span>{isUploading ? 'Uploading & Processing...' : 'Select Document'}</span>
          <input
            type="file"
            accept=".pdf,.txt,.md"
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            className="hidden"
            disabled={isUploading}
          />
        </label>
      </div>

      {/* Uploaded Documents Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Your Uploaded Documents ({documents.length})
        </h3>

        {documents.length === 0 ? (
          <div className="text-xs text-slate-500 p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800">
            No documents uploaded yet. Upload a PDF note to get started!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-violet-500/50 transition-all flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-violet-600/20 text-violet-400 flex items-center justify-center font-bold text-xs">
                        PDF
                      </div>
                      <div className="truncate">
                        <h4 className="text-xs font-semibold text-slate-200 truncate">{doc.filename}</h4>
                        <div className="text-[10px] text-slate-500 flex items-center gap-2">
                          <span>{doc.page_count || 1} Pages</span>
                          <span>•</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(doc.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-3 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                    "{doc.summary}"
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                  <button
                    onClick={() => onAskDocument(doc)}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 font-medium text-xs flex items-center justify-center gap-1.5 border border-violet-500/30 transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Ask Questions on this Doc</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
