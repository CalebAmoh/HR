import { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useFormState } from '../hooks/useFormState';
import { FormModal } from './ui/FormModal';
import { FormField, inputClass } from './ui/FormField';
import { SearchSelect, MultiSearchSelect } from './ui/SearchSelect';

export function InterviewForm({ onClose, initialData, onSave, candidates = [], jobs = [], interviews = [], employees = [] }: any) {
  const { formData, handleChange } = useFormState(
    {
      job: '',
      candidate: '',
      level: '',
      scheduled: '',
      location: '',
      notes: '',
      interviewers: '',
      status: 'Scheduled',
      outcome: '',
      feedback: '',
    },
    initialData
      ? {
          ...initialData,
          job:       initialData.job       ? String(initialData.job)       : '',
          candidate: initialData.candidate ? String(initialData.candidate) : '',
          scheduled: initialData.scheduled ? initialData.scheduled.slice(0, 16) : '',
        }
      : undefined
  );

  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);

  // Interviewers stored as comma-separated employee names; split for multi-select
  const [selectedInterviewers, setSelectedInterviewers] = useState<string[]>(() => {
    if (!initialData?.interviewers) return [];
    return initialData.interviewers.split(',').map((s: string) => s.trim()).filter(Boolean);
  });

  // Set of candidate IDs that already have at least one interview
  const interviewedIds = useMemo(
    () => new Set(interviews.map((iv: any) => String(iv.candidate))),
    [interviews]
  );

  // Candidates eligible for the selected job (applied for it + no interview yet)
  const availableCandidates = useMemo(() => {
    if (!formData.job) return [];
    return candidates.filter(
      (c: any) => String(c.jobId) === formData.job && !interviewedIds.has(String(c.id))
    );
  }, [formData.job, candidates, interviewedIds]);

  // Reset candidate selection when job changes
  const prevJob = useRef(formData.job);
  useEffect(() => {
    if (prevJob.current !== formData.job) {
      setSelectedCandidates([]);
      prevJob.current = formData.job;
    }
  }, [formData.job]);

  const [slots, setSlots] = useState<string[]>(() => {
    try { return JSON.parse(initialData?.schedule_options || '[]'); } catch { return []; }
  });

  const addSlot    = () => setSlots(prev => [...prev, '']);
  const removeSlot = (i: number) => setSlots(prev => prev.filter((_, idx) => idx !== i));
  const updateSlot = (i: number, val: string) =>
    setSlots(prev => prev.map((s, idx) => (idx === i ? val : s)));

  const employeeOptions = useMemo(
    () => employees.map((e: any) => ({ id: e.name, label: e.name })),
    [employees]
  );

  const handleSave = () => {
    const validSlots = slots.filter(Boolean);
    const base = {
      ...formData,
      schedule_options: validSlots.length ? JSON.stringify(validSlots) : null,
      interviewers: selectedInterviewers.join(', '),
    };
    if (!initialData && selectedCandidates.length > 0) {
      onSave({ ...base, candidates: selectedCandidates });
    } else {
      onSave(base);
    }
  };

  return (
    <FormModal
      title={initialData ? 'Edit Interview' : 'Schedule Interview'}
      subtitle="Capture the interview details."
      onClose={onClose}
      onSave={handleSave}
      maxWidth="2xl"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6">

        {initialData ? (
          /* ── Edit mode: simple selects, no filtering ── */
          <>
            <FormField label="Job Posting">
              <select name="job" value={formData.job} onChange={handleChange} className={inputClass}>
                <option value="">— None —</option>
                {jobs.map((j: any) => (
                  <option key={j.id} value={String(j.id)}>{j.title}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Candidate" required>
              <select name="candidate" value={formData.candidate} onChange={handleChange} className={inputClass}>
                <option value="">— Select —</option>
                {candidates.map((c: any) => (
                  <option key={c.id} value={String(c.id)}>{c.first_name} {c.last_name}</option>
                ))}
              </select>
            </FormField>
          </>
        ) : (
          /* ── New mode: job first, then filtered candidates ── */
          <>
            <div className="sm:col-span-2">
              <FormField label="Job Posting" required>
                <SearchSelect
                  value={formData.job}
                  onChange={v => handleChange({ target: { name: 'job', value: v } } as any)}
                  options={jobs.map((j: any) => ({ id: String(j.id), label: j.title }))}
                  placeholder="Select a job posting…"
                />
              </FormField>
            </div>

            <div className="sm:col-span-2">
              <FormField label="Candidates" required hint="Select one or more — an interview is created for each.">
                {!formData.job ? (
                  <div className={`${inputClass} text-[var(--text-muted)] opacity-60 cursor-not-allowed select-none`}>
                    Select a job posting first…
                  </div>
                ) : availableCandidates.length === 0 ? (
                  <div className={`${inputClass} text-[var(--text-muted)] opacity-60 select-none`}>
                    No eligible candidates for this job posting.
                  </div>
                ) : (
                  <MultiSearchSelect
                    value={selectedCandidates}
                    onChange={setSelectedCandidates}
                    options={availableCandidates.map((c: any) => ({
                      id: String(c.id),
                      label: `${c.first_name} ${c.last_name}`,
                    }))}
                    placeholder="Select candidates…"
                  />
                )}
              </FormField>
            </div>
          </>
        )}

        <FormField label="Interview Level / Round">
          <input type="text" name="level" value={formData.level} onChange={handleChange} className={inputClass} placeholder="e.g. Round 1, Final" />
        </FormField>

        <FormField label="Status">
          <select name="status" value={formData.status} onChange={handleChange} className={inputClass}>
            <option value="Scheduled">Scheduled</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
            <option value="No Show">No Show</option>
          </select>
        </FormField>

        <FormField label="Scheduled Date & Time" required>
          <input type="datetime-local" name="scheduled" value={formData.scheduled} onChange={handleChange} className={inputClass} />
        </FormField>

        <FormField label="Location / Video Link">
          <input type="text" name="location" value={formData.location} onChange={handleChange} className={inputClass} placeholder="Room B or https://meet.example.com/..." />
        </FormField>

        <FormField label="Interviewers">
          <MultiSearchSelect
            value={selectedInterviewers}
            onChange={setSelectedInterviewers}
            options={employeeOptions}
            placeholder="Select interviewers…"
          />
        </FormField>

        {formData.status === 'Completed' && (
          <FormField label="Outcome">
            <select name="outcome" value={formData.outcome} onChange={handleChange} className={inputClass}>
              <option value="">— Select —</option>
              <option value="Passed">Passed</option>
              <option value="Failed">Failed</option>
              <option value="Pending">Pending Decision</option>
            </select>
          </FormField>
        )}

        <div className="sm:col-span-2">
          <FormField label="Notes">
            <textarea name="notes" value={formData.notes} onChange={handleChange} rows={2} className={inputClass} />
          </FormField>
        </div>

        {formData.status === 'Completed' && (
          <div className="sm:col-span-2">
            <FormField label="Feedback">
              <textarea name="feedback" value={formData.feedback} onChange={handleChange} rows={3} className={inputClass} />
            </FormField>
          </div>
        )}

        {/* Self-scheduling slots */}
        <div className="sm:col-span-2">
          <div className="rounded-[10px] border border-[var(--border)] p-4 bg-[var(--surface-hover)]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[13px] font-semibold text-[var(--text-primary)]">Available Slots for Self-Scheduling</p>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Candidate will pick one slot via a scheduling link.</p>
              </div>
              <button
                type="button"
                onClick={addSlot}
                className="flex items-center gap-1 text-[12px] font-semibold text-[var(--accent)] hover:underline"
              >
                <Plus size={13} /> Add Slot
              </button>
            </div>

            {slots.length === 0 ? (
              <p className="text-[12px] text-[var(--text-muted)] italic">No slots added. Click "Add Slot" to define available times.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {slots.map((slot, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="datetime-local"
                      value={slot}
                      onChange={e => updateSlot(i, e.target.value)}
                      className={`${inputClass} flex-1`}
                    />
                    <button
                      type="button"
                      onClick={() => removeSlot(i)}
                      className="text-[var(--text-muted)] hover:text-red-500 transition-colors p-1"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </FormModal>
  );
}
