import { useState, useMemo } from 'react';
import {
  Search, Users, CalendarCheck, Building2, Banknote, Stethoscope,
  ChevronRight, ArrowLeft, BookOpen, Lightbulb, AlertTriangle,
  CheckCircle2, Clock, FileText, ListChecks, Sparkles, X, BarChart2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { inputClass } from './ui/FormField';

// ─── Data types ──────────────────────────────────────────────────────────────

type ContentBlock =
  | { type: 'text';    body: string }
  | { type: 'tip';     body: string }
  | { type: 'warning'; body: string }
  | { type: 'steps';   heading?: string; steps: { label: string; detail?: string }[] }
  | { type: 'table';   headers: string[]; rows: string[][] };

type Article = {
  id: string;
  title: string;
  summary: string;
  icon: typeof FileText;
  content: ContentBlock[];
};

type HelpModule = {
  id: string;
  title: string;
  description: string;
  icon: typeof Users;
  color: string;
  accentBg: string;
  articles: Article[];
};

// ─── Content ─────────────────────────────────────────────────────────────────

const MODULES: HelpModule[] = [
  // ── EMPLOYEES ──────────────────────────────────────────────────────────────
  {
    id: 'employees',
    title: 'Employees',
    description: 'Add, edit, and manage your workforce — profiles, documents, and relations.',
    icon: Users,
    color: '#2563eb',
    accentBg: '#eff6ff',
    articles: [
      {
        id: 'add-employee',
        title: 'Adding a New Employee',
        summary: 'Create a new employee record and fill in their personal, contact, and job details.',
        icon: FileText,
        content: [
          { type: 'text', body: 'Employee records are the foundation of the HR system. Every payroll run, leave balance, and document is tied to an employee record.' },
          {
            type: 'steps', heading: 'How to add a new employee',
            steps: [
              { label: 'Go to Employees from the sidebar.' },
              { label: 'Click "Add Employee" in the top-right corner.' },
              { label: 'Fill in the required fields — first name, last name, employee ID, hire date, department, job title, and pay grade.' },
              { label: 'Complete optional sections: contact info, bank account, and emergency contacts.' },
              { label: 'Click "Save" to create the draft record.' },
              { label: 'If your organisation requires HR approval, click "Submit for Approval" and an authorised user will review the record.' },
            ],
          },
          { type: 'tip', body: 'The employee ID is used on payslips and leave applications. Use a consistent format such as EMP-001.' },
          { type: 'warning', body: 'Bank account details must be entered before payroll can be processed for this employee.' },
        ],
      },
      {
        id: 'edit-employee',
        title: 'Editing Employee Details',
        summary: 'Update personal information, job details, salary grade, and more.',
        icon: FileText,
        content: [
          {
            type: 'steps', heading: 'How to edit an employee',
            steps: [
              { label: 'Open the Employees list and locate the employee.' },
              { label: 'Click the eye icon to open their profile slide-over.' },
              { label: 'Click "Edit" or click directly on any field group (e.g. Job Info, Contact) to edit that section.' },
              { label: 'Make your changes and click "Save".' },
            ],
          },
          { type: 'tip', body: 'Changes to pay grade take effect from the next payroll run. They do not retroactively alter previous payslips.' },
        ],
      },
      {
        id: 'approve-employee',
        title: 'Approving an Employee Record',
        summary: 'Review and approve newly submitted employee records before they become active.',
        icon: CheckCircle2,
        content: [
          { type: 'text', body: 'Depending on your system settings, new employee records may require HR approval before becoming active. This ensures data quality before payroll or leave processing begins.' },
          {
            type: 'steps', heading: 'How to approve a record',
            steps: [
              { label: 'Go to Employees and look for records with a "Pending" status badge.' },
              { label: 'Open the employee\'s profile slide-over.' },
              { label: 'Review all the entered details carefully.' },
              { label: 'Click "Approve" to activate the record, or "Reject" to send it back with a reason.' },
            ],
          },
          { type: 'tip', body: 'You need the "Approve Employees" permission to see the approve/reject actions.' },
        ],
      },
      {
        id: 'employee-documents',
        title: 'Managing Employee Documents',
        summary: 'Upload, view, and delete documents attached to an employee profile.',
        icon: FileText,
        content: [
          { type: 'text', body: 'You can attach any file (contracts, IDs, certificates) directly to an employee record for easy retrieval.' },
          {
            type: 'steps', heading: 'Uploading a document',
            steps: [
              { label: 'Open the employee\'s profile.' },
              { label: 'Switch to the "Documents" tab in the slide-over.' },
              { label: 'Click "Upload" and select the file from your computer.' },
              { label: 'Add a document name/description and click "Save".' },
            ],
          },
          { type: 'tip', body: 'Supported file types include PDF, DOCX, PNG, and JPG. Maximum size per file is 10 MB.' },
        ],
      },
      {
        id: 'employee-relations',
        title: 'Employee Relations (Skills, Dependents & More)',
        summary: 'Record skills, certifications, languages, dependents, and emergency contacts.',
        icon: ListChecks,
        content: [
          { type: 'text', body: 'The Relations tab on each employee profile lets you record rich supplemental information used for reporting and compliance.' },
          {
            type: 'table',
            headers: ['Section', 'What it stores'],
            rows: [
              ['Skills',              'Professional competencies and proficiency levels'],
              ['Certifications',      'Qualifications with issue and expiry dates'],
              ['Languages',           'Languages spoken and proficiency level'],
              ['Dependents',          'Spouse, children, or other dependents'],
              ['Emergency Contacts',  'People to call in an emergency'],
            ],
          },
          {
            type: 'steps', heading: 'How to add a relation entry',
            steps: [
              { label: 'Open the employee profile and go to the "Relations" tab.' },
              { label: 'Select the category (e.g. Skills).' },
              { label: 'Click the + icon and fill in the form.' },
              { label: 'Save. The entry appears in the list immediately.' },
            ],
          },
        ],
      },
    ],
  },

  // ── LEAVE ──────────────────────────────────────────────────────────────────
  {
    id: 'leave',
    title: 'Leave',
    description: 'Configure leave policies, apply for leave, and manage approvals.',
    icon: CalendarCheck,
    color: '#059669',
    accentBg: '#f0fdf4',
    articles: [
      {
        id: 'leave-types',
        title: 'Setting Up Leave Types',
        summary: 'Create leave types such as Annual Leave, Sick Leave, and Maternity Leave.',
        icon: FileText,
        content: [
          { type: 'text', body: 'Leave types define the rules for each category of leave — entitlement days, carry-forward behaviour, allowance eligibility, and more.' },
          {
            type: 'steps', heading: 'Creating a leave type',
            steps: [
              { label: 'Go to Leave → Leave Setup and open the "Leave Types" tab.' },
              { label: 'Click "Add Leave Type".' },
              { label: 'Enter a name, the days per leave period, and choose a colour for the calendar.' },
              { label: 'Configure carry-forward: set "Leave Carried Forward" to Yes, then set the percentage, maximum days, and availability window (how long the carry-forward can be used before expiry).' },
              { label: 'Toggle "Leave Accrue Enabled" if days should be earned gradually each month/quarter rather than granted all at once.' },
              { label: 'If this leave type pays an allowance, set "Leave Allowance" to Yes.' },
              { label: 'Assign the type to one or more Leave Groups if needed, then save.' },
            ],
          },
          { type: 'tip', body: 'Use the Accrual Rate hint text in the form to verify your rate spreads correctly across the year.' },
          { type: 'warning', body: 'Changing "Leaves Per Period" on an existing type does not retroactively adjust balances already computed for the active period.' },
        ],
      },
      {
        id: 'leave-periods',
        title: 'Managing Leave Periods',
        summary: 'Create annual or custom leave periods and activate carry-forward when switching years.',
        icon: Clock,
        content: [
          { type: 'text', body: 'A leave period defines the date range for which leave entitlements are calculated. Only one period can be Active at a time.' },
          {
            type: 'steps', heading: 'Creating a new period',
            steps: [
              { label: 'Go to Leave Setup → Leave Period.' },
              { label: 'Click "Add Leave Period", enter a name (e.g. "2026 Leave Year"), set the start and end dates, then save.' },
              { label: 'When you are ready to start the new year, click the ✓ icon next to the new period to activate it.' },
              { label: 'Activation automatically runs carry-forward for all employees from the previous period into the new one, then sets the new period as Active.' },
            ],
          },
          { type: 'tip', body: 'If you need to recalculate carry-forward after making changes, use the "Recalculate Carry-Forward" button on the period row.' },
          { type: 'warning', body: 'Switching back to an older period clears any carry-forward records that were written for the period you are activating, reverting to fresh base allocations. Only do this to correct data.' },
        ],
      },
      {
        id: 'holidays',
        title: 'Configuring Public Holidays',
        summary: 'Add public holidays so they are excluded when counting leave days.',
        icon: FileText,
        content: [
          {
            type: 'steps', heading: 'Adding a holiday',
            steps: [
              { label: 'Go to Leave Setup → Holidays.' },
              { label: 'Click "Add Holiday" and enter the holiday name and date.' },
              { label: 'Set the Day Type: Full Day (not counted as a leave day) or Half Day (counts as 0.5 leave days).' },
              { label: 'Save. The holiday is immediately applied to all future leave day calculations.' },
            ],
          },
          { type: 'tip', body: 'Holidays are applied globally. If your organisation observes different holidays across regions, contact your system administrator.' },
        ],
      },
      {
        id: 'leave-rules',
        title: 'Leave Rules — Overrides Per Group',
        summary: 'Set custom entitlements for specific job titles, departments, or pay grades.',
        icon: ListChecks,
        content: [
          { type: 'text', body: 'Leave Rules let you override the default leave type settings for a specific combination of criteria. For example, management may get 25 annual leave days while other staff get 20.' },
          {
            type: 'steps', heading: 'Creating a leave rule',
            steps: [
              { label: 'Go to Leave Setup → Leave Rules.' },
              { label: 'Click "Add Rule".' },
              { label: 'Select the Leave Type you want to override.' },
              { label: 'Set one or more criteria: Job Title, Department, Employment Status, Leave Group, or Years of Experience.' },
              { label: 'Set the overriding values (days per year, carry-forward settings, etc.).' },
              { label: 'Save. The rule applies immediately during the next balance calculation for matching employees.' },
            ],
          },
          { type: 'tip', body: 'Rules are evaluated from most specific to least specific. The first matching rule wins.' },
        ],
      },
      {
        id: 'apply-leave',
        title: 'Applying for Leave',
        summary: 'Submit a leave request and track it through the approval workflow.',
        icon: CheckCircle2,
        content: [
          {
            type: 'steps', heading: 'How to apply for leave',
            steps: [
              { label: 'Go to Leave from the sidebar.' },
              { label: 'Click "Apply Leave" in the top-right corner.' },
              { label: 'Select the leave type, start date, and end date. The form shows a live preview of how many working days your request spans and flags any public holidays.' },
              { label: 'Add any details or notes, then click "Review →" to see the day-by-day breakdown.' },
              { label: 'Confirm to submit the leave application.' },
            ],
          },
          { type: 'tip', body: 'If a supervisor applies on your behalf, they use the "Assign Leave" button in the Subordinate Leave tab.' },
          {
            type: 'table',
            headers: ['Status', 'Meaning'],
            rows: [
              ['Draft',               'Saved but not yet submitted for approval'],
              ['Pending Approval',    'Sent to your supervisor for first-level approval'],
              ['Pending HR Approval', 'Passed supervisor tier and waiting for HR/admin sign-off'],
              ['Approved',            'Fully approved — balance has been deducted'],
              ['Rejected',            'Declined at one of the approval tiers'],
              ['Cancelled',           'Approved leave that was later cancelled'],
            ],
          },
        ],
      },
      {
        id: 'approve-leave',
        title: 'Approving or Rejecting Leave',
        summary: 'Review and action leave requests from your team or the approval queue.',
        icon: CheckCircle2,
        content: [
          { type: 'text', body: 'Leave approval follows up to two tiers: the employee\'s supervisor acts first, then HR/admin gives final sign-off.' },
          {
            type: 'steps', heading: 'Approving as a supervisor',
            steps: [
              { label: 'Go to Leave → Subordinate Leave tab.' },
              { label: 'Find the leave request with status "Pending Approval".' },
              { label: 'Click the eye icon to open the details slide-over.' },
              { label: 'Click "Approve" or "Reject". If rejecting, enter a reason.' },
            ],
          },
          {
            type: 'steps', heading: 'Approving as HR / admin',
            steps: [
              { label: 'Go to Leave → Approval Request tab.' },
              { label: 'Requests showing "Pending HR Approval" are awaiting your action.' },
              { label: 'Open the detail slide-over and click "Approve" or "Reject".' },
            ],
          },
          { type: 'tip', body: 'Alternatively, all pending items across modules are visible in Central Approval from the sidebar — a single queue for supervisors, HR, and financial approvers.' },
        ],
      },
      {
        id: 'leave-entitlement',
        title: 'Understanding Leave Entitlement',
        summary: 'See your allocated, used, pending, and remaining leave days per leave type.',
        icon: BookOpen,
        content: [
          { type: 'text', body: 'The Leave Entitlement tab shows a card for every leave type you are entitled to in the current active period.' },
          {
            type: 'table',
            headers: ['Field', 'Description'],
            rows: [
              ['Allocated',       'Total days you are entitled to for the period (including carry-forward if applicable)'],
              ['Carry-Forward',   'Days rolled over from the previous period'],
              ['Used',            'Days from approved leave'],
              ['Pending',         'Days from leave applications still awaiting approval'],
              ['Remaining',       'Allocated − Used − Pending'],
            ],
          },
          { type: 'tip', body: 'Carry-forward days expire after the window set in the leave type (e.g. 1 month, 3 months). Once expired, remaining CF days are forfeited and your balance reverts to the base allocation.' },
        ],
      },
      {
        id: 'leave-calendar',
        title: 'Using the Leave Calendar',
        summary: 'Visualise team leave across the month to spot coverage gaps.',
        icon: CalendarCheck,
        content: [
          { type: 'text', body: 'The Leave Calendar shows all approved and pending leave across your organisation on a monthly grid. Each leave type is shown in its configured colour.' },
          {
            type: 'steps', heading: 'Navigating the calendar',
            steps: [
              { label: 'Go to Leave → Leave Calendar.' },
              { label: 'Use the ← → arrows to move between months.' },
              { label: 'Click any leave block to see the employee name, leave type, and duration.' },
              { label: 'Use the filter bar to narrow down by department or leave type.' },
            ],
          },
        ],
      },
    ],
  },

  // ── COMPANY ────────────────────────────────────────────────────────────────
  {
    id: 'company',
    title: 'Company',
    description: 'Manage your org structure — departments, branches, and the organogram.',
    icon: Building2,
    color: '#7c3aed',
    accentBg: '#f5f3ff',
    articles: [
      {
        id: 'departments',
        title: 'Managing Departments',
        summary: 'Create, rename, and delete departments used across the system.',
        icon: FileText,
        content: [
          { type: 'text', body: 'Departments are used throughout the system to group employees, filter reports, and apply leave rules.' },
          {
            type: 'steps', heading: 'Adding a department',
            steps: [
              { label: 'Go to Company from the sidebar.' },
              { label: 'Open the "Departments" tab.' },
              { label: 'Click "Add Department" and enter the name and any parent department (for nested structures).' },
              { label: 'Save. The department is immediately available in employee profiles and leave rules.' },
            ],
          },
          { type: 'warning', body: 'Deleting a department that has employees assigned will block the deletion. Reassign employees first.' },
        ],
      },
      {
        id: 'organogram',
        title: 'Viewing the Organogram',
        summary: 'See a live visual tree of your organisation\'s hierarchy.',
        icon: Building2,
        content: [
          { type: 'text', body: 'The Organogram page renders a live org chart based on each employee\'s supervisor relationship. It updates automatically as you add or edit employees.' },
          {
            type: 'steps', heading: 'Using the organogram',
            steps: [
              { label: 'Go to Company → Organogram from the sidebar.' },
              { label: 'The chart starts from the top-most employees (those with no supervisor).' },
              { label: 'Click any node to expand or collapse that branch.' },
              { label: 'Use the search bar to jump to a specific employee.' },
            ],
          },
          { type: 'tip', body: 'Supervisors are assigned on each employee\'s profile under the "Job Info" section.' },
        ],
      },
    ],
  },

  // ── PAYROLL ────────────────────────────────────────────────────────────────
  {
    id: 'payroll',
    title: 'Payroll',
    description: 'Run payroll, manage salary components, and issue payslips.',
    icon: Banknote,
    color: '#d97706',
    accentBg: '#fffbeb',
    articles: [
      {
        id: 'salary-components',
        title: 'Setting Up Salary Components',
        summary: 'Configure allowances, deductions, and PAYE tax to build employee pay structures.',
        icon: FileText,
        content: [
          { type: 'text', body: 'Salary components are the building blocks of payroll. Each component is either an Earning (adds to gross) or a Deduction (reduces net pay).' },
          {
            type: 'steps', heading: 'Creating a salary component',
            steps: [
              { label: 'Go to Salary from the sidebar.' },
              { label: 'Open the "Components" tab and click "Add Component".' },
              { label: 'Enter the name, type (Earning or Deduction), and whether it is taxable.' },
              { label: 'Set the calculation method: fixed amount, percentage of basic, or formula.' },
              { label: 'Save. The component can now be assigned to employee salary structures.' },
            ],
          },
          { type: 'tip', body: 'Taxable earnings are included in the PAYE calculation. Non-taxable earnings (e.g. transport allowance up to a threshold) are excluded.' },
        ],
      },
      {
        id: 'notch-setup',
        title: 'Pay Grades and Notches',
        summary: 'Understand how pay grades and notch levels determine an employee\'s salary.',
        icon: ListChecks,
        content: [
          { type: 'text', body: 'A Pay Grade groups employees at a similar level. Within each grade, Notches represent salary steps — an employee moves up a notch over time or through promotion.' },
          {
            type: 'table',
            headers: ['Concept', 'Description'],
            rows: [
              ['Pay Grade',  'Broad salary band (e.g. Grade 7, Manager Level)'],
              ['Notch',      'A specific salary point within a grade (e.g. Notch 3 = $2,500/month)'],
              ['Movement',   'Automated or manual step from one notch to the next'],
            ],
          },
          {
            type: 'steps', heading: 'Assigning a notch to an employee',
            steps: [
              { label: 'Open the employee profile and go to "Job Info".' },
              { label: 'Select the correct Pay Grade and Notch.' },
              { label: 'Save. The selected notch\'s basic salary is used in the next payroll run.' },
            ],
          },
        ],
      },
      {
        id: 'run-payroll',
        title: 'Running Payroll',
        summary: 'Process a payroll batch for all active employees in a pay period.',
        icon: CheckCircle2,
        content: [
          {
            type: 'steps', heading: 'How to run payroll',
            steps: [
              { label: 'Go to Payroll from the sidebar.' },
              { label: 'Click "New Payroll Run" and select the pay period (e.g. May 2026).' },
              { label: 'The system calculates gross pay, all components, tax, and net pay for every active employee.' },
              { label: 'Review the payroll summary. Use the search and filters to check individual employee lines.' },
              { label: 'Click "Submit for Approval" when satisfied. A payroll approver will review and authorise the run.' },
            ],
          },
          { type: 'warning', body: 'Ensure all employee pay grades and bank accounts are up to date before running payroll. Missing bank accounts will block the payslip payment.' },
          { type: 'tip', body: 'You can re-open and edit a payroll run that is still in Draft status. Once submitted for approval it is locked.' },
        ],
      },
      {
        id: 'approve-payroll',
        title: 'Approving Payroll',
        summary: 'Review and authorise a submitted payroll run before it is finalised.',
        icon: CheckCircle2,
        content: [
          {
            type: 'steps', heading: 'Approving a payroll run',
            steps: [
              { label: 'Go to Central Approval from the sidebar, or go directly to Payroll.' },
              { label: 'Find the payroll run with status "Pending Approval".' },
              { label: 'Review the figures. Open individual payslips from the detail panel if needed.' },
              { label: 'Click "Approve" to finalise. Payslips are generated and the run is locked.' },
              { label: 'Click "Reject" (with a reason) to send the run back to the preparer.' },
            ],
          },
          { type: 'tip', body: 'You need the "Approve Payroll" permission to see the approve/reject actions.' },
        ],
      },
      {
        id: 'payslips',
        title: 'Viewing and Downloading Payslips',
        summary: 'Access individual payslips for any approved payroll run.',
        icon: FileText,
        content: [
          {
            type: 'steps', heading: 'Accessing payslips',
            steps: [
              { label: 'Go to Payroll and open the approved payroll run.' },
              { label: 'Find the employee row and click the payslip icon.' },
              { label: 'The payslip opens as a formatted document.' },
              { label: 'Click "Download PDF" to save a copy.' },
            ],
          },
          { type: 'tip', body: 'Employees can view their own payslips under Personal Info → Payslips without needing any special permission.' },
        ],
      },
    ],
  },

  // ── MEDICAL ────────────────────────────────────────────────────────────────
  {
    id: 'medical',
    title: 'Medical',
    description: 'Submit and manage medical claims for staff and their dependents.',
    icon: Stethoscope,
    color: '#dc2626',
    accentBg: '#fef2f2',
    articles: [
      {
        id: 'submit-medical',
        title: 'Submitting a Medical Claim',
        summary: 'Log a medical expense for yourself or a registered dependent.',
        icon: FileText,
        content: [
          {
            type: 'steps', heading: 'How to submit a claim',
            steps: [
              { label: 'Go to Medical → Personal Medical from the sidebar.' },
              { label: 'Click "New Claim".' },
              { label: 'Select whether the claim is for yourself or a dependent.' },
              { label: 'Enter the date of service, description, and amount.' },
              { label: 'Upload the receipt or invoice (PDF or image).' },
              { label: 'Click "Submit". The claim enters the approval queue.' },
            ],
          },
          { type: 'tip', body: 'Register dependents on your employee profile under Relations → Dependents before submitting claims on their behalf.' },
          { type: 'warning', body: 'Claims without a supporting document may be rejected. Always upload proof of payment.' },
        ],
      },
      {
        id: 'medical-plans',
        title: 'Medical Plans and Limits',
        summary: 'Understand how annual medical limits are configured per pay grade.',
        icon: ListChecks,
        content: [
          { type: 'text', body: 'Each pay grade can be assigned a medical plan that defines the maximum amount claimable per year for staff and dependents.' },
          {
            type: 'table',
            headers: ['Setting', 'Description'],
            rows: [
              ['Annual Staff Limit',    'Maximum medical claim amount for the employee per year'],
              ['Annual Dependent Limit','Maximum for all dependents combined per year'],
              ['Carry-Over',           'Whether unused allowance rolls into the next year'],
            ],
          },
          { type: 'tip', body: 'To view your current balance, go to Personal Medical → Entitlement. It shows how much you have used and how much remains.' },
        ],
      },
      {
        id: 'admin-medical',
        title: 'Admin: Reviewing Medical Claims',
        summary: 'Review, approve, or reject staff and dependent medical claims.',
        icon: CheckCircle2,
        content: [
          {
            type: 'steps', heading: 'Reviewing claims as an admin',
            steps: [
              { label: 'Go to Medical → Admin Medical from the sidebar.' },
              { label: 'The "Staff Claims" tab shows all submitted employee claims.' },
              { label: 'Click the eye icon on any claim to open the detail panel — you can see the amount, date, description, and supporting document.' },
              { label: 'Click "Approve" to accept the claim, or "Reject" with a reason to decline it.' },
              { label: 'Approved claims reduce the employee\'s remaining annual medical balance.' },
            ],
          },
          { type: 'tip', body: 'Use the Dependents tab to view and action claims submitted for employee family members.' },
        ],
      },
    ],
  },

  // ── REPORTS ────────────────────────────────────────────────────────────────
  {
    id: 'reports',
    title: 'Reports',
    description: 'Generate, export, and print company-wide and personal reports.',
    icon: BarChart2,
    color: '#0891b2',
    accentBg: '#ecfeff',
    articles: [
      {
        id: 'reports-overview',
        title: 'Reports Overview',
        summary: 'Understand the difference between Admin Reports and User Reports, and who can access each.',
        icon: BookOpen,
        content: [
          { type: 'text', body: 'The system has two reporting areas designed for different audiences. Admin Reports give HR and management a company-wide view, while User Reports let each employee access their own personal records.' },
          {
            type: 'table',
            headers: ['Report area', 'Who it is for', 'Where to find it'],
            rows: [
              ['Admin Reports', 'HR admins and managers', 'Sidebar → Admin Reports'],
              ['User Reports (My Reports)', 'All employees', 'Sidebar → User Reports'],
            ],
          },
          { type: 'tip', body: 'Access to Admin Reports is controlled by the "Generate Reports" and "View Employees" permissions. If you cannot see the page, ask your administrator.' },
        ],
      },

      // ── Admin Reports ──
      {
        id: 'employee-details-report',
        title: 'Admin: Employee Details Report',
        summary: 'Export a full list of all employees and their personal, contact, and job information.',
        icon: FileText,
        content: [
          { type: 'text', body: 'The Employee Details Report compiles every active employee\'s profile data into a single exportable table — useful for audits, payroll reconciliation, and HR reviews.' },
          {
            type: 'steps', heading: 'Generating the report',
            steps: [
              { label: 'Go to Admin Reports from the sidebar.' },
              { label: 'Find the "Employee Details Report" card.' },
              { label: 'Click "Export CSV" to download a spreadsheet, or "Print" to open a print-ready view.' },
            ],
          },
          {
            type: 'table',
            headers: ['Column included', 'Description'],
            rows: [
              ['Name',            'Full employee name'],
              ['Employee ID',     'Unique staff identifier'],
              ['Department',      'Assigned department'],
              ['Job Title',       'Current job title'],
              ['Pay Grade',       'Assigned salary grade'],
              ['Hire Date',       'Date the employee joined'],
              ['Employment Status','Active, On Leave, etc.'],
              ['Contact Info',    'Email and phone number'],
            ],
          },
          { type: 'tip', body: 'Use filters in the downloaded spreadsheet to sort by department or date range.' },
        ],
      },
      {
        id: 'payroll-summary-report',
        title: 'Admin: Payroll Summary',
        summary: 'View a company-wide breakdown of gross pay, deductions, tax, and net pay for any payroll run.',
        icon: FileText,
        content: [
          { type: 'text', body: 'The Payroll Summary report gives a line-by-line view of every employee\'s earnings and deductions for a completed payroll run. It is the primary tool for verifying a run before funds are disbursed.' },
          {
            type: 'steps', heading: 'Accessing the report',
            steps: [
              { label: 'Go to Admin Reports.' },
              { label: 'Click "Export CSV" or "Print" on the Payroll Summary card.' },
              { label: 'In the dialog, select the payroll run you want to report on.' },
              { label: 'The report downloads with one row per employee showing gross, components, tax, and net pay.' },
            ],
          },
          { type: 'tip', body: 'Only Completed or Approved payroll runs appear in the selector. Draft runs are excluded.' },
        ],
      },
      {
        id: 'payslip-report',
        title: 'Admin: Payslip Report (Bulk Download)',
        summary: 'Download payslips for one or all employees from any completed payroll run.',
        icon: FileText,
        content: [
          { type: 'text', body: 'Use this report to bulk-download PDF payslips for distribution to employees after a payroll run is approved.' },
          {
            type: 'steps', heading: 'Bulk-downloading payslips',
            steps: [
              { label: 'Go to Admin Reports and click "Generate" on the Payslip Report card.' },
              { label: 'Select a completed or approved payroll run from the dropdown.' },
              { label: 'Choose "All Employees" or select a specific employee.' },
              { label: 'Click "Download". The browser will save one PDF per employee.' },
            ],
          },
          { type: 'warning', body: 'Downloading all payslips triggers a separate file download per employee. Make sure your browser allows multiple file downloads before proceeding.' },
          { type: 'tip', body: 'Individual employees can download their own payslips under User Reports → My Payslips without needing admin access.' },
        ],
      },
      {
        id: 'leave-utilisation-report',
        title: 'Admin: Leave Utilisation Report',
        summary: 'See leave balances, days taken, and pending requests for every employee.',
        icon: CalendarCheck,
        content: [
          { type: 'text', body: 'The Leave Utilisation report gives HR a full picture of how leave entitlement is being used across the organisation. It is useful for planning, compliance, and spotting patterns.' },
          {
            type: 'steps', heading: 'Generating the report',
            steps: [
              { label: 'Go to Admin Reports.' },
              { label: 'Click "Export CSV" or "Print" on the Leave Utilization card.' },
              { label: 'The report shows one row per employee per leave type, with columns for allocated, used, pending, carried-forward, and remaining days.' },
            ],
          },
          {
            type: 'table',
            headers: ['Column', 'Meaning'],
            rows: [
              ['Allocated',       'Total days for the active leave period'],
              ['Carry-Forward',   'Days rolled over from the prior period'],
              ['Used',            'Days from approved leave applications'],
              ['Pending',         'Days from applications still awaiting approval'],
              ['Remaining',       'Net balance available'],
            ],
          },
        ],
      },
      {
        id: 'headcount-report',
        title: 'Admin: Department Headcount Report',
        summary: 'See how many employees are in each department across the organisation.',
        icon: Users,
        content: [
          { type: 'text', body: 'The Headcount report gives a snapshot of employee distribution by department. It is useful for workforce planning and management reporting.' },
          {
            type: 'steps', heading: 'Viewing the report',
            steps: [
              { label: 'Go to Admin Reports.' },
              { label: 'Click "Export CSV" or "Print" on the Department Headcount card.' },
              { label: 'The report lists each department with the total number of active employees.' },
            ],
          },
          { type: 'tip', body: 'For a visual hierarchy view of departments, see the Organogram under Company.' },
        ],
      },
      {
        id: 'medical-utilisation-report',
        title: 'Admin: Medical Utilisation Report',
        summary: 'View medical claim usage and remaining balances for all employees, grouped by pay grade.',
        icon: Stethoscope,
        content: [
          { type: 'text', body: 'This report lets HR see how much of the medical allowance each employee and pay grade has consumed. It helps with budget monitoring and plan renewals.' },
          {
            type: 'steps', heading: 'Opening the report',
            steps: [
              { label: 'Go to Admin Reports and click "View Report" on the Medical Utilisation card.' },
              { label: 'A modal opens showing each employee with their plan limit, amount used, and balance remaining.' },
              { label: 'Use "Export CSV" or "Print" inside the modal to save the data.' },
            ],
          },
          {
            type: 'table',
            headers: ['Column', 'Description'],
            rows: [
              ['Employee',        'Staff name and ID'],
              ['Pay Grade',       'Assigned salary grade (determines the plan)'],
              ['Annual Limit',    'Maximum claimable for the year'],
              ['Amount Used',     'Total approved claims so far'],
              ['Remaining',       'Balance available for further claims'],
            ],
          },
        ],
      },

      // ── User Reports ──
      {
        id: 'my-payslips',
        title: 'My Reports: Downloading Your Payslips',
        summary: 'Download PDF payslips for any payroll run you were included in.',
        icon: FileText,
        content: [
          { type: 'text', body: 'Every employee can download their own payslips at any time — no admin permission is required.' },
          {
            type: 'steps', heading: 'How to download a payslip',
            steps: [
              { label: 'Go to User Reports (My Reports) from the sidebar.' },
              { label: 'Click "View Payslips" on the My Payslips card.' },
              { label: 'A list of your payroll runs appears. Use the search bar to find a specific month.' },
              { label: 'Click the download icon next to the run to save the PDF to your device.' },
            ],
          },
          { type: 'tip', body: 'Only payroll runs with status "Completed" or "Approved" appear in the list. Draft runs are not available yet.' },
          { type: 'warning', body: 'If your payslip is missing, check with HR that your employee record has been linked to your user account.' },
        ],
      },
      {
        id: 'my-personal-info-summary',
        title: 'My Reports: Personal Info Summary',
        summary: 'Export a CSV of your own profile and demographic details for your records.',
        icon: FileText,
        content: [
          { type: 'text', body: 'The Personal Info Summary lets you export your own HR profile data — useful for personal filing or verifying what the organisation holds about you.' },
          {
            type: 'steps', heading: 'Exporting your summary',
            steps: [
              { label: 'Go to User Reports.' },
              { label: 'Click "Export CSV" or "Print" on the My Personal Info Summary card.' },
              { label: 'The file downloads immediately with your profile fields.' },
            ],
          },
          { type: 'tip', body: 'If any of your information is incorrect, contact HR to update your employee record.' },
        ],
      },
      {
        id: 'my-leave-statement',
        title: 'My Reports: Leave Statement',
        summary: 'Get a full history of your leave applications and current balances.',
        icon: CalendarCheck,
        content: [
          { type: 'text', body: 'The Leave Statement lists every leave application you have submitted — approved, pending, rejected, or cancelled — along with your current balance for each leave type.' },
          {
            type: 'steps', heading: 'Generating your leave statement',
            steps: [
              { label: 'Go to User Reports.' },
              { label: 'Click "Export CSV" or "Print" on the My Leave Statement card.' },
              { label: 'The statement shows one row per leave application and a balance summary at the top.' },
            ],
          },
          { type: 'tip', body: 'For a real-time view of your current balances, use the Leave Entitlement tab under Leave Management.' },
        ],
      },
      {
        id: 'my-tax-documents',
        title: 'My Reports: Tax Documents',
        summary: 'Access your end-of-year tax summary for personal filing purposes.',
        icon: FileText,
        content: [
          { type: 'text', body: 'Tax Documents provides your annual PAYE (Pay As You Earn) summary — the total income, tax deducted, and net pay across all payroll runs in the year. This is the document you need when filing personal income tax returns.' },
          {
            type: 'steps', heading: 'Accessing tax documents',
            steps: [
              { label: 'Go to User Reports.' },
              { label: 'Click "Export CSV" or "Print" on the My Tax Documents card.' },
              { label: 'Select the tax year and download the document.' },
            ],
          },
          { type: 'tip', body: 'Tax documents are available once at least one payroll run for the year has been approved and completed.' },
        ],
      },
      {
        id: 'my-medical-statement',
        title: 'My Reports: Medical Statement',
        summary: 'View your medical plan limit, amount used, balance remaining, and full claim history.',
        icon: Stethoscope,
        content: [
          { type: 'text', body: 'The Medical Statement gives you a complete picture of your medical benefit usage — at a glance and in detail.' },
          {
            type: 'steps', heading: 'Viewing your medical statement',
            steps: [
              { label: 'Go to User Reports.' },
              { label: 'Click "View Statement" on the My Medical Statement card.' },
              { label: 'The modal shows your annual limit, total used, and remaining balance at the top.' },
              { label: 'Scroll down to see a full table of every claim — date, description, amount, and status.' },
              { label: 'Click "Export CSV" or "Print" inside the modal to save the records.' },
            ],
          },
          { type: 'tip', body: 'Claims for your dependents are listed separately. Toggle between "Staff" and "Dependents" in the view to see both.' },
        ],
      },
    ],
  },
];

// ─── Search logic ─────────────────────────────────────────────────────────────

function searchArticles(query: string): { module: HelpModule; article: Article }[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const results: { module: HelpModule; article: Article }[] = [];
  for (const mod of MODULES) {
    for (const art of mod.articles) {
      const haystack = [
        art.title,
        art.summary,
        ...art.content.flatMap(c => {
          if (c.type === 'text' || c.type === 'tip' || c.type === 'warning') return [c.body];
          if (c.type === 'steps') return [c.heading ?? '', ...c.steps.flatMap(s => [s.label, s.detail ?? ''])];
          if (c.type === 'table') return [...c.headers, ...c.rows.flat()];
          return [];
        }),
      ].join(' ').toLowerCase();
      if (haystack.includes(q)) results.push({ module: mod, article: art });
    }
  }
  return results;
}

// ─── Render article content ───────────────────────────────────────────────────

function ArticleContent({ content }: { content: ContentBlock[] }) {
  return (
    <div className="space-y-6">
      {content.map((block, i) => {
        if (block.type === 'text') return (
          <p key={i} className="text-[14px] leading-relaxed text-[var(--text-secondary)]">{block.body}</p>
        );

        if (block.type === 'tip') return (
          <div key={i} className="flex gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100">
            <Lightbulb size={16} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[13px] leading-relaxed text-blue-700">{block.body}</p>
          </div>
        );

        if (block.type === 'warning') return (
          <div key={i} className="flex gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[13px] leading-relaxed text-amber-700">{block.body}</p>
          </div>
        );

        if (block.type === 'steps') return (
          <div key={i} className="space-y-3">
            {block.heading && <p className="text-[13px] font-semibold text-[var(--text-primary)] uppercase tracking-wide">{block.heading}</p>}
            <ol className="space-y-2">
              {block.steps.map((step, si) => (
                <li key={si} className="flex gap-3 items-start">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white mt-0.5"
                    style={{ background: 'var(--accent)' }}>
                    {si + 1}
                  </span>
                  <div>
                    <span className="text-[13px] text-[var(--text-primary)]">{step.label}</span>
                    {step.detail && <p className="text-[12px] text-[var(--text-muted)] mt-0.5">{step.detail}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        );

        if (block.type === 'table') return (
          <div key={i} className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {block.headers.map(h => (
                    <th key={h} className="th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr key={ri} className="tr">
                    {row.map((cell, ci) => (
                      <td key={ci} className={`td ${ci === 0 ? 'font-medium text-[var(--text-primary)]' : ''}`}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

        return null;
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type View =
  | { type: 'home' }
  | { type: 'module'; moduleId: string }
  | { type: 'article'; moduleId: string; articleId: string };

export function Help() {
  const [view, setView]           = useState<View>({ type: 'home' });
  const [query, setQuery]         = useState('');

  const activeModule = MODULES.find(m => view.type !== 'home' && m.id === view.moduleId);
  const activeArticle = activeModule?.articles.find(a => view.type === 'article' && a.id === view.articleId);
  const searchResults = useMemo(() => searchArticles(query), [query]);

  const goHome   = () => { setView({ type: 'home' }); setQuery(''); };
  const goModule = (moduleId: string) => setView({ type: 'module', moduleId });
  const goArticle = (moduleId: string, articleId: string) => setView({ type: 'article', moduleId, articleId });

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--bg)]">

      {/* ── Top bar ── */}
      <div className="shrink-0 bg-[var(--surface)] border-b border-[var(--border)] px-4 sm:px-8 py-4">
        <div className="max-w-4xl mx-auto flex flex-col gap-3">

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
            <button onClick={goHome} className="hover:text-[var(--accent)] transition-colors font-medium">Help Center</button>
            {activeModule && (
              <>
                <ChevronRight size={12} />
                <button onClick={() => goModule(activeModule.id)} className="hover:text-[var(--accent)] transition-colors">{activeModule.title}</button>
              </>
            )}
            {activeArticle && (
              <>
                <ChevronRight size={12} />
                <span className="text-[var(--text-secondary)] truncate max-w-[220px]">{activeArticle.title}</span>
              </>
            )}
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search for anything — leave setup, running payroll, adding employees…"
              className={`${inputClass} !pl-10 !pr-10 w-full shadow-sm`}
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Left nav (shown when a module is selected, hidden on home) */}
        <AnimatePresence>
          {view.type !== 'home' && !query && activeModule && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="hidden lg:flex flex-col border-r border-[var(--border)] bg-[var(--surface)] shrink-0 overflow-hidden"
            >
              <div className="p-4 overflow-y-auto flex-1">
                {/* Back to all modules */}
                <button onClick={goHome} className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-4 transition-colors">
                  <ArrowLeft size={12} /> All modules
                </button>

                {/* Module title */}
                <div className="flex items-center gap-2 mb-4 px-1">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: activeModule.accentBg }}>
                    <activeModule.icon size={13} style={{ color: activeModule.color }} />
                  </div>
                  <span className="text-[13px] font-semibold text-[var(--text-primary)]">{activeModule.title}</span>
                </div>

                {/* Article list */}
                <nav className="space-y-0.5">
                  {activeModule.articles.map(art => {
                    const isActive = view.type === 'article' && view.articleId === art.id;
                    return (
                      <button
                        key={art.id}
                        onClick={() => goArticle(activeModule.id, art.id)}
                        className="w-full text-left px-3 py-2.5 rounded-lg text-[12px] transition-all"
                        style={{
                          background: isActive ? activeModule.accentBg : 'transparent',
                          color:      isActive ? activeModule.color : 'var(--text-secondary)',
                          fontWeight: isActive ? 600 : 400,
                        }}
                      >
                        {art.title}
                      </button>
                    );
                  })}
                </nav>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8">

            {/* ── SEARCH RESULTS ── */}
            {query && (
              <div>
                <p className="text-[13px] text-[var(--text-muted)] mb-5">
                  {searchResults.length === 0
                    ? 'No results found.'
                    : `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''} for "${query}"`}
                </p>
                <div className="space-y-3">
                  {searchResults.map(({ module: mod, article }) => (
                    <button
                      key={article.id}
                      onClick={() => { goArticle(mod.id, article.id); setQuery(''); }}
                      className="w-full text-left bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 hover:border-[var(--accent)] hover:shadow-md transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: mod.accentBg }}>
                          <mod.icon size={13} style={{ color: mod.color }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">{article.title}</p>
                          <p className="text-[12px] text-[var(--text-muted)] mt-0.5">{mod.title}</p>
                          <p className="text-[12px] text-[var(--text-secondary)] mt-1 line-clamp-2">{article.summary}</p>
                        </div>
                        <ChevronRight size={14} className="text-[var(--text-muted)] shrink-0 mt-0.5 group-hover:text-[var(--accent)] transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── HOME: module cards ── */}
            {!query && view.type === 'home' && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                {/* Hero */}
                <div className="text-center mb-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--accent-dim)] text-[var(--accent)] text-[12px] font-semibold mb-4">
                    <Sparkles size={12} /> Help Center
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] font-display">How can we help you?</h1>
                  <p className="text-[14px] text-[var(--text-muted)] mt-2">Browse by module or search for a specific task.</p>
                </div>

                {/* Module cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {MODULES.map((mod, i) => (
                    <motion.button
                      key={mod.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      onClick={() => goModule(mod.id)}
                      className="text-left bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 hover:shadow-md hover:border-opacity-0 transition-all group overflow-hidden relative"
                    >
                      {/* Accent stripe */}
                      <div className="absolute inset-y-0 left-0 w-1 rounded-l-2xl" style={{ background: mod.color }} />
                      <div className="pl-3">
                        <div className="flex items-center justify-between mb-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: mod.accentBg }}>
                            <mod.icon size={18} style={{ color: mod.color }} />
                          </div>
                          <span className="text-[11px] text-[var(--text-muted)] font-medium">{mod.articles.length} articles</span>
                        </div>
                        <h3 className="text-[15px] font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">{mod.title}</h3>
                        <p className="text-[12px] text-[var(--text-muted)] mt-1 leading-relaxed">{mod.description}</p>
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {mod.articles.slice(0, 3).map(a => (
                            <span key={a.id} className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-muted)] bg-[var(--surface-hover)]">
                              {a.title}
                            </span>
                          ))}
                          {mod.articles.length > 3 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full text-[var(--text-muted)]">+{mod.articles.length - 3} more</span>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── MODULE: article list ── */}
            {!query && view.type === 'module' && activeModule && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                {/* Module header */}
                <div className="flex items-center gap-3 mb-6">
                  <button onClick={goHome} className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors">
                    <ArrowLeft size={16} className="text-[var(--text-muted)]" />
                  </button>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: activeModule.accentBg }}>
                    <activeModule.icon size={20} style={{ color: activeModule.color }} />
                  </div>
                  <div>
                    <h2 className="text-[18px] font-bold text-[var(--text-primary)]">{activeModule.title}</h2>
                    <p className="text-[12px] text-[var(--text-muted)]">{activeModule.articles.length} articles</p>
                  </div>
                </div>

                {/* Article list */}
                <div className="space-y-2">
                  {activeModule.articles.map((art, i) => (
                    <motion.button
                      key={art.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => goArticle(activeModule.id, art.id)}
                      className="w-full text-left bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 hover:border-[var(--accent)] hover:shadow-sm transition-all group flex items-center gap-4"
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: activeModule.accentBg }}>
                        <BookOpen size={14} style={{ color: activeModule.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">{art.title}</p>
                        <p className="text-[12px] text-[var(--text-muted)] mt-0.5 truncate">{art.summary}</p>
                      </div>
                      <ChevronRight size={14} className="text-[var(--text-muted)] shrink-0 group-hover:text-[var(--accent)] transition-colors" />
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── ARTICLE VIEW ── */}
            {!query && view.type === 'article' && activeModule && activeArticle && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                {/* Article header */}
                <div className="mb-6">
                  <button
                    onClick={() => goModule(activeModule.id)}
                    className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors mb-4"
                  >
                    <ArrowLeft size={12} /> Back to {activeModule.title}
                  </button>

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: activeModule.accentBg }}>
                      <BookOpen size={18} style={{ color: activeModule.color }} />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: activeModule.color }}>{activeModule.title}</p>
                      <h2 className="text-[20px] font-bold text-[var(--text-primary)] leading-snug">{activeArticle.title}</h2>
                      <p className="text-[13px] text-[var(--text-muted)] mt-1.5">{activeArticle.summary}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-[var(--border)] pt-6">
                  <ArticleContent content={activeArticle.content} />
                </div>

                {/* Next / prev article navigation */}
                {(() => {
                  const articles = activeModule.articles;
                  const idx = articles.findIndex(a => a.id === activeArticle.id);
                  const prev = articles[idx - 1];
                  const next = articles[idx + 1];
                  if (!prev && !next) return null;
                  return (
                    <div className="flex gap-3 mt-10 pt-6 border-t border-[var(--border)]">
                      {prev && (
                        <button
                          onClick={() => goArticle(activeModule.id, prev.id)}
                          className="flex-1 text-left bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 hover:border-[var(--accent)] transition-all group"
                        >
                          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">← Previous</p>
                          <p className="text-[13px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">{prev.title}</p>
                        </button>
                      )}
                      {next && (
                        <button
                          onClick={() => goArticle(activeModule.id, next.id)}
                          className="flex-1 text-right bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 hover:border-[var(--accent)] transition-all group"
                        >
                          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Next →</p>
                          <p className="text-[13px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">{next.title}</p>
                        </button>
                      )}
                    </div>
                  );
                })()}
              </motion.div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
