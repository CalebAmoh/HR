import api from './api';

export interface CodeList {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  _count?: { values: number };
  values?: CodeListValue[];
}

export interface CodeListValue {
  id: string;
  codeListId: string;
  label: string;
  code: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

export const codeLists = {
  getAll: () =>
    api.get<{ status: string; data: CodeList[] }>('/system/code-lists'),

  getById: (id: string) =>
    api.get<{ status: string; data: CodeList }>(`/system/code-lists/${id}`),

  create: (data: { name: string; code: string; description?: string }) =>
    api.post<{ status: string; data: CodeList }>('/system/code-lists', data),

  update: (id: string, data: { name?: string; description?: string }) =>
    api.put<{ status: string; data: CodeList }>(`/system/code-lists/${id}`, data),

  createValue: (
    codeStr: string,
    data: { label: string; code?: string; description?: string }
  ) =>
    api.post<{ status: string; data: CodeListValue }>(
      `/system/code-lists/${codeStr}/values`,
      data
    ),

  updateValue: (
    codeListId: string,
    valueId: string,
    data: { label?: string; description?: string }
  ) =>
    api.put<{ status: string; data: CodeListValue }>(
      `/system/code-lists/${codeListId}/${valueId}`,
      data
    ),

  deactivateValue: (codeListId: string, valueId: string) =>
    api.put<{ status: string; data: CodeListValue }>(
      `/system/code-lists/${codeListId}/values/${valueId}/deactivate`
    ),

  activateValue: (codeListId: string, valueId: string) =>
    api.put<{ status: string; data: CodeListValue }>(
      `/system/code-lists/${codeListId}/values/${valueId}/activate`
    ),
};
