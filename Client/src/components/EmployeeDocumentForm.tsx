import { useFormState } from '../hooks/useFormState';
import { FormModal } from './ui/FormModal';
import { FormField, inputClass } from './ui/FormField';
import { FileUpload } from './ui/FileUpload';

export function EmployeeDocumentForm({ onClose, initialData, onSave }: any) {
  const { formData, handleChange, setFormData } = useFormState(
    {
      employee: '',
      documentType: '',
      dateOfIssue: '',
      placeOfIssue: '',
      expiryDate: '',
      details: '',
      attachment: null as File | null,
    },
    initialData
  );

  return (
    <FormModal
      title={initialData ? 'Edit Employee Document' : 'Add Employee Document'}
      subtitle="Fill in the details and attach the required document."
      onClose={onClose}
      onSave={() => { onSave(formData); onClose(); }}
      saveLabel="Save Document"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <FormField label="Employee" className="sm:col-span-2">
          <select name="employee" value={formData.employee} onChange={handleChange} className={inputClass}>
            <option value="">Select Employee</option>
            <option value="UNION ADMIN">UNION ADMIN</option>
            <option value="SAMUEL BANDOH">SAMUEL BANDOH</option>
            <option value="SARAH JENKS">SARAH JENKS</option>
            <option value="MICHAEL CHEN">MICHAEL CHEN</option>
          </select>
        </FormField>

        <FormField label="Document Type">
          <select name="documentType" value={formData.documentType} onChange={handleChange} className={inputClass}>
            <option value="">Select Type</option>
            <option value="National ID">National ID</option>
            <option value="Passport">Passport</option>
            <option value="Driver's License">Driver's License</option>
            <option value="Tax Certificate">Tax Certificate</option>
            <option value="SSNIT Card">SSNIT Card</option>
          </select>
        </FormField>

        <FormField label="Expiry Date">
          <input type="date" name="expiryDate" value={formData.expiryDate} onChange={handleChange} className={inputClass} />
        </FormField>

        <FormField label="Date of Issue">
          <input type="date" name="dateOfIssue" value={formData.dateOfIssue} onChange={handleChange} className={inputClass} />
        </FormField>

        <FormField label="Place of Issue">
          <input type="text" name="placeOfIssue" value={formData.placeOfIssue} onChange={handleChange} className={inputClass} placeholder="e.g. Accra" />
        </FormField>

        <FormField label="Details" className="sm:col-span-2">
          <textarea name="details" value={formData.details} onChange={handleChange} className={inputClass} placeholder="Additional details..." rows={3} />
        </FormField>

        <FormField label="Attachment" className="sm:col-span-2">
          <FileUpload
            onChange={(file) => setFormData((prev) => ({ ...prev, attachment: file }))}
            currentFile={formData.attachment}
            currentFileName={initialData?.attachmentName}
            accept=".pdf,image/*"
            hint="PDF, Image (Max 5MB)"
          />
        </FormField>
      </div>
    </FormModal>
  );
}
