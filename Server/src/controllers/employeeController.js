const { prisma } = require('../helpers/dbQueryHelper');
const asyncHandler = require('../middleware/asyncHandler');
const respond = require('../helpers/respondHelper');
const { generateRefNumber } = require('../helpers/enrollmentHelper');
const crypto = require('crypto');
const fs   = require('fs');
const path = require('path');
const { title } = require('process');
const { profile } = require('console');

/* ─────────────────────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────────────────────── */

/**
 * Terminal statuses — no transitions allowed once reached.
 */
const FINAL_STATUSES = ['TERMINATED', 'RETIRED'];

/**
 * Legal transition map.
 * Keep this in sync with STATUS_TRANSITIONS in EmployeeManagement.tsx.
 */
const ALLOWED_TRANSITIONS = {
    ACTIVE:     new Set(['INACTIVE', 'SUSPENDED', 'TERMINATED', 'RETIRED']),
    INACTIVE:   new Set(['ACTIVE', 'TERMINATED', 'RETIRED']),
    SUSPENDED:  new Set(['ACTIVE', 'TERMINATED']),
    TERMINATED: new Set(),
    RETIRED:    new Set(),
};

/**
 * Status changes that effectively stop the employee from working.
 * Triggers the teaching-assignment warning check unless `force: true` is passed.
 */
const REQUIRES_REASSIGNMENT_CHECK = new Set(['INACTIVE', 'SUSPENDED', 'TERMINATED', 'RETIRED']);

/**
 * Status changes that require a reason to be provided.
 */
const REQUIRES_REASON = new Set(['SUSPENDED', 'TERMINATED']);


/** Employee fields editable via the standard edit form */
const EDITABLE_EMPLOYEE_FIELDS = [
    'firstName', 'middleName', 'lastName', 'phone', 'email',
    'address', 'city', 'qualification', 'ssnit',
    'accountNumber', 'bankName', 'momoNumber',
    'yearsOfExperience',
    'jobTitleId', 'departmentId', 'employmentTypeId',
    'nationalityId', 'religionId',
];

/** Emergency contact fields editable via the edit form */
const EDITABLE_CONTACT_FIELDS = [
    'firstName', 'lastName', 'relationship',
    'phone', 'email', 'occupation', 'address', 'isPrimary',
];

/** Valid emergency contact relationship values — must match Prisma enum */
const VALID_CONTACT_RELATIONSHIPS = [
    'FATHER', 'MOTHER', 'SPOUSE', 'SIBLING', 'CHILD',
    'LEGAL_GUARDIAN', 'GRANDPARENT', 'UNCLE', 'AUNT', 'FRIEND', 'OTHER',
];

/** Valid employee gender values — must match Prisma enum */
const GENDER_VALUES = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'];

/** Valid marital status values — must match Prisma enum */
const MARITAL_STATUS_VALUES = ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED'];

/**
 * Standard include block reused across every employee query.
 * Code list relations are resolved as { id, label, code }.
 * Emergency contacts ordered primary-first, then alphabetical.
 * Status history ordered newest-first.
 */
const EMPLOYEE_INCLUDE = {
    jobTitle:       { select: { id: true, label: true, code: true } },
    department:     { select: { id: true, label: true, code: true } },
    employmentType: { select: { id: true, label: true, code: true } },
    nationality:    { select: { id: true, label: true, code: true } },
    religion:       { select: { id: true, label: true, code: true } },

    emergencyContacts: {
        orderBy: [
            { isPrimary: 'desc' },
            { firstName: 'asc'  },
        ],
    },

    teacher: {
        select: {
            id:          true,
            staffNumber: true,
            teachersubject: {
                select: {
                    id:         true,
                    subject:    { select: { id: true, name: true, code: true } },
                    gradelevel: { select: { id: true, name: true } },
                },
            },
            gradelevel: { select: { id: true, name: true } },
        },
    },

    user: { select: { id: true, username: true, status: true } },

    statusHistory: {
        orderBy: { changedAt: 'desc' },
    },
};

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────────── */

/**
 * Returns an error string if the transition is illegal, null if valid.
 */
function validateTransition(currentStatus, newStatus) {
    if (currentStatus === newStatus) {
        return 'Employee already has this status.';
    }
    if (FINAL_STATUSES.includes(currentStatus)) {
        return `Cannot change status — ${currentStatus} is a final status with no further transitions.`;
    }
    const allowed = ALLOWED_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.has(newStatus)) {
        return `Transition from ${currentStatus} to ${newStatus} is not permitted.`;
    }
    return null;
}

/**
 * Picks only allowlisted fields from a plain object.
 * Empty strings are coerced to null so the DB stores NULL, not ''.
 */
function pickFields(body, allowList) {
    return allowList.reduce((acc, key) => {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
            acc[key] = body[key] === '' ? null : body[key];
        }
        return acc;
    }, {});
}

/**
 * Coerces a value to a known enum or returns the fallback.
 */
function toEnum(value, validValues, fallback) {
    if (!value) return fallback;
    const upper = String(value).toUpperCase();
    return validValues.includes(upper) ? upper : fallback;
}

/**
 * Generate next employee code.
 * Pattern: EMP-{00001}
 */
async function generateEmployeeCode(tx) {
    return generateRefNumber(tx.employee, 'EMP', 'employeeCode');
}

/**
 * Build the public URL for an uploaded file.
 * Returns null for missing files.
 */
function fileUrl(file) {
    return file ? `/uploads/employees/${file.filename}` : null;
}

/**
 * Validate that all provided code list value IDs exist and are active.
 * Returns a list of missing/inactive IDs for error reporting, or empty array if all valid.
 */
async function validateCodeListValues(tx, ids) {
    const clean = ids.filter(Boolean);
    if (clean.length === 0) return [];
    const found = await tx.codeListValue.findMany({
        where: { id: { in: clean }, isActive: true },
        select: { id: true },
    });
    const foundIds = new Set(found.map(v => v.id));
    return clean.filter(id => !foundIds.has(id));
}

/**
 * Shape an employee record so the frontend receives consistent { id, name, code }
 * objects for every code list relation.
 */
function shapeEmployee(emp) {
    if (!emp) return null;
    const mapCL = (cv) => (cv ? { id: cv.id, name: cv.label, code: cv.code } : null);
    return {
        ...emp,
        jobTitle:       mapCL(emp.jobTitle),
        department:     mapCL(emp.department),
        employmentType: mapCL(emp.employmentType),
        nationality:    mapCL(emp.nationality),
        religion:       mapCL(emp.religion),
    };
}

/* ─────────────────────────────────────────────────────────────────────────────
   CONTROLLERS
───────────────────────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────────────────────
   @desc    Create a new employee with emergency contacts.
            Files (CV, transcript, certificate) uploaded via multer middleware.
            If jobTitle code is TE, a matching teacher profile is created atomically,
            reusing employeeCode as staffNumber.

   @route   POST /api/employees
   @access  Private  (admin / HR only)

   Request body (multipart/form-data)
   ──────────────────────────────────
   Required:
     firstName, lastName, phone, email, jobTitleId

   Optional personal:
     middleName, dateOfBirth, gender, nationalityId, religionId,
     address, city

   Optional employment:
     departmentId, employmentTypeId, qualification, yearsOfExperience,
     ssnit, hireDate

   Optional financial:
     accountNumber, bankName, momoNumber

   Optional files (req.files from multer):
     cvFile, transcriptFile, certificateFile

   Emergency contacts (required — at least one):
     emergencyContacts: JSON string of [
       { firstName, lastName, phone, relationship,
         email?, occupation?, address?, isPrimary? }
     ]
───────────────────────────────────────────────────────────────────────────── */
const createEmployee = asyncHandler(async (req, res) => {
    const data = req.body;

    /* ── 1. Validate required fields ──────────────────────────────────────── */
    const missingFields = [];
    if (!data.firstName)   missingFields.push('firstName');
    if (!data.lastName)    missingFields.push('lastName');
    if (!data.phone)       missingFields.push('phone');
    if (!data.email)       missingFields.push('email');
    if (!data.jobTitleId)  missingFields.push('jobTitleId');

    if (missingFields.length > 0) {
        return respond.badReq(res, `Missing required field(s): ${missingFields.join(', ')}`);
    }

    /* ── 2. Parse and validate emergency contacts ─────────────────────────── */
    let contacts;
    try {
        contacts = data.emergencyContacts ? JSON.parse(data.emergencyContacts) : [];
    } catch {
        return respond.badReq(res, 'Invalid emergencyContacts format — must be a JSON array');
    }

    if (!Array.isArray(contacts) || contacts.length === 0) {
        return respond.badReq(res, 'At least one emergency contact is required');
    }

    for (const c of contacts) {
        if (!c.firstName || !c.lastName || !c.phone || !c.relationship) {
            return respond.badReq(
                res,
                'Each emergency contact must have firstName, lastName, phone, and relationship'
            );
        }
        if (!VALID_CONTACT_RELATIONSHIPS.includes(c.relationship)) {
            return respond.badReq(
                res,
                `Contact relationship must be one of: ${VALID_CONTACT_RELATIONSHIPS.join(', ')}`
            );
        }
    }

    // Ensure exactly one primary contact
    const primaryCount = contacts.filter(c => c.isPrimary).length;
    if (primaryCount === 0) {
        contacts[0].isPrimary = true;
    } else if (primaryCount > 1) {
        const firstPrimaryIdx = contacts.findIndex(c => c.isPrimary);
        contacts = contacts.map((c, i) => ({ ...c, isPrimary: i === firstPrimaryIdx }));
    }

    /* ── 3. Parse dates ───────────────────────────────────────────────────── */
    let dob = null;
    if (data.dateOfBirth) {
        const parsed = new Date(data.dateOfBirth);
        if (isNaN(parsed.getTime())) {
            return respond.badReq(res, 'Invalid dateOfBirth — use an ISO-parseable date');
        }
        dob = parsed.toISOString();
    }
   
    /* ── 3. Parse dates ───────────────────────────────────────────────────── */
    let rod = null;
    if (data.retirementDate) {
        const parsed = new Date(data.retirementDate);
        if (isNaN(parsed.getTime())) {
            return respond.badReq(res, 'Invalid retirementDate — use an ISO-parseable date');
        }
        rod = parsed.toISOString();
    }

    let hireDate = new Date();
    if (data.hireDate) {
        const parsed = new Date(data.hireDate);
        if (isNaN(parsed.getTime())) {
            return respond.badReq(res, 'Invalid hireDate — use an ISO-parseable date');
        }
        hireDate = parsed;
    }

    /* ── 4. Uniqueness checks (clearer errors than raw FK failures) ───────── */
    const dupe = await prisma.employee.findFirst({
        where: {
            OR: [
                { homePhone: data.homePhone.trim() },
                { mobilePhone: data.mobilePhone.trim() },
                { email: data.email.trim().toLowerCase() },
            ],
        },
        select: { homePhone: true, mobilePhone: true, email: true },
    });


    if (dupe) {
        const field = dupe.homePhone === data.homePhone.trim() ? 'homePhone' : dupe.mobilePhone === data.mobilePhone.trim() ? 'mobilePhone' : 'email';
        return respond.badReq(res, `An employee with this ${field} already exists`);
    }

    /* ── 5. Extract uploaded files ────────────────────────────────────────── */
    const fit_and_proper          = req.files?.fit_and_proper?.[0];
    const policeClearance  = req.files?.policeClearance?.[0];
    const medicalClearance = req.files?.medicalClearance?.[0];

    /* ── 6. Resolve acting user ───────────────────────────────────────────── */
    const actorId = req.user?.id?.toString() ?? 'SYSTEM';

    /* ── 7. Run full pipeline atomically ──────────────────────────────────── */
    try {
        const newEmployeeId = await prisma.$transaction(async (tx) => {

            /* 7a. Validate all code list IDs exist and are active */
            const invalidIds = await validateCodeListValues(tx, [
                data.jobTitleId,
                data.departmentId,
                data.employmentTypeId,
                data.nationalityId,
                data.religionId,
            ]);
            if (invalidIds.length > 0) {
                throw new Error(`One or more selected options are invalid or inactive`);
            }

            

            /* 7c. Generate employee code */
            const employee_id = await generateEmployeeCode(tx);

            /* 7d. Create employee + emergency contacts + initial status history */
            const employee = await tx.employee.create({
                data: {
                    id:            crypto.randomUUID(),
                    employee_id,
                    title:         data.title?.trim() || null,
                    first_name:     data.firstName.trim(),
                    last_name:      data.lastName.trim(),
                    middle_name:    data.middleName?.trim() || null,
                    nationality:    data.nationalityId    || null,
                    religion:       data.religionId       || null,
                    birthday:   dob,
                    profile_image: fileUrl(req.files?.profilePicture?.[0]),
                    place_of_birth:   data.placeOfBirth?.trim() || null,
                    spouse_name:   data.spouseName?.trim() || null,
                    father_name:   data.fatherName?.trim() || null,
                    mother_name:   data.motherName?.trim() || null, 
                    retirement_date:   rod,
                    gender:        data.gender ? toEnum(data.gender, GENDER_VALUES, null) : null,
                    marital_status: data.maritalStatus ? toEnum(data.maritalStatus, MARITAL_STATUS_VALUES, null) : null,
                    religionId:       data.religionId       || null,
                    nxt_kin_name:   data.nxt_kin_name,
                    nxt_kin_email:  data.nxt_kin_email,
                    nxt_kin_address: data.nxt_kin_address,
                    nxt_kin_phone:   data.nxt_kin_phone,
                    bank_name:      data.bankName?.trim() || null,
                    bank_acc_no:   data.accountNumber?.trim() || null,
                    tin_no:          data.tinNumber?.trim() || null,
                    staff_level:   data.staffLevel?.trim(),
                    staff_role:    data.staffRole?.trim(),
                    ssn_num:       data.ssnit?.trim() || null,
                    nic_num:       data.nicNumber?.trim() || null,
                    nin_expiry:    data.ninExpiry ? new Date(data.ninExpiry) : null,
                    nin_issue_date: data.ninIssueDate ? new Date(data.ninIssueDate) : null,
                    fit_and_proper:          fileUrl(fit_and_proper),
                    policeClearance:  fileUrl(policeClearance),
                    medicalClearance: fileUrl(medicalClearance),
                    driving_license: data.drivingLicense?.trim() || null,
                    employment_status: data.employmentStatus?.trim() || null,
                    job_title:       data.jobTitleId,
                    pay_grade:       data.payGrade?.trim() || null,
                    notches:       data.notches?.trim() || null,
                    address1:      data.address1?.trim() || null, 
                    address2:      data.address2?.trim() || null,
                    city:          data.city?.trim() || null,
                    country:       data.country?.trim() || null,
                    postal_code:   data.postalCode?.trim() || null,
                    home_phone:     data.homePhone?.trim() || null,
                    mobile_phone:   data.mobilePhone?.trim() || null,
                    work_email:         data.workEmail.trim().toLowerCase(),
                    private_email:         data.privateEmail.trim().toLowerCase(),
                    phone:         data.phone.trim(),
                    recruitment_date: data.recruitmentDate || null,
                    confirmation_date: data.confirmationDate || null,
                    supervisor:   data.supervisorId || null,
                    department:     data.departmentId     || null,
                    branch:     data.branchId     || null,
                    unit:     data.unitId     || null,
                    posted_by:     actorId,

                    // Initial status history entry
                    statusHistory: {
                        create: {
                            id:          crypto.randomUUID(),
                            fromStatus:  null,
                            toStatus:    'ACTIVE',
                            changedById: actorId,
                            reason:      data.notes || 'Employee created',
                            changedAt:   new Date(),
                        },
                    },
                },
            });

            return employee.id;
        });

        /* ── 8. Re-fetch the complete record outside the transaction ──────── */
        const created = await prisma.employee.findUnique({
            where:   { id: newEmployeeId },
            include: EMPLOYEE_INCLUDE,
        });

        return respond.created(res, 'Employee created successfully', shapeEmployee(created));

    } catch (err) {
        // Map Prisma unique-constraint errors to cleaner 400s
        if (err.code === 'P2002') {
            return respond.badReq(res, 'An employee with this phone or email already exists');
        }
        return respond.error(res, 'Failed to create employee', err);
    }
});

/* ─────────────────────────────────────────────────────────────────────────────
   @desc    Get all employees
   @route   GET /api/employees
   @access  Private

   Query params (all optional):
     status  — filter by EmployeeStatus
     search  — matches firstName, lastName, employeeCode, or email
───────────────────────────────────────────────────────────────────────────── */
const getAllEmployees = asyncHandler(async (req, res) => {
    const { status, search } = req.query;

    try {
        const where = {};
        if (status) where.status = status;
        if (search) {
            where.OR = [
                { firstName:    { contains: search } },
                { lastName:     { contains: search } },
                { employee_id: { contains: search } },
                { email:        { contains: search } },
            ];
        }

        const employees = await prisma.employee.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: EMPLOYEE_INCLUDE,
        });

        return respond.ok(res, 'Employees retrieved successfully', employees.map(shapeEmployee));
    } catch (err) {
        return respond.error(res, 'Failed to fetch employees', err);
    }
});

/* ─────────────────────────────────────────────────────────────────────────────
   @desc    Get a single employee by ID
   @route   GET /api/employees/:id
   @access  Private
───────────────────────────────────────────────────────────────────────────── */
const getEmployeeById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
        const employee = await prisma.employee.findUnique({
            where:   { id },
            include: EMPLOYEE_INCLUDE,
        });

        if (!employee) return respond.notFound(res, 'Employee not found');

        return respond.ok(res, 'Employee retrieved successfully', shapeEmployee(employee));
    } catch (err) {
        return respond.error(res, 'Failed to fetch employee', err);
    }
});

/* ─────────────────────────────────────────────────────────────────────────────
   @desc    Get a summary of an employee's teaching assignments.
            Used by the frontend BEFORE destructive status changes to show
            "what needs reassigning".
   @route   GET /api/employees/:id/assignments
   @access  Private
───────────────────────────────────────────────────────────────────────────── */
const getEmployeeAssignments = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
        const employee = await prisma.employee.findUnique({
            where: { id },
            select: {
                id: true,
                teacher: {
                    select: {
                        id:          true,
                        staffNumber: true,
                        teachersubject: {
                            select: {
                                id:         true,
                                subject:    { select: { id: true, name: true, code: true } },
                                gradelevel: { select: { id: true, name: true } },
                            },
                        },
                        gradelevel: { select: { id: true, name: true } },
                    },
                },
                user: { select: { id: true, email: true, status: true } },
            },
        });

        if (!employee) return respond.notFound(res, 'Employee not found');

        const t = employee.teacher;
        const subjects = t?.teachersubject ?? [];
        const classTeacherOf = t?.gradelevel ?? [];

        return respond.ok(res, 'Assignments retrieved successfully', {
            isTeacher:       !!t,
            teacherId:       t?.id ?? null,
            staffNumber:     t?.staffNumber ?? null,
            hasUserAccount:  !!employee.user,
            subjectsTaught:  subjects.map(ts => ({
                teacherSubjectId: ts.id,
                subject:    ts.subject,
                gradelevel: ts.gradelevel,
            })),
            classTeacherOf:  classTeacherOf.map(g => ({ id: g.id, name: g.name })),
            totalAssignments: subjects.length + classTeacherOf.length,
        });
    } catch (err) {
        return respond.error(res, 'Failed to load assignments', err);
    }
});


/* ─────────────────────────────────────────────────────────────────────────────
   @desc    Update employee personal / employment / financial / documents.
            Accepts multipart/form-data so profile picture and document files
            can be replaced. Old files are deleted from disk when replaced.
   @route   PUT /api/employees/:id
   @access  Private

   Body (multipart/form-data — all fields optional, send only what changed):

   Personal:
     title, firstName, middleName, lastName, gender, dateOfBirth,
     placeOfBirth, spouseName, fatherName, motherName, maritalStatus,
     nationalityId, religionId

   Contact:
     homePhone, mobilePhone, workEmail, privateEmail, phone,
     address1, address2, city, country, postalCode

   Employment:
     jobTitleId, departmentId, branchId, unitId, supervisorId,
     staffLevel, staffRole, payGrade, notches, employmentStatus,
     recruitmentDate, confirmationDate, retirementDate

   Financial:
     bankName, accountNumber, tinNumber, ssnit, nicNumber,
     ninExpiry, ninIssueDate, drivingLicense, momoNumber

   Next of kin:
     nxt_kin_name, nxt_kin_email, nxt_kin_address, nxt_kin_phone

   Files (optional — replaces existing):
     profilePicture, fit_and_proper, policeClearance, medicalClearance

   Notes:
     notes
───────────────────────────────────────────────────────────────────────────── */
const updateEmployee = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
        /* ── 1. Load existing employee ────────────────────────────────────── */
        const employee = await prisma.employee.findUnique({ where: { id } });
        if (!employee) return respond.notFound(res, 'Employee not found');

        const data = req.body;

        /* ── 2. Validate required fields if provided ──────────────────────── */
        if ('firstName' in data && !data.firstName?.trim()) {
            return respond.badReq(res, 'First name cannot be empty');
        }
        if ('lastName' in data && !data.lastName?.trim()) {
            return respond.badReq(res, 'Last name cannot be empty');
        }

        /* ── 3. Uniqueness checks for phone/email if they are being changed ── */
        const phoneEmailChecks = [];

        if ('homePhone' in data && data.homePhone?.trim()) {
            phoneEmailChecks.push({ home_phone: data.homePhone.trim() });
        }
        if ('mobilePhone' in data && data.mobilePhone?.trim()) {
            phoneEmailChecks.push({ mobile_phone: data.mobilePhone.trim() });
        }
        if ('workEmail' in data && data.workEmail?.trim()) {
            phoneEmailChecks.push({ work_email: data.workEmail.trim().toLowerCase() });
        }
        if ('privateEmail' in data && data.privateEmail?.trim()) {
            phoneEmailChecks.push({ private_email: data.privateEmail.trim().toLowerCase() });
        }

        if (phoneEmailChecks.length > 0) {
            const dupe = await prisma.employee.findFirst({
                where: {
                    AND: [
                        { id: { not: id } },
                        { OR: phoneEmailChecks },
                    ],
                },
                select: { home_phone: true, mobile_phone: true, work_email: true, private_email: true },
            });

            if (dupe) {
                let field = 'contact detail';
                if (data.homePhone?.trim()    && dupe.home_phone    === data.homePhone.trim())    field = 'homePhone';
                if (data.mobilePhone?.trim()  && dupe.mobile_phone  === data.mobilePhone.trim())  field = 'mobilePhone';
                if (data.workEmail?.trim()    && dupe.work_email    === data.workEmail.trim().toLowerCase())    field = 'workEmail';
                if (data.privateEmail?.trim() && dupe.private_email === data.privateEmail.trim().toLowerCase()) field = 'privateEmail';
                return respond.badReq(res, `An employee with this ${field} already exists`);
            }
        }

        /* ── 4. Parse and validate dates ──────────────────────────────────── */
        let dob = undefined;
        if ('dateOfBirth' in data) {
            if (data.dateOfBirth) {
                const parsed = new Date(data.dateOfBirth);
                if (isNaN(parsed.getTime())) return respond.badReq(res, 'Invalid dateOfBirth — use an ISO-parseable date');
                dob = parsed.toISOString();
            } else {
                dob = null;
            }
        }

        let rod = undefined;
        if ('retirementDate' in data) {
            if (data.retirementDate) {
                const parsed = new Date(data.retirementDate);
                if (isNaN(parsed.getTime())) return respond.badReq(res, 'Invalid retirementDate — use an ISO-parseable date');
                rod = parsed.toISOString();
            } else {
                rod = null;
            }
        }

        let recruitmentDate = undefined;
        if ('recruitmentDate' in data) {
            if (data.recruitmentDate) {
                const parsed = new Date(data.recruitmentDate);
                if (isNaN(parsed.getTime())) return respond.badReq(res, 'Invalid recruitmentDate');
                recruitmentDate = parsed;
            } else {
                recruitmentDate = null;
            }
        }

        let confirmationDate = undefined;
        if ('confirmationDate' in data) {
            if (data.confirmationDate) {
                const parsed = new Date(data.confirmationDate);
                if (isNaN(parsed.getTime())) return respond.badReq(res, 'Invalid confirmationDate');
                confirmationDate = parsed;
            } else {
                confirmationDate = null;
            }
        }

        let ninExpiry = undefined;
        if ('ninExpiry' in data) {
            ninExpiry = data.ninExpiry ? new Date(data.ninExpiry) : null;
        }

        let ninIssueDate = undefined;
        if ('ninIssueDate' in data) {
            ninIssueDate = data.ninIssueDate ? new Date(data.ninIssueDate) : null;
        }

        /* ── 5. Validate code list IDs if provided ────────────────────────── */
        const clIds = [
            data.jobTitleId,
            data.departmentId,
            data.nationalityId,
            data.religionId,
        ].filter(Boolean);

        if (clIds.length > 0) {
            const invalid = await validateCodeListValues(prisma, clIds);
            if (invalid.length > 0) {
                return respond.badReq(res, 'One or more selected options are invalid or inactive');
            }
        }

        /* ── 6. Handle file replacements ──────────────────────────────────── */
        const filesToDelete = [];

        const profilePicture   = req.files?.profilePicture?.[0];
        const fit_and_proper   = req.files?.fit_and_proper?.[0];
        const policeClearance  = req.files?.policeClearance?.[0];
        const medicalClearance = req.files?.medicalClearance?.[0];

        const fileUpdates = {};

        if (profilePicture) {
            if (employee.profile_image) filesToDelete.push(employee.profile_image);
            fileUpdates.profile_image = fileUrl(profilePicture);
        }
        if (fit_and_proper) {
            if (employee.fit_and_proper) filesToDelete.push(employee.fit_and_proper);
            fileUpdates.fit_and_proper = fileUrl(fit_and_proper);
        }
        if (policeClearance) {
            if (employee.policeClearance) filesToDelete.push(employee.policeClearance);
            fileUpdates.policeClearance = fileUrl(policeClearance);
        }
        if (medicalClearance) {
            if (employee.medicalClearance) filesToDelete.push(employee.medicalClearance);
            fileUpdates.medicalClearance = fileUrl(medicalClearance);
        }

        /* ── 7. Build the update payload — only include fields present in body */
        const updateData = {
            ...fileUpdates,
            updatedAt: new Date(),
        };

        // Personal
        if ('title'         in data) updateData.title          = data.title?.trim()         || null;
        if ('firstName'     in data) updateData.first_name     = data.firstName.trim();
        if ('middleName'    in data) updateData.middle_name    = data.middleName?.trim()     || null;
        if ('lastName'      in data) updateData.last_name      = data.lastName.trim();
        if ('gender'        in data) updateData.gender         = data.gender ? toEnum(data.gender, GENDER_VALUES, null) : null;
        if ('maritalStatus' in data) updateData.marital_status = data.maritalStatus ? toEnum(data.maritalStatus, MARITAL_STATUS_VALUES, null) : null;
        if ('placeOfBirth'  in data) updateData.place_of_birth = data.placeOfBirth?.trim()  || null;
        if ('spouseName'    in data) updateData.spouse_name    = data.spouseName?.trim()     || null;
        if ('fatherName'    in data) updateData.father_name    = data.fatherName?.trim()     || null;
        if ('motherName'    in data) updateData.mother_name    = data.motherName?.trim()     || null;
        if ('nationalityId' in data) updateData.nationality    = data.nationalityId          || null;
        if ('religionId'    in data) updateData.religion       = data.religionId             || null;

        // Dates
        if (dob          !== undefined) updateData.birthday          = dob;
        if (rod          !== undefined) updateData.retirement_date   = rod;
        if (recruitmentDate  !== undefined) updateData.recruitment_date  = recruitmentDate;
        if (confirmationDate !== undefined) updateData.confirmation_date = confirmationDate;
        if (ninExpiry    !== undefined) updateData.nin_expiry         = ninExpiry;
        if (ninIssueDate !== undefined) updateData.nin_issue_date     = ninIssueDate;

        // Contact
        if ('homePhone'    in data) updateData.home_phone    = data.homePhone?.trim()                      || null;
        if ('mobilePhone'  in data) updateData.mobile_phone  = data.mobilePhone?.trim()                    || null;
        if ('phone'        in data) updateData.phone         = data.phone?.trim()                          || null;
        if ('workEmail'    in data) updateData.work_email    = data.workEmail?.trim().toLowerCase()        || null;
        if ('privateEmail' in data) updateData.private_email = data.privateEmail?.trim().toLowerCase()     || null;
        if ('address1'     in data) updateData.address1      = data.address1?.trim()                       || null;
        if ('address2'     in data) updateData.address2      = data.address2?.trim()                       || null;
        if ('city'         in data) updateData.city          = data.city?.trim()                           || null;
        if ('country'      in data) updateData.country       = data.country?.trim()                        || null;
        if ('postalCode'   in data) updateData.postal_code   = data.postalCode?.trim()                     || null;

        // Employment
        if ('jobTitleId'       in data) updateData.job_title         = data.jobTitleId          || null;
        if ('departmentId'     in data) updateData.department        = data.departmentId        || null;
        if ('branchId'         in data) updateData.branch            = data.branchId            || null;
        if ('unitId'           in data) updateData.unit              = data.unitId              || null;
        if ('supervisorId'     in data) updateData.supervisor        = data.supervisorId        || null;
        if ('staffLevel'       in data) updateData.staff_level       = data.staffLevel?.trim()  || null;
        if ('staffRole'        in data) updateData.staff_role        = data.staffRole?.trim()   || null;
        if ('payGrade'         in data) updateData.pay_grade         = data.payGrade?.trim()    || null;
        if ('notches'          in data) updateData.notches           = data.notches?.trim()     || null;
        if ('employmentStatus' in data) updateData.employment_status = data.employmentStatus?.trim() || null;

        // Financial / ID
        if ('bankName'       in data) updateData.bank_name      = data.bankName?.trim()      || null;
        if ('accountNumber'  in data) updateData.bank_acc_no    = data.accountNumber?.trim() || null;
        if ('tinNumber'      in data) updateData.tin_no         = data.tinNumber?.trim()     || null;
        if ('ssnit'          in data) updateData.ssn_num        = data.ssnit?.trim()         || null;
        if ('nicNumber'      in data) updateData.nic_num        = data.nicNumber?.trim()     || null;
        if ('drivingLicense' in data) updateData.driving_license= data.drivingLicense?.trim()|| null;
        if ('momoNumber'     in data) updateData.momo_number    = data.momoNumber?.trim()    || null;

        // Next of kin
        if ('nxt_kin_name'    in data) updateData.nxt_kin_name    = data.nxt_kin_name    || null;
        if ('nxt_kin_email'   in data) updateData.nxt_kin_email   = data.nxt_kin_email   || null;
        if ('nxt_kin_address' in data) updateData.nxt_kin_address = data.nxt_kin_address || null;
        if ('nxt_kin_phone'   in data) updateData.nxt_kin_phone   = data.nxt_kin_phone   || null;

        // Notes / misc
        if ('notes' in data) updateData.notes = data.notes?.trim() || null;

        /* ── 8. Bail early if nothing actually changed ─────────────────────── */
        // Only updatedAt in payload means no real fields were sent
        if (Object.keys(updateData).length <= 1) {
            return respond.badReq(res, 'No changes provided');
        }

        /* ── 9. Execute update ────────────────────────────────────────────── */
        await prisma.employee.update({
            where: { id },
            data:  updateData,
        });

        /* ── 10. Delete replaced files from disk (non-blocking) ───────────── */
        for (const url of filesToDelete) {
            const filename = url.split('/').pop();
            if (filename) {
                const filePath = path.join(process.cwd(), 'uploads', 'employees', filename);
                fs.unlink(filePath, (err) => {
                    if (err) console.warn(`Failed to delete old file ${filePath}:`, err.message);
                });
            }
        }

        /* ── 11. Return the full refreshed record ─────────────────────────── */
        const refreshed = await prisma.employee.findUnique({
            where:   { id },
            include: EMPLOYEE_INCLUDE,
        });

        return respond.ok(res, 'Employee updated successfully', shapeEmployee(refreshed));

    } catch (err) {
        if (err.code === 'P2002') {
            return respond.badReq(res, 'Phone or email already in use by another employee');
        }
        return respond.error(res, 'Failed to update employee', err);
    }
});

/* ─────────────────────────────────────────────────────────────────────────────
   @desc    Change employee status with full audit trail.
            If the employee is a teacher with active assignments and `force`
            is not set, responds 409 with details of what needs reassigning.
   @route   PUT /api/employees/:id/status
   @access  Private

   Body:
     status   (required)  — target EmployeeStatus
     reason   (required for SUSPENDED/TERMINATED, optional otherwise)
     force    (optional)  — if true, bypasses the teaching-assignment warning
───────────────────────────────────────────────────────────────────────────── */
const updateEmployeeStatus = asyncHandler(async (req, res) => {
    const { id }                    = req.params;
    const { status, reason, force } = req.body;

    /* ── 1. Validate incoming status ─────────────────────────────────────── */
    const validStatuses = Object.keys(ALLOWED_TRANSITIONS);
    if (!status || !validStatuses.includes(status)) {
        return respond.badReq(
            res,
            `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        );
    }

    if (REQUIRES_REASON.has(status) && !reason?.trim()) {
        return respond.badReq(res, `A reason is required when setting status to ${status}`);
    }

    try {
        /* ── 2. Load current employee with teacher assignments ────────────── */
        const employee = await prisma.employee.findUnique({
            where: { id },
            include: {
                teacher: {
                    include: {
                        teachersubject: {
                            include: {
                                subject:    { select: { id: true, name: true, code: true } },
                                gradelevel: { select: { id: true, name: true } },
                            },
                        },
                        gradelevel: { select: { id: true, name: true } },
                    },
                },
            },
        });

        if (!employee) return respond.notFound(res, 'Employee not found');

        /* ── 3. Validate the transition ───────────────────────────────────── */
        const transitionError = validateTransition(employee.status, status);
        if (transitionError) return respond.badReq(res, transitionError);

        /* ── 4. Check for active teaching assignments (unless force=true) ── */
        const isForced = force === true || force === 'true';
        if (REQUIRES_REASSIGNMENT_CHECK.has(status) && !isForced) {
            const subs  = employee.teacher?.teachersubject ?? [];
            const homes = employee.teacher?.gradelevel ?? [];

            if (subs.length > 0 || homes.length > 0) {
                return res.status(409).json({
                    status:  409,
                    code:    'HAS_ACTIVE_ASSIGNMENTS',
                    message: 'This employee has active teaching assignments. Reassign them first, or confirm to proceed anyway.',
                    data: {
                        subjectsTaught: subs.map(ts => ({
                            teacherSubjectId: ts.id,
                            subject:    ts.subject,
                            gradelevel: ts.gradelevel,
                        })),
                        classTeacherOf: homes.map(g => ({ id: g.id, name: g.name })),
                    },
                });
            }
        }

        const changedById = req.user?.id?.toString() ?? 'SYSTEM';
        const isTerminal  = FINAL_STATUSES.includes(status);

        /* ── 5. Flip status + append history + sync user/terminatedAt ─────── */
        const ops = [
            prisma.employee.update({
                where: { id },
                data:  {
                    status,
                    terminatedAt: isTerminal ? new Date() : null,
                    updatedAt:    new Date(),
                },
            }),
            prisma.employeestatushistory.create({
                data: {
                    id:          crypto.randomUUID(),
                    employeeId:  id,
                    fromStatus:  employee.status,
                    toStatus:    status,
                    changedById,
                    reason:      reason?.trim() || null,
                    changedAt:   new Date(),
                },
            }),
        ];

        // If transitioning to terminal, disable any linked user account
        if (isTerminal) {
            ops.push(
                prisma.users.updateMany({
                    where: { employeeId: id },
                    data:  { status: '0' },   // Char(1) — 0 = inactive in your schema
                })
            );
        }

        await prisma.$transaction(ops);

        /* ── 6. Return the full refreshed employee ────────────────────────── */
        const refreshed = await prisma.employee.findUnique({
            where:   { id },
            include: EMPLOYEE_INCLUDE,
        });

        return respond.ok(
            res,
            `Employee status updated to ${status}`,
            shapeEmployee(refreshed)
        );
    } catch (err) {
        return respond.error(res, 'Failed to update employee status', err);
    }
});

/* ─────────────────────────────────────────────────────────────────────────────
   @desc    Get an employee's status history.
   @route   GET /api/employees/:id/status-history
   @access  Private
───────────────────────────────────────────────────────────────────────────── */
const getEmployeeStatusHistory = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
        const history = await prisma.employeestatushistory.findMany({
            where:   { employeeId: id },
            orderBy: { changedAt: 'desc' },
        });

        return respond.ok(res, 'Status history retrieved successfully', history);
    } catch (err) {
        return respond.error(res, 'Failed to fetch status history', err);
    }
});

/* ─────────────────────────────────────────────────────────────────────────────
   @desc    Add a teaching profile to an existing employee.
            Used when an employee who wasn't originally a teacher takes on
            teaching duties. Reuses employeeCode as staffNumber.
   @route   POST /api/employees/:id/teacher-profile
   @access  Private
───────────────────────────────────────────────────────────────────────────── */
const addUserProfile = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
        const employee = await prisma.employee.findUnique({
            where: { id },
            include: { teacher: { select: { id: true } } },
        });

        if (!employee) return respond.notFound(res, 'Employee not found');
        if (employee.teacher) {
            return respond.badReq(res, 'This employee already has a teaching profile');
        }
        if (employee.status !== 'ACTIVE') {
            return respond.badReq(
                res,
                `Cannot add teaching profile to a ${employee.status.toLowerCase()} employee`
            );
        }

        // employeeCode serves as the staff number
        const staffNumber = employee.employeeCode;

        const collision = await prisma.teacher.findUnique({
            where:  { staffNumber },
            select: { id: true },
        });
        if (collision) {
            return respond.error(
                res,
                `Staff number ${staffNumber} is already in use`,
                new Error('Duplicate staff number'),
                409
            );
        }

        await prisma.teacher.create({
            data: {
                id:          crypto.randomUUID(),
                employeeId:  id,
                staffNumber,
                updatedAt:   new Date(),
            },
        });

        const refreshed = await prisma.employee.findUnique({
            where:   { id },
            include: EMPLOYEE_INCLUDE,
        });

        return respond.ok(res, 'Teaching profile added successfully', shapeEmployee(refreshed));
    } catch (err) {
        return respond.error(res, 'Failed to add teaching profile', err);
    }
});

/* ─────────────────────────────────────────────────────────────────────────────
   @desc    Remove an employee's teaching profile.
            Only allowed when the teacher has no active assignments —
            the admin must reassign subjects and class teacher roles first.
   @route   DELETE /api/employees/:id/teacher-profile
   @access  Private
───────────────────────────────────────────────────────────────────────────── */
const removeTeacherProfile = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
        const employee = await prisma.employee.findUnique({
            where: { id },
            include: {
                teacher: {
                    include: {
                        teachersubject: { select: { id: true } },
                        gradelevel:     { select: { id: true, name: true } },
                    },
                },
            },
        });

        if (!employee) return respond.notFound(res, 'Employee not found');
        if (!employee.teacher) {
            return respond.badReq(res, 'This employee does not have a teaching profile');
        }

        const subjectCount = employee.teacher.teachersubject.length;
        const classCount   = employee.teacher.gradelevel.length;

        if (subjectCount > 0 || classCount > 0) {
            return res.status(409).json({
                status:  409,
                code:    'HAS_ACTIVE_ASSIGNMENTS',
                message: 'Cannot remove teaching profile while active assignments exist. Reassign them first.',
                data: {
                    subjectsTaught: employee.teacher.teachersubject,
                    classTeacherOf: employee.teacher.gradelevel,
                },
            });
        }

        await prisma.teacher.delete({ where: { id: employee.teacher.id } });

        const refreshed = await prisma.employee.findUnique({
            where:   { id },
            include: EMPLOYEE_INCLUDE,
        });

        return respond.ok(res, 'Teaching profile removed successfully', shapeEmployee(refreshed));
    } catch (err) {
        return respond.error(res, 'Failed to remove teaching profile', err);
    }
});


/* ─────────────────────────────────────────────────────────────────────────────
    @desc   Get all active employees that have not being created as users

    @route  GET /api/employees/without-users

    @access Private
───────────────────────────────────────────────────────────────────────────── */
const getEmployeesWithoutUsers = asyncHandler(async (req, res) => {
    try {
        const employees = await prisma.employee.findMany({
            where: {
                status: 'ACTIVE',
                user:   null,
            },
            include: {
                jobTitle:   true,
                department: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        return respond.ok(res, 'Employees without user accounts retrieved successfully', employees);
    } catch (err) { 

        return respond.error(res, 'Failed to fetch employees without user accounts', err);

    }
});

/* ─────────────────────────────────────────────────────────────────────────────
   @desc    Lightweight active employee list — reference data for pickers
   @route   GET /api/employees/active
   @access  Private (no permission guard — reference data only)
───────────────────────────────────────────────────────────────────────────── */
const getActiveEmployees = asyncHandler(async (req, res) => {
    const { search } = req.query;
    try {
        const employees = await prisma.employee.findMany({
            where: {
                status: 'ACTIVE',
                ...(search ? {
                    OR: [
                        { firstName:    { contains: search } },
                        { lastName:     { contains: search } },
                        { employeeCode: { contains: search } },
                    ],
                } : {}),
            },
            select: {
                id:           true,
                employeeCode: true,
                firstName:    true,
                lastName:     true,
                jobTitle:     { select: { label: true } },
            },
            orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
            take: 50,
        });
        return respond.ok(res, 'Active employees retrieved', employees);
    } catch (err) {
        return respond.error(res, 'Failed to fetch active employees', err);
    }
});

// ─────────────────────────────────────────────
// @desc    Get interviews where employee is a panelist
// @route   GET /employees/:id/interviews
// @access  Private
// ─────────────────────────────────────────────
const getEmployeeInterviews = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
        const employee = await prisma.employee.findUnique({ where: { id } });
        if (!employee) return respond.notFound(res, 'Employee not found');

        const panelists = await prisma.interviewpanelist.findMany({
            where: { employeeId: id },
            include: {
                interview: {
                    include: {
                        applicant: {
                            select: {
                                id: true, firstName: true, lastName: true,
                                applicationNo: true, gradelevel: true, academicyear: true,
                            },
                        },
                        panelists: {
                            include: {
                                employee: {
                                    select: { id: true, firstName: true, lastName: true, employeeCode: true, jobTitle: { select: { label: true } } },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: { interview: { scheduledAt: 'desc' } },
        });

        const interviews = panelists.map(p => p.interview);
        return respond.ok(res, 'Employee interviews retrieved', interviews);
    } catch (err) {
        return respond.error(res, 'Failed to fetch employee interviews', err);
    }
});

/* ─────────────────────────────────────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────────────────────────────────────── */
module.exports = {
    createEmployee,
    getAllEmployees,
    getEmployeeById,
    getEmployeeAssignments,
    updateEmployee,
    updateEmployeeStatus,
    getEmployeeStatusHistory,
    addUserProfile,
    removeTeacherProfile,
    getEmployeesWithoutUsers,
    getActiveEmployees,
    getEmployeeInterviews,
};
