import { useState, useMemo } from 'react';
import { createCodeList } from '../../lib/codeLists';
import { Search, FileEdit, Trash2, Filter, Plus, Download, X, Building2, Tag, List, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ConfirmAlert } from './ConfirmAlert';

/* ─────────────────────────────────────────────────────────────────────────────
   INITIAL DATA
───────────────────────────────────────────────────────────────────────────── */
const initialAppSetup = {
  id: 1,
  companyName: 'SISL Global Solutions',
  logoName: 'sisl_logo.png',
};

const initialCodes = [
  { id: 1, code: 'DEPT',      description: 'Department Categories' },
  { id: 2, code: 'JOB_TITLE', description: 'Job Title Classifications' },
  { id: 3, code: 'EMP_TYPE',  description: 'Employment Type Categories' },
  { id: 4, code: 'LEAVE_TYPE',description: 'Leave Type Definitions' },
];

const initialCodeValues = [
  { id: 1, codeId: 1, value: 'ENGINEERING',      description: 'Engineering Department' },
  { id: 2, codeId: 1, value: 'HUMAN_RESOURCES',  description: 'Human Resources Department' },
  { id: 3, codeId: 1, value: 'FINANCE',           description: 'Finance Department' },
  { id: 4, codeId: 2, value: 'SOFTWARE_ENG',      description: 'Software Engineer' },
  { id: 5, codeId: 2, value: 'HR_MANAGER',        description: 'HR Manager' },
  { id: 6, codeId: 3, value: 'PERMANENT',         description: 'Permanent Employment' },
  { id: 7, codeId: 3, value: 'CONTRACT',          description: 'Contract Employment' },
  { id: 8, codeId: 4, value: 'ANNUAL',            description: 'Annual Leave' },
  { id: 9, codeId: 4, value: 'SICK',              description: 'Sick Leave' },
];

/* ─────────────────────────────────────────────────────────────────────────────
   SHARED MODAL — mirrors the modal pattern used across the app
───────────────────────────────────────────────────────────────────────────── */
function Modal({ title, onClose, onSave, saveLabel = 'Save', children }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-[#111827]/45 backdrop-blur-[4px]"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="bg-[var(--surface)] border border-[var(--border)] rounded-[16px] w-full max-w-[480px] relative z-10 shadow-[0_24px_80px_rgba(0,0,0,0.18)] max-h-[90vh] flex flex-col"
      >
        <div className="px-6 py-5 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="syne m-0 text-[16px] font-extrabold text-[var(--text-primary)]">{title}</h3>
          <button
            onClick={onClose}
            className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg w-[30px] h-[30px] flex items-center justify-center cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors"
          >
            <X size={15} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-[18px]">
          {children}
        </div>
        <div className="px-6 py-4 border-t border-[var(--border)] flex justify-end gap-2.5">
          <button className="secondary-btn" onClick={onClose}>Cancel</button>
          <button className="primary-btn" onClick={onSave}>{saveLabel}</button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────────────────────── */
export function System() {
  /* ── Tab state ────────────────────────────────────────────────────────── */
  const [activeTab, setActiveTab]       = useState('App Setup');
  const tabs                            = ['App Setup', 'Parameter Creation'];

  /* ── Parameter sub-tab (dropdown) ────────────────────────────────────── */
  const [subTab, setSubTab]             = useState('Code Creation');
  const [isSubDropOpen, setIsSubDropOpen] = useState(false);
  const subTabs                         = ['Code Creation', 'Code Values'];

  /* ── Data ─────────────────────────────────────────────────────────────── */
  const [appSetup, setAppSetup]         = useState(initialAppSetup);
  const [codes, setCodes]               = useState(initialCodes);
  const [codeValues, setCodeValues]     = useState(initialCodeValues);

  /* ── Search / filter ─────────────────────────────────────────────────── */
  const [searchQuery, setSearchQuery]   = useState('');
  const [showFilters, setShowFilters]   = useState(false);
  const [codeFilter, setCodeFilter]     = useState('');   // code values filter only

  /* ── Form / modal state ───────────────────────────────────────────────── */
  const [isFormOpen, setIsFormOpen]     = useState(false);
  const [isAlertOpen, setIsAlertOpen]   = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  /* ── App Setup form state ─────────────────────────────────────────────── */
  const [setupForm, setSetupForm]       = useState({ companyName: '', logoName: '' });

  /* ── Code Creation form state ─────────────────────────────────────────── */
  const [codeForm, setCodeForm]         = useState({ code: '', description: '' });

  /* ── Code Values form state ───────────────────────────────────────────── */
  const [valForm, setValForm]           = useState({ codeId: '', value: '', description: '' });

  /* ─────────────────────────────────────────────────────────────────────────
     DERIVED / FILTERED DATA
  ───────────────────────────────────────────────────────────────────────── */
  const codeMap = useMemo(
    () => Object.fromEntries(codes.map((c) => [c.id, c.code])),
    [codes]
  );

  const filteredCodes = useMemo(() =>
    codes.filter((c) =>
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase())
    ), [codes, searchQuery]);

  const filteredCodeValues = useMemo(() =>
    codeValues.filter((v) => {
      const matchesSearch =
        v.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (codeMap[v.codeId] ?? '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = codeFilter ? v.codeId === Number(codeFilter) : true;
      return matchesSearch && matchesFilter;
    }), [codeValues, searchQuery, codeFilter, codeMap]);

  /* ─────────────────────────────────────────────────────────────────────────
     HANDLERS — App Setup
  ───────────────────────────────────────────────────────────────────────── */
  const openEditSetup = () => {
    setSetupForm({ companyName: appSetup.companyName, logoName: appSetup.logoName });
    setIsFormOpen(true);
  };

  const handleSaveSetup = () => {
    setAppSetup((prev) => ({ ...prev, ...setupForm }));
    setIsFormOpen(false);
  };

  /* ─────────────────────────────────────────────────────────────────────────
     HANDLERS — Code Creation
  ───────────────────────────────────────────────────────────────────────── */
  const handleAddCode = () => {
    setSelectedItem(null);
    setCodeForm({ code: '', description: '' });
    setIsFormOpen(true);
  };

  const handleEditCode = (item) => {
    setSelectedItem(item);
    setCodeForm({ code: item.code, description: item.description });
    setIsFormOpen(true);
  };

  const handleDeleteCodeClick = (item) => {
    setSelectedItem(item);
    setIsAlertOpen(true);
  };

  const handleSaveCode = async () => {
    if (!codeForm.code.trim()) return;
    if (selectedItem) {
      setCodes(codes.map((c) => (c.id === selectedItem.id ? { ...c, ...codeForm } : c)));
      setIsFormOpen(false);
    } else {
      try {
        // Call backend API to create code list
        const res = await createCodeList({ code: codeForm.code, description: codeForm.description });
        // Optionally, use the returned data (e.g., id from backend)
        const newCode = res.data?.data || { id: Date.now(), ...codeForm };
        setCodes([...codes, newCode]);
      } catch (err) {
        // Optionally handle error (e.g., show notification)
        // For now, fallback to local add
        setCodes([...codes, { id: Date.now(), ...codeForm }]);
      }
      setIsFormOpen(false);
    }
  };

  const handleConfirmDeleteCode = () => {
    if (selectedItem) {
      setCodes(codes.filter((c) => c.id !== selectedItem.id));
      setCodeValues(codeValues.filter((v) => v.codeId !== selectedItem.id));
    }
    setIsAlertOpen(false);
    setSelectedItem(null);
  };

  /* ─────────────────────────────────────────────────────────────────────────
     HANDLERS — Code Values
  ───────────────────────────────────────────────────────────────────────── */
  const handleAddValue = () => {
    setSelectedItem(null);
    setValForm({ codeId: codes[0]?.id ?? '', value: '', description: '' });
    setIsFormOpen(true);
  };

  const handleEditValue = (item) => {
    setSelectedItem(item);
    setValForm({ codeId: item.codeId, value: item.value, description: item.description });
    setIsFormOpen(true);
  };

  const handleDeleteValueClick = (item) => {
    setSelectedItem(item);
    setIsAlertOpen(true);
  };

  const handleSaveValue = () => {
    if (!valForm.value.trim() || !valForm.codeId) return;
    const payload = { ...valForm, codeId: Number(valForm.codeId) };
    if (selectedItem) {
      setCodeValues(codeValues.map((v) => (v.id === selectedItem.id ? { ...v, ...payload } : v)));
    } else {
      setCodeValues([...codeValues, { id: Date.now(), ...payload }]);
    }
    setIsFormOpen(false);
  };

  const handleConfirmDeleteValue = () => {
    if (selectedItem) {
      setCodeValues(codeValues.filter((v) => v.id !== selectedItem.id));
    }
    setIsAlertOpen(false);
    setSelectedItem(null);
  };

  /* ─────────────────────────────────────────────────────────────────────────
     TAB SWITCH — reset shared UI state
  ───────────────────────────────────────────────────────────────────────── */
  const switchTab = (tab) => {
    setActiveTab(tab);
    setSearchQuery('');
    setCodeFilter('');
    setShowFilters(false);
    setIsFormOpen(false);
    setIsSubDropOpen(false);
  };

  const switchSubTab = (tab) => {
    setSubTab(tab);
    setSearchQuery('');
    setCodeFilter('');
    setShowFilters(false);
    setIsFormOpen(false);
    setIsSubDropOpen(false);
  };

  /* ─────────────────────────────────────────────────────────────────────────
     DERIVED DISPLAY STATE
  ───────────────────────────────────────────────────────────────────────── */
  // Which save handler, confirm-delete, and modal title to use based on
  // active tab + sub-tab — keeps the JSX clean
  const currentSave = activeTab === 'App Setup'
    ? handleSaveSetup
    : subTab === 'Code Creation'
      ? handleSaveCode
      : handleSaveValue;

  const currentConfirmDelete = subTab === 'Code Creation'
    ? handleConfirmDeleteCode
    : handleConfirmDeleteValue;

  const modalTitle = activeTab === 'App Setup'
    ? 'Edit App Setup'
    : subTab === 'Code Creation'
      ? (selectedItem ? 'Edit Code' : 'Add New Code')
      : (selectedItem ? 'Edit Code Value' : 'Add Code Value');

  const deleteTitle   = subTab === 'Code Creation' ? 'Delete Code' : 'Delete Code Value';
  const deleteMessage = subTab === 'Code Creation'
    ? 'Deleting this code will also remove all its associated values. This cannot be undone.'
    : 'Are you sure you want to delete this code value? This cannot be undone.';

  const hasActiveFilter = codeFilter !== '';

  /* ─────────────────────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────────────────────── */
  return (
    <div className="p-4 sm:p-6 md:p-6 w-full max-w-[1400px] mx-auto overflow-x-hidden flex flex-col h-full relative">

      {/* Page header */}
      <div className="mb-6">
        <h2 className="text-lg sm:text-[22px] font-bold syne text-[var(--text-primary)] tracking-tight">
          System Administration
        </h2>
        <p className="text-xs sm:text-[13px] text-[var(--text-muted)] mt-1 font-medium">
          Configure application settings and manage parameter codes.
        </p>
      </div>

      {/* Top-level tabs */}
      <div className="flex flex-wrap items-center gap-2 mt-2 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => switchTab(tab)}
            className={`tab-btn ${tab === activeTab ? 'active' : ''}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main card */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[16px] overflow-hidden flex flex-col flex-1 max-h-min drop-shadow-sm">

        {/* ── Toolbar area ─────────────────────────────────────────────────── */}
        <div className="flex flex-col border-b border-[var(--border)]">
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row lg:items-center justify-between gap-4">

            {/* Left side — action buttons */}
            <div className="grid grid-cols-3 sm:flex items-center gap-2 w-full sm:w-auto">

              {/* App Setup — Edit only (no Add, no Filter, no Download) */}
              {activeTab === 'App Setup' && (
                <button onClick={openEditSetup} className="primary-btn shrink-0">
                  <FileEdit className="w-[14px] h-[14px]" />
                  <span className="hidden sm:inline">Edit Setup</span>
                  <span className="sm:hidden">Edit</span>
                </button>
              )}

              {/* Parameter Creation — Add + Filter + Download */}
              {activeTab === 'Parameter Creation' && (
                <>
                  <button
                    onClick={subTab === 'Code Creation' ? handleAddCode : handleAddValue}
                    className="primary-btn shrink-0"
                  >
                    <span className="hidden sm:inline">Add New</span>
                    <span className="sm:hidden">Add</span>
                    <Plus className="w-[14px] h-[14px]" />
                  </button>

                  {/* Filter button — only visible on Code Values */}
                  {subTab === 'Code Values' && (
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`secondary-btn shrink-0 ${showFilters ? 'ring-2 ring-[var(--accent)] border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-dim)]' : ''}`}
                    >
                      Filter
                      <Filter className="w-[14px] h-[14px] fill-current opacity-80" />
                    </button>
                  )}

                  <button className="secondary-btn shrink-0">
                    <span className="hidden sm:inline">Download (Excel)</span>
                    <span className="sm:hidden">Export</span>
                    <Download className="w-[14px] h-[14px]" />
                  </button>

                  {/* Sub-tab dropdown — lives in the toolbar row */}
                  <div className="relative sm:ml-2">
                    <button
                      onClick={() => setIsSubDropOpen(!isSubDropOpen)}
                      className="secondary-btn gap-2 shrink-0"
                    >
                      {subTab === 'Code Creation' ? <Tag size={13} /> : <List size={13} />}
                      <span className="hidden sm:inline">{subTab}</span>
                      <ChevronDown
                        size={13}
                        style={{
                          transition: 'transform .2s ease',
                          transform: isSubDropOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        }}
                      />
                    </button>

                    <AnimatePresence>
                      {isSubDropOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 6, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 6, scale: 0.97 }}
                          transition={{ duration: 0.15 }}
                          className="absolute top-[calc(100%+6px)] left-0 bg-[var(--surface)] border border-[var(--border)] rounded-[12px] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.16)] z-50 min-w-[180px]"
                        >
                          {subTabs.map((t) => (
                            <button
                              key={t}
                              onClick={() => switchSubTab(t)}
                              className="w-full text-left px-4 py-2.5 text-[13px] font-medium flex items-center gap-2.5 transition-colors hover:bg-[var(--surface-hover)]"
                              style={{
                                background: t === subTab ? 'var(--accent-dim)' : undefined,
                                color: t === subTab ? 'var(--accent)' : 'var(--text-secondary)',
                              }}
                            >
                              {t === 'Code Creation' ? <Tag size={13} /> : <List size={13} />}
                              {t}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              )}
            </div>

            {/* Right side — search (hidden on App Setup) */}
            {activeTab === 'Parameter Creation' && (
              <div className="search-wrap w-full sm:w-auto sm:min-w-[240px]">
                <Search size={14} />
                <input
                  type="text"
                  placeholder={subTab === 'Code Creation' ? 'Search codes...' : 'Search values...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Filter panel — Code Values only */}
          {showFilters && activeTab === 'Parameter Creation' && subTab === 'Code Values' && (
            <div className="px-5 py-3 bg-[var(--surface-hover)] border-t border-[var(--border)] flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide syne">
                  Code:
                </label>
                <select
                  value={codeFilter}
                  onChange={(e) => setCodeFilter(e.target.value)}
                  className="w-[180px] py-1 text-xs px-2 border rounded"
                >
                  <option value="">All Codes</option>
                  {codes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.description}
                    </option>
                  ))}
                </select>
              </div>
              {hasActiveFilter && (
                <button
                  onClick={() => setCodeFilter('')}
                  className="text-[12px] font-bold text-[var(--accent)] hover:text-blue-800 flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Clear Filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Table area ───────────────────────────────────────────────────── */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {/* App Setup columns */}
                {activeTab === 'App Setup' && (
                  <>
                    <th scope="col" className="th">#</th>
                    <th scope="col" className="th">Company Name</th>
                    <th scope="col" className="th">Logo File</th>
                  </>
                )}

                {/* Code Creation columns */}
                {activeTab === 'Parameter Creation' && subTab === 'Code Creation' && (
                  <>
                    <th scope="col" className="th">#</th>
                    <th scope="col" className="th">Code</th>
                    <th scope="col" className="th">Description</th>
                  </>
                )}

                {/* Code Values columns */}
                {activeTab === 'Parameter Creation' && subTab === 'Code Values' && (
                  <>
                    <th scope="col" className="th">#</th>
                    <th scope="col" className="th">Code</th>
                    <th scope="col" className="th">Value</th>
                    <th scope="col" className="th">Description</th>
                  </>
                )}

                <th scope="col" className="th text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {/* ── App Setup — always exactly one row ─────────────────────── */}
              {activeTab === 'App Setup' && (
                <motion.tr
                  className="tr"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <td className="td text-[var(--text-muted)] text-[12px]">1</td>
                  <td className="td font-medium text-[var(--text-primary)]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-[32px] h-[32px] rounded-[9px] bg-[var(--accent-dim)] border border-[var(--border)] flex items-center justify-center text-[var(--accent)] shrink-0">
                        <Building2 size={15} strokeWidth={1.8} />
                      </div>
                      {appSetup.companyName}
                    </div>
                  </td>
                  <td className="td">
                    <span className="font-mono text-[11px] text-[var(--text-muted)] bg-[var(--bg)] px-2 py-0.5 rounded border border-[var(--border)]">
                      {appSetup.logoName}
                    </span>
                  </td>
                  <td className="td">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={openEditSetup}
                        className="action-btn text-[var(--warning)]"
                        title="Edit"
                      >
                        <FileEdit size={14} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              )}

              {/* ── Code Creation rows ─────────────────────────────────────── */}
              {activeTab === 'Parameter Creation' && subTab === 'Code Creation' && (
                filteredCodes.length > 0 ? (
                  filteredCodes.map((row, i) => (
                    <motion.tr
                      key={row.id} className="tr"
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.06 }}
                    >
                      <td className="td text-[var(--text-muted)] text-[12px]">{i + 1}</td>
                      <td className="td font-medium text-[var(--text-primary)]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-[28px] h-[28px] rounded-[8px] bg-[var(--accent-dim)] border border-[var(--border)] flex items-center justify-center text-[var(--accent)] shrink-0">
                            <Tag size={12} strokeWidth={1.8} />
                          </div>
                          <span className="font-mono text-[12px] font-bold text-[var(--text-primary)] bg-[var(--bg)] px-2 py-0.5 rounded border border-[var(--border)]">
                            {row.code}
                          </span>
                        </div>
                      </td>
                      <td className="td">{row.description}</td>
                      <td className="td">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleEditCode(row)} className="action-btn text-[var(--warning)]" title="Edit">
                            <FileEdit size={14} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="td text-center py-10 text-[var(--text-muted)]">
                      No codes found.
                    </td>
                  </tr>
                )
              )}

              {/* ── Code Values rows ───────────────────────────────────────── */}
              {activeTab === 'Parameter Creation' && subTab === 'Code Values' && (
                filteredCodeValues.length > 0 ? (
                  filteredCodeValues.map((row, i) => (
                    <motion.tr
                      key={row.id} className="tr"
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.06 }}
                    >
                      <td className="td text-[var(--text-muted)] text-[12px]">{i + 1}</td>
                      <td className="td">
                        <span className="font-mono text-[11px] font-bold text-[var(--accent)] bg-[var(--accent-dim)] px-2 py-0.5 rounded border border-[var(--border)]">
                          {codeMap[row.codeId] ?? '—'}
                        </span>
                      </td>
                      <td className="td font-medium text-[var(--text-primary)]">
                        <span className="font-mono text-[12px] bg-[var(--bg)] px-2 py-0.5 rounded border border-[var(--border)]">
                          {row.value}
                        </span>
                      </td>
                      <td className="td">{row.description}</td>
                      <td className="td">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleEditValue(row)} className="action-btn text-[var(--warning)]" title="Edit">
                            <FileEdit size={14} />
                          </button>
                          <button onClick={() => handleDeleteValueClick(row)} className="action-btn text-[var(--danger)]" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="td text-center py-10 text-[var(--text-muted)]">
                      No code values found.
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination footer ────────────────────────────────────────────── */}
        <div className="px-4 py-3 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--surface)]">
          <div className="text-[12px] text-[var(--text-muted)]">
            {activeTab === 'App Setup' && (
              <>
                Showing{' '}
                <span className="font-bold text-[var(--text-secondary)]">1</span> to{' '}
                <span className="font-bold text-[var(--text-secondary)]">1</span> of{' '}
                <span className="font-bold text-[var(--text-secondary)]">1</span> entries
              </>
            )}
            {activeTab === 'Parameter Creation' && subTab === 'Code Creation' && (
              <>
                Showing{' '}
                <span className="font-bold text-[var(--text-secondary)]">
                  {filteredCodes.length > 0 ? 1 : 0}
                </span> to{' '}
                <span className="font-bold text-[var(--text-secondary)]">{filteredCodes.length}</span> of{' '}
                <span className="font-bold text-[var(--text-secondary)]">{codes.length}</span> entries
              </>
            )}
            {activeTab === 'Parameter Creation' && subTab === 'Code Values' && (
              <>
                Showing{' '}
                <span className="font-bold text-[var(--text-secondary)]">
                  {filteredCodeValues.length > 0 ? 1 : 0}
                </span> to{' '}
                <span className="font-bold text-[var(--text-secondary)]">{filteredCodeValues.length}</span> of{' '}
                <span className="font-bold text-[var(--text-secondary)]">{codeValues.length}</span> entries
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── MODALS ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {/* App Setup edit modal */}
        {isFormOpen && activeTab === 'App Setup' && (
          <Modal title={modalTitle} onClose={() => setIsFormOpen(false)} onSave={currentSave}>
            <div>
              <label className="label">Company Name</label>
              <input
                type="text"
                value={setupForm.companyName}
                onChange={(e) => setSetupForm({ ...setupForm, companyName: e.target.value })}
                placeholder="Enter company name"
              />
            </div>
            <div>
              <label className="label">Company Logo</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setSetupForm({ ...setupForm, logoName: e.target.files?.[0]?.name ?? setupForm.logoName })
                }
              />
              {setupForm.logoName && (
                <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
                  Current file:{' '}
                  <span className="font-mono">{setupForm.logoName}</span>
                </p>
              )}
            </div>
          </Modal>
        )}

        {/* Code Creation form modal */}
        {isFormOpen && activeTab === 'Parameter Creation' && subTab === 'Code Creation' && (
          <Modal title={modalTitle} onClose={() => setIsFormOpen(false)} onSave={currentSave}>
            <div>
              <label className="label">Code</label>
              {selectedItem ? (
                /* Editing — code is locked */
                <div className="flex items-center gap-2 h-[38px] px-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface-hover)] cursor-not-allowed">
                  <Tag size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span className="font-mono text-[13px] font-bold" style={{ color: 'var(--text-muted)' }}>
                    {codeForm.code}
                  </span>
                  <span className="ml-auto text-[10px] font-semibold uppercase tracking-[.06em]" style={{ color: 'var(--text-muted)' }}>
                    locked
                  </span>
                </div>
              ) : (
                /* Adding new — code is editable */
                <input
                  type="text"
                  value={codeForm.code}
                  onChange={(e) => setCodeForm({ ...codeForm, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. DEPT"
                  className="font-mono"
                />
              )}
            </div>
            <div>
              <label className="label">Description</label>
              <input
                type="text"
                value={codeForm.description}
                onChange={(e) => setCodeForm({ ...codeForm, description: e.target.value })}
                placeholder="Enter a description"
              />
            </div>
          </Modal>
        )}

        {/* Code Values form modal */}
        {isFormOpen && activeTab === 'Parameter Creation' && subTab === 'Code Values' && (
          <Modal title={modalTitle} onClose={() => setIsFormOpen(false)} onSave={currentSave}>
            <div>
              <label className="label">Code</label>
              <select
                value={valForm.codeId}
                onChange={(e) => setValForm({ ...valForm, codeId: e.target.value })}
              >
                <option value="">Select a code</option>
                {codes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.description}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Value</label>
              <input
                type="text"
                value={valForm.value}
                onChange={(e) => setValForm({ ...valForm, value: e.target.value.toUpperCase() })}
                placeholder="e.g. ENGINEERING"
                className="font-mono"
              />
            </div>
            <div>
              <label className="label">Description</label>
              <input
                type="text"
                value={valForm.description}
                onChange={(e) => setValForm({ ...valForm, description: e.target.value })}
                placeholder="Enter a description"
              />
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Confirm delete alert */}
      <ConfirmAlert
        isOpen={isAlertOpen}
        title={deleteTitle}
        message={deleteMessage}
        confirmText="Yes, Delete"
        onConfirm={currentConfirmDelete}
        onCancel={() => { setIsAlertOpen(false); setSelectedItem(null); }}
        variant="danger"
      />
    </div>
  );
}