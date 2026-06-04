const STORAGE_KEY = 'hr_settings';

export interface AppSettings {
  companyStructure: {
    autoGenerateCode: boolean;
  };
  employees: {
    autoGenerateNumber: boolean;
  };
  recruitment: {
    autoGenerateCode: boolean;
  };
  approvals: {
    employeeApproval: boolean;
    employeeSelfApproval: boolean;
    payrollApproval: boolean;
    selfApproval: boolean;
    medicalApproval: boolean;
    medicalSelfApproval: boolean;
  };
  general: {
    currency: string;
  };
  medicalClaims: {
    hospitalWhtRate: number;
    pharmacyWhtRate: number;
  };
}

const DEFAULTS: AppSettings = {
  companyStructure: {
    autoGenerateCode: false,
  },
  employees: {
    autoGenerateNumber: true,
  },
  recruitment: {
    autoGenerateCode: false,
  },
  approvals: {
    employeeApproval: true,
    employeeSelfApproval: false,
    payrollApproval: false,
    selfApproval: false,
    medicalApproval: true,
    medicalSelfApproval: true,
  },
  general: {
    currency: 'SLE',
  },
  medicalClaims: {
    hospitalWhtRate: 0,
    pharmacyWhtRate: 0,
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
      recruitment:      { ...DEFAULTS.recruitment,      ...(parsed.recruitment      ?? {}) },
      approvals:        { ...DEFAULTS.approvals,        ...(parsed.approvals        ?? {}) },
      general:          { ...DEFAULTS.general,          ...(parsed.general          ?? {}) },
      medicalClaims:    { ...DEFAULTS.medicalClaims,    ...(parsed.medicalClaims    ?? {}) },
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
