import { Upload } from 'lucide-react';

interface FileUploadProps {
  onChange: (file: File) => void;
  currentFile?: File | null;
  currentFileName?: string;
  accept?: string;
  hint?: string;
}

export function FileUpload({
  onChange,
  currentFile,
  currentFileName,
  accept = '.pdf,.doc,.docx,.xls,.xlsx',
  hint = 'PDF, DOCX, XLSX (Max 10MB)',
}: FileUploadProps) {
  return (
    <div className="flex items-center gap-4">
      <label className="flex-1 border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 transition-colors rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer">
        <Upload size={24} className="text-slate-400 mb-2" />
        <span className="text-sm font-medium text-slate-600">Click to upload document</span>
        <span className="text-xs text-slate-400 mt-1">{hint}</span>
        <input
          type="file"
          className="hidden"
          accept={accept}
          onChange={(e) => e.target.files?.[0] && onChange(e.target.files[0])}
        />
      </label>
      {currentFile && (
        <div className="flex-1 bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm font-medium text-indigo-700 truncate">
          {currentFile.name}
        </div>
      )}
      {!currentFile && currentFileName && (
        <div className="flex-1 bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm font-medium text-indigo-700 truncate">
          Current: {currentFileName}
        </div>
      )}
    </div>
  );
}
