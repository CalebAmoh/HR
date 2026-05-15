import { useFormState } from '../hooks/useFormState';
import { FormModal } from './ui/FormModal';
import { FormField, inputClass } from './ui/FormField';

const YES_NO = (
  <>
    <option value="Yes">Yes</option>
    <option value="No">No</option>
  </>
);

export function LeaveTypeForm({ onClose, initialData, onSave }: any) {
  const { formData, handleChange, setFormData } = useFormState(
    {
      name: '',
      gl: '',
      leavesPerPeriod: '',
      adminCanAssign: 'Yes',
      adminCanApply: 'Yes',
      applyBeyondBalance: 'No',
      leaveAccrueEnabled: 'No',
      leaveCarriedForward: 'No',
      percentageCarriedForward: '100',
      maxCarriedForwardAmount: '0',
      carriedForwardAvailability: '1 Month',
      proportionateOnJoined: 'Yes',
      sendNotificationEmails: 'Yes',
      leaveGroup: '',
      leaveColor: '#3b82f6',
    },
    initialData
  );

  return (
    <FormModal
      title={initialData ? 'Edit Leave Type' : 'Add Leave Type'}
      subtitle="Configure the settings for this leave type."
      onClose={onClose}
      onSave={() => { onSave(formData); onClose(); }}
      maxWidth="3xl"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6">
        <FormField label="Leave Name" required>
          <input type="text" name="name" value={formData.name} onChange={handleChange} className={inputClass} />
        </FormField>

        <FormField label="Leave GL">
          <input type="text" name="gl" value={formData.gl} onChange={handleChange} className={inputClass} />
        </FormField>

        <FormField label="Leaves Per Leave Period" required>
          <input type="number" name="leavesPerPeriod" value={formData.leavesPerPeriod} onChange={handleChange} className={inputClass} />
        </FormField>

        <FormField label="Admin can assign leave to employees" required>
          <select name="adminCanAssign" value={formData.adminCanAssign} onChange={handleChange} className={inputClass}>{YES_NO}</select>
        </FormField>

        <FormField label="Employees can apply for this leave type" required>
          <select name="adminCanApply" value={formData.adminCanApply} onChange={handleChange} className={inputClass}>{YES_NO}</select>
        </FormField>

        <FormField label="Employees can apply beyond the current leave balance" required>
          <select name="applyBeyondBalance" value={formData.applyBeyondBalance} onChange={handleChange} className={inputClass}>{YES_NO}</select>
        </FormField>

        <FormField label="Leave Accrue Enabled" required>
          <select name="leaveAccrueEnabled" value={formData.leaveAccrueEnabled} onChange={handleChange} className={inputClass}>{YES_NO}</select>
        </FormField>

        <FormField label="Leave Carried Forward" required>
          <select name="leaveCarriedForward" value={formData.leaveCarriedForward} onChange={handleChange} className={inputClass}>{YES_NO}</select>
        </FormField>

        <FormField label="Percentage of Leave Carried Forward" required>
          <input type="number" name="percentageCarriedForward" value={formData.percentageCarriedForward} onChange={handleChange} className={inputClass} />
        </FormField>

        <FormField label="Maximum Carried Forward Amount" required>
          <input type="number" name="maxCarriedForwardAmount" value={formData.maxCarriedForwardAmount} onChange={handleChange} className={inputClass} />
        </FormField>

        <FormField label="Carried Forward Leave Availability Period" required>
          <select name="carriedForwardAvailability" value={formData.carriedForwardAvailability} onChange={handleChange} className={inputClass}>
            <option value="1 Month">1 Month</option>
            <option value="3 Months">3 Months</option>
            <option value="6 Months">6 Months</option>
            <option value="1 Year">1 Year</option>
          </select>
        </FormField>

        <FormField label="Proportionate leaves on Joined Date" required>
          <select name="proportionateOnJoined" value={formData.proportionateOnJoined} onChange={handleChange} className={inputClass}>{YES_NO}</select>
        </FormField>

        <FormField label="Send Notification Emails" required>
          <select name="sendNotificationEmails" value={formData.sendNotificationEmails} onChange={handleChange} className={inputClass}>{YES_NO}</select>
        </FormField>

        <FormField label="Leave Group">
          <select name="leaveGroup" value={formData.leaveGroup} onChange={handleChange} className={inputClass}>
            <option value="">Select</option>
            <option value="Group A">Group A</option>
            <option value="Group B">Group B</option>
          </select>
        </FormField>

        <FormField label="Leave Color" required>
          <div className="flex gap-2">
            <input type="color" name="leaveColor" value={formData.leaveColor} onChange={handleChange} className="w-12 h-11 p-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg cursor-pointer" />
            <input type="text" value={formData.leaveColor} onChange={(e) => setFormData((prev) => ({ ...prev, leaveColor: e.target.value }))} className={inputClass} />
          </div>
        </FormField>
      </div>
    </FormModal>
  );
}
