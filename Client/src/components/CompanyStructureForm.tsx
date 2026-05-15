import { useFormState } from '../hooks/useFormState';
import { FormModal } from './ui/FormModal';
import { FormField, inputClass } from './ui/FormField';

export function CompanyStructureForm({ onClose, initialData, onSave }: any) {
  const { formData, handleChange } = useFormState(
    { name: '', details: '', address: '', type: '', code: '', parent: '', manager: '' },
    initialData
  );

  return (
    <FormModal
      title={initialData ? 'Edit Company Structure' : 'Add Company Structure'}
      subtitle="Fill in the details for the organization unit."
      onClose={onClose}
      onSave={() => { onSave(formData); onClose(); }}
      saveLabel="Save Structure"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <FormField label="Name">
          <input type="text" name="name" value={formData.name} onChange={handleChange} className={inputClass} placeholder="e.g. Engineering" />
        </FormField>

        <FormField label="Code">
          <input type="text" name="code" value={formData.code} onChange={handleChange} className={inputClass} placeholder="e.g. ENG-01" />
        </FormField>

        <FormField label="Type of Company Structure">
          <select name="type" value={formData.type} onChange={handleChange} className={inputClass}>
            <option value="">Select Type</option>
            <option value="Company">Company</option>
            <option value="Branch">Branch</option>
            <option value="Department">Department</option>
            <option value="Unit">Unit</option>
            <option value="Team">Team</option>
          </select>
        </FormField>

        <FormField label="Parent Structure">
          <select name="parent" value={formData.parent} onChange={handleChange} className={inputClass}>
            <option value="">Select Parent</option>
            <option value="None">None (Top Level)</option>
            <option value="Headquarters">Headquarters</option>
            <option value="Engineering">Engineering</option>
            <option value="Human Resources">Human Resources</option>
          </select>
        </FormField>

        <FormField label="Manager">
          <select name="manager" value={formData.manager} onChange={handleChange} className={inputClass}>
            <option value="">Select Manager</option>
            <option value="UNION ADMIN">UNION ADMIN</option>
            <option value="SAMUEL BANDOH">SAMUEL BANDOH</option>
            <option value="SARAH JENKS">SARAH JENKS</option>
          </select>
        </FormField>

        <FormField label="Address" className="sm:col-span-2">
          <input type="text" name="address" value={formData.address} onChange={handleChange} className={inputClass} placeholder="Structure address" />
        </FormField>

        <FormField label="Details" className="sm:col-span-2">
          <textarea name="details" value={formData.details} onChange={handleChange} className={inputClass} placeholder="Additional details..." rows={3} />
        </FormField>
      </div>
    </FormModal>
  );
}
