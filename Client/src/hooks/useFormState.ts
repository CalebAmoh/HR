import { useState, useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';

export function useFormState<T extends Record<string, any>>(
  initialState: T,
  initialData?: T | null
) {
  const initialStateRef = useRef(initialState);

  const [formData, setFormData] = useState<T>(
    initialData ? { ...initialState, ...initialData } : initialState
  );

  useEffect(() => {
    const base = initialStateRef.current;
    setFormData(initialData ? { ...base, ...initialData } : base);
  }, [initialData]);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return { formData, handleChange, setFormData };
}
