const STORAGE_KEY = 'hr_settings';

export interface AppSettings {
  companyStructure: {
    autoGenerateCode: boolean;
  };
  employees: {
    autoGenerateNumber: boolean;
  };
  approvals: {
    payrollApproval: boolean;
    selfApproval: boolean;
  };
}

const DEFAULTS: AppSettings = {
  companyStructure: {
    autoGenerateCode: false,
  },
  employees: {
    autoGenerateNumber: true,
  },
  approvals: {
    payrollApproval: false,
    selfApproval: false,
  },
};

export function getSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      companyStructure: { ...DEFAULTS.companyStructure, ...(parsed.companyStructure ?? {}) },
      employees:        { ...DEFAULTS.employees,        ...(parsed.employees        ?? {}) },
      approvals:        { ...DEFAULTS.approvals,        ...(parsed.approvals        ?? {}) },
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveSetting<K extends keyof AppSettings>(
  section: K,
  values: Partial<AppSettings[K]>
): void {
  const current = getSettings();
  const updated: AppSettings = {
    ...current,
    [section]: { ...(current[section] as object), ...(values as object) },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}
