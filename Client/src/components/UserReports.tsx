import { useState } from 'react';
import { Download, Search, FileSpreadsheet } from 'lucide-react';
import { motion } from 'motion/react';

const mockReports = [
  { id: 1, name: 'My Payslips', description: 'Download your monthly payslips securely.' },
  { id: 2, name: 'My Personal Info Summary', description: 'Export a summary of your profile and demographic details.' },
  { id: 3, name: 'My Leave Statement', description: 'Get a statement of all your past leave requests and remaining balances.' },
  { id: 4, name: 'My Tax Documents', description: 'End-of-year tax summary documents and declarations.' }
];

export function UserReports() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredReports = mockReports.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 w-full relative h-full flex flex-col">
      <div className="max-w-[1300px] w-full mx-auto px-6 py-8 flex-1 flex flex-col">
        {/* Page Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
          <h1 className="syne text-[26px] font-extrabold text-[var(--text-primary)] m-0 flex items-center gap-2">
            <FileSpreadsheet className="text-[var(--accent)]" size={28} />
            User Reports
          </h1>
          <p className="text-[13px] text-[var(--text-muted)] mt-1.5">Generate and download your personal employment records.</p>
        </motion.div>

        {/* Content */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-[var(--surface)] border border-[var(--border)] rounded-[16px] overflow-hidden flex flex-col flex-1 max-h-min drop-shadow-sm">
           {/* Toolbar */}
           <div className="flex flex-col border-b border-[var(--border)]">
             <div className="p-4 sm:p-5 flex flex-col sm:flex-row lg:items-center justify-between gap-4">
                <div className="search-wrap w-full sm:w-auto sm:min-w-[300px]">
                  <Search size={14} />
                  <input
                    type="text"
                    placeholder="Search my reports..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
             </div>
           </div>
  
           <div className="overflow-x-auto flex-1">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th scope="col" className="th">
                      Report Name
                    </th>
                    <th scope="col" className="th">
                      Description
                    </th>
                    <th scope="col" className="th text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.length > 0 ? (
                    filteredReports.map((row, i) => (
                      <motion.tr key={row.id} className="tr" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
                        <td className="td font-medium text-[var(--text-primary)] w-[30%]">
                          {row.name}
                        </td>
                        <td className="td w-[50%]">
                          <span className="text-[var(--text-muted)] line-clamp-1">{row.description}</span>
                        </td>
                        <td className="td text-right">
                          <div className="flex items-center justify-end">
                            <button className="primary-btn shrink-0" title="Generate Report">
                              <Download size={14} />
                              <span>Generate</span>
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="td text-center py-10">
                        <div className="flex flex-col items-center justify-center">
                          <p className="text-[var(--text-muted)] text-[13px]">No reports found matching your search.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
           </div>
  
           {/* Pagination */}
           <div className="px-4 py-3 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--surface)]">
              <div className="text-[12px] text-[var(--text-muted)]">
                Showing <span className="font-bold text-[var(--text-secondary)]">{filteredReports.length > 0 ? 1 : 0}</span> to <span className="font-bold text-[var(--text-secondary)]">{filteredReports.length}</span> of <span className="font-bold text-[var(--text-secondary)]">{filteredReports.length}</span> entries
              </div>
           </div>
        </motion.div>
      </div>
    </div>
  );
}
