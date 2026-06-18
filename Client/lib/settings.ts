import api from './api';

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

// In-memory store only — settings are NEVER persisted to localStorage. The database
// (settings table) is the single source of truth; this cache is hydrated from the
// server by initControlSettings() on app load and reset to defaults on every reload.
let cache: AppSettings = structuredClone(DEFAULTS);

// Remove any settings persisted by older builds so nothing lingers in the browser.
try { localStorage.removeItem('hr_settings'); } catch { /* no localStorage — ignore */ }

export function getSettings(): AppSettings {
  // Return a fresh copy so callers can't mutate the shared cache.
  return {
    companyStructure: { ...cache.companyStructure },
    employees:        { ...cache.employees },
    recruitment:      { ...cache.recruitment },
    approvals:        { ...cache.approvals },
    general:          { ...cache.general },
    medicalClaims:    { ...cache.medicalClaims },
  };
}

// Server keys for each section/field — the database (settings table, category
// 'app_controls') is the source of truth; the in-memory cache is just a synchronous
// view so components can keep calling getSettings() without await.
// medicalClaims is excluded: it persists through its own /medical/settings endpoint.
const SERVER_KEYS: Record<string, Record<string, string>> = {
  companyStructure: { autoGenerateCode:   'company_auto_generate_code' },
  employees:        { autoGenerateNumber: 'employee_auto_generate_number' },
  recruitment:      { autoGenerateCode:   'recruitment_auto_generate_code' },
  approvals: {
    employeeApproval:     'approval_employee',
    employeeSelfApproval: 'approval_employee_self',
    payrollApproval:      'approval_payroll',
    selfApproval:         'approval_payroll_self',
    medicalApproval:      'approval_medical',
    medicalSelfApproval:  'approval_medical_self',
  },
  general: { currency: 'general_currency' },
};

function writeCache(settings: AppSettings): void {
  cache = settings;
}

/** Pull control settings from the server into the local cache.
 *  Called before first render (main.tsx) and after login (App.tsx). */
export async function initControlSettings(): Promise<void> {
  try {
    const r = await api.get('/settings/controls');
    const flat: Record<string, string> = r.data?.data ?? {};
    const merged = getSettings();
    for (const [section, fields] of Object.entries(SERVER_KEYS)) {
      for (const [field, serverKey] of Object.entries(fields)) {
        const def = (DEFAULTS as any)[section][field];
        if (flat[serverKey] === undefined) {
          // Not on the server → reset to the built-in default, never a stale local edit
          // that failed to persist. The DB is the source of truth.
          (merged as any)[section][field] = def;
          continue;
        }
        (merged as any)[section][field] = typeof def === 'boolean' ? flat[serverKey] === '1' : flat[serverKey];
      }
    }
    writeCache(merged);
  } catch { /* offline — keep cached/default values */ }
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
  writeCache(updated);

  // Write-through to the server so the setting applies to every user
  const fields = SERVER_KEYS[section as string];
  if (!fields) return;
  const payload: Record<string, string> = {};
  for (const [field, value] of Object.entries(values as object)) {
    const serverKey = fields[field];
    if (!serverKey) continue;
    payload[serverKey] = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
  }
  if (Object.keys(payload).length) {
    api.put('/settings/controls', payload).catch(() => { /* cache still holds the value locally */ });
  }
}
