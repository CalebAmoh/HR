import { useFormState } from '../hooks/useFormState';
import { FormModal } from './ui/FormModal';
import { FormField, inputClass } from './ui/FormField';
import { FileUpload } from './ui/FileUpload';
import { MultiSelect } from './MultiSelect';

export function CompanyDocumentForm({ onClose, initialData, onSave }: any) {
  const { formData, handleChange, setFormData } = useFormState(
    {
      name: '',
      details: '',
      departments: [] as string[],
      employees: [] as string[],
      attachment: null as File | null,
    },
    initialData
      ? { ...initialData, departments: initialData.departments ?? [], employees: initialData.employees ?? [] }
      : null
  );

  return (
    <FormModal
      title={initialData ? 'Edit Company Document' : 'Add Company Document'}
      subtitle="Fill in the details and attach the document."
      onClose={onClose}
      onSave={() => { onSave(formData); onClose(); }}
      saveLabel="Save Document"
    >
      <div className="grid grid-cols-1 gap-5">
        <FormField label="Name">
          <input type="text" name="name" value={formData.name} onChange={handleChange} className={inputClass} placeholder="e.g. Employee Handbook 2026" />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FormField label="Share with Departments">
            <MultiSelect
              options={['All', 'Engineering', 'Human Resources', 'Finance', 'Marketing']}
              placeholder="Select departments"
              value={formData.departments}
              onChange={(vals: string[]) => setFormData((prev) => ({ ...prev, departments: vals }))}
            />
          </FormField>

          <FormField label="Share with Employees">
            <MultiSelect
              options={['UNION ADMIN', 'SAMUEL BANDOH', 'SARAH JENKS', 'MICHAEL CHEN']}
              placeholder="Select employees"
              value={formData.employees}
              onChange={(vals: string[]) => setFormData((prev) => ({ ...prev, employees: vals }))}
            />
          </FormField>
        </div>

        <FormField label="Details">
          <textarea name="details" value={formData.details} onChange={handleChange} className={inputClass} placeholder="Brief description of the document contents" rows={3} />
        </FormField>

        <FormField label="Attachment">
          <FileUpload
            onChange={(file) => setFormData((prev) => ({ ...prev, attachment: file }))}
            currentFile={formData.attachment}
            currentFileName={initialData?.attachmentName}
          />
        </FormField>
      </div>
    </FormModal>
  );
}
