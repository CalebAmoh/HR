import { useFormState } from '../hooks/useFormState';
import { FormModal } from './ui/FormModal';
import { FormField, inputClass } from './ui/FormField';

export function LeavePeriodForm({ onClose, onSave }: any) {
  const { formData, handleChange } = useFormState({ startDate: '', endDate: '' });

  return (
    <FormModal
      title="Add Leave Period"
      subtitle="Define a company-wide leave period."
      onClose={onClose}
      onSave={() => { onSave(formData); onClose(); }}
      maxWidth="md"
      scrollable={false}
    >
      <div className="flex flex-col gap-4">
        <FormField label="Start Date" required>
          <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} className={inputClass} />
        </FormField>

        <FormField label="End Date" required>
          <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} className={inputClass} />
        </FormField>
      </div>
    </FormModal>
  );
}
