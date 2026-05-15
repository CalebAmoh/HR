import React from 'react';
import { motion } from 'motion/react';
import { X, FileText, Download } from 'lucide-react';

export function DocumentViewer({ document, onClose }: any) {
  if (!document) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col p-4 sm:p-6 bg-slate-900/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="flex flex-col h-full bg-white rounded-2xl shadow-2xl overflow-hidden max-w-5xl mx-auto w-full"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 syne">
                {document.name || document.documentType || 'Document View'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">Previewing attachment</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
              <Download size={14} /> Download
            </button>
            <button onClick={onClose} className="p-2 text-slate-500 hover:bg-slate-200 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>
        
        <div className="flex-1 bg-slate-100 p-8 flex items-center justify-center overflow-auto">
          {/* Mock PDF Viewer content */}
          <div className="bg-white shadow-md border border-slate-200 max-w-3xl w-full aspect-[1/1.414] p-12 flex flex-col gap-6 mx-auto my-auto relative">
            <div className="absolute top-0 right-0 p-8 opacity-10">
               <FileText size={120} />
            </div>
            <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4">
               <div>
                 <h1 className="text-3xl font-bold text-slate-900 syne">{document.name || document.documentType || 'COMPANY DOCUMENT'}</h1>
                 <p className="text-slate-500 mt-2 font-medium">Issue Date: {document.dateOfIssue || new Date().toLocaleDateString()}</p>
                 {document.expiryDate && <p className="text-slate-500 font-medium">Expiry Date: {document.expiryDate}</p>}
               </div>
            </div>
            
            <div className="flex flex-col gap-4 mt-8">
               <div className="h-6 bg-slate-100 rounded w-full"></div>
               <div className="h-6 bg-slate-100 rounded w-full"></div>
               <div className="h-6 bg-slate-100 rounded w-11/12"></div>
               <div className="h-6 bg-slate-100 rounded w-full"></div>
               <div className="h-6 bg-slate-100 rounded w-10/12"></div>
            </div>

            <div className="mt-8 pt-8 border-t border-slate-200">
               <h4 className="font-bold text-slate-800 mb-2">Details</h4>
               <p className="text-slate-600 leading-relaxed text-sm">
                 {document.details || 'This is a mock representation of the generated PDF document. The standard PDF viewer would be rendered here in a production environment.'}
               </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
