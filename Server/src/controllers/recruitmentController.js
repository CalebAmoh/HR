const { prisma }               = require('../helpers/dbQueryHelper');
const asyncHandler             = require('../middleware/asyncHandler');
const respond                  = require('../helpers/respondHelper');
const { logActivity, fromReq } = require('./auditController');
const crypto                   = require('crypto');
const { sendSchedulingInvite, sendInterviewConfirmation, buildIcs, sendCandidateStageEmail } = require('../helpers/emailHelper');

// ── Helpers ───────────────────────────────────────────────────────────────────

function toBigInt(val) {
  if (!val && val !== 0) return null;
  try { return BigInt(val); } catch { return null; }
}

function s(obj) {
  if (typeof obj === 'bigint')                return obj.toString();
  if (obj instanceof Date)                    return obj.toISOString();
  if (Array.isArray(obj))                     return obj.map(s);
  if (obj !== null && typeof obj === 'object') {
    if (typeof obj.toFixed === 'function')    return obj.toString();
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = s(v);
    return out;
  }
  return obj;
}

async function safeAlter(sql) {
  try { await prisma.$executeRawUnsafe(sql); } catch {}
}

// ── One-time schema patches ───────────────────────────────────────────────────

(async () => {
  await safeAlter(`ALTER TABLE interviews  ADD COLUMN feedback TEXT NULL`);
  await safeAlter(`ALTER TABLE interviews  ADD COLUMN outcome  VARCHAR(20) NULL`);
  await safeAlter(`ALTER TABLE candidates  ADD COLUMN rejection_reason VARCHAR(500) NULL`);
  await safeAlter(`ALTER TABLE candidates  ADD COLUMN offer_amount DECIMAL(12,2) NULL`);
  await safeAlter(`ALTER TABLE candidates  ADD COLUMN offer_date DATE NULL`);
  await safeAlter(`ALTER TABLE job ADD COLUMN code VARCHAR(50) NULL`);
  await safeAlter(`ALTER TABLE job ADD COLUMN companyName VARCHAR(255) NULL`);
  await safeAlter(`ALTER TABLE job ADD COLUMN showHiringManager VARCHAR(10) NULL`);
  await safeAlter(`ALTER TABLE job ADD COLUMN postalCode VARCHAR(20) NULL`);
  await safeAlter(`ALTER TABLE job ADD COLUMN attachment VARCHAR(500) NULL`);
  // Convert BigInt reference columns to VARCHAR so we can store plain string values
  await safeAlter(`ALTER TABLE job MODIFY COLUMN country        VARCHAR(100) NULL`);
  await safeAlter(`ALTER TABLE job MODIFY COLUMN location       VARCHAR(255) NULL`);
  await safeAlter(`ALTER TABLE job MODIFY COLUMN employementType VARCHAR(100) NULL`);
  await safeAlter(`ALTER TABLE job MODIFY COLUMN hiringManager  VARCHAR(200) NULL`);
  await safeAlter(`ALTER TABLE job MODIFY COLUMN experienceLevel VARCHAR(100) NULL`);
  await safeAlter(`ALTER TABLE job MODIFY COLUMN jobFunction    VARCHAR(100) NULL`);
  await safeAlter(`ALTER TABLE job MODIFY COLUMN educationLevel VARCHAR(100) NULL`);
  await safeAlter(`ALTER TABLE job MODIFY COLUMN currency       VARCHAR(20)  NULL`);
  // Convert candidates.source from ENUM to VARCHAR so it's always updatable
  await safeAlter(`ALTER TABLE candidates MODIFY COLUMN source VARCHAR(20) NULL`);
  // Self-scheduling columns
  await safeAlter(`ALTER TABLE interviews ADD COLUMN schedule_token   VARCHAR(100) NULL`);
  await safeAlter(`ALTER TABLE interviews ADD COLUMN schedule_options TEXT        NULL`);
  await safeAlter(`ALTER TABLE interviews ADD COLUMN schedule_expires DATETIME    NULL`);
  // CV file attachment
  await safeAlter(`ALTER TABLE candidates ADD COLUMN cv_file VARCHAR(500) NULL`);
  // Interview end time
  await safeAlter(`ALTER TABLE interviews ADD COLUMN scheduled_end DATETIME NULL`);

  // Seed default pipeline stages if none exist
  const pipelineCount = await prisma.hiringpipeline.count().catch(() => 0);
  if (pipelineCount === 0) {
    await prisma.hiringpipeline.createMany({
      data: [
        { name: 'Short Listed', type: 'Short_Listed' },
        { name: 'Phone Screen', type: 'Phone_Screen' },
        { name: 'Assessment',   type: 'Assessment' },
        { name: 'Interview',    type: 'Interview' },
        { name: 'Offer',        type: 'Offer' },
        { name: 'Hired',        type: 'Hired' },
        { name: 'Rejected',     type: 'Rejected' },
        { name: 'Archived',     type: 'Archived' },
      ],
    }).catch(() => {});
  }
})();

// ── Jobs ─────────────────────────────────────────────────────────────────────

const getJobs = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const where = {};
  if (status) where.status = status;

  const jobs = await prisma.job.findMany({
    where,
    orderBy: { id: 'desc' },
  });
  return respond.ok(res, 'Jobs', s(jobs));
});

const createJob = asyncHandler(async (req, res) => {
  const {
    title, positionReason, shortDescription, description, requirements, benefits,
    department, employementType, hiringManager, salaryMin, salaryMax, showSalary,
    keywords, status, closingDate, display,
    code, showHiringManager, country, location, postalCode,
    experienceLevel, jobFunction, educationLevel, currency, attachment,
  } = req.body;

  // Auto-fill companyName from payslip_settings
  const [psRow] = await prisma.$queryRawUnsafe(
    `SELECT company_name FROM payslip_settings LIMIT 1`
  ).catch(() => []);
  const resolvedCompanyName = psRow?.company_name ?? null;

  const job = await prisma.job.create({
    data: {
      title:              title || '',
      positionReason:     positionReason || null,
      shortDescription:   shortDescription || null,
      description:        description || null,
      requirements:       requirements || null,
      benefits:           benefits || null,
      department:         department || null,
      employementType:    employementType || null,
      hiringManager:      hiringManager || null,
      salaryMin:          toBigInt(salaryMin),
      salaryMax:          toBigInt(salaryMax),
      showSalary:         showSalary || null,
      keywords:           keywords || null,
      status:             status || 'Active',
      closingDate:        closingDate ? new Date(closingDate) : null,
      display:            display || title || '',
      postedBy:           toBigInt(req.user?.id),
      code:               code || null,
      companyName:        resolvedCompanyName,
      showHiringManager:  showHiringManager || null,
      country:            country || null,
      location:           location || null,
      postalCode:         postalCode || null,
      experienceLevel:    experienceLevel || null,
      jobFunction:        jobFunction || null,
      educationLevel:     educationLevel || null,
      currency:           currency || null,
      attachment:         attachment || null,
    },
  });

  logActivity({ module: 'Recruitment', action: 'create_job', entityId: String(job.id), entityName: job.title, ...fromReq(req) });
  return respond.created(res, 'Job created', s(job));
});

const updateJob = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  const {
    title, positionReason, shortDescription, description, requirements, benefits,
    department, employementType, hiringManager, salaryMin, salaryMax, showSalary,
    keywords, status, closingDate, display,
    code, showHiringManager, country, location, postalCode,
    experienceLevel, jobFunction, educationLevel, currency, attachment,
  } = req.body;

  // Keep companyName in sync with payslip_settings
  const [psRow] = await prisma.$queryRawUnsafe(
    `SELECT company_name FROM payslip_settings LIMIT 1`
  ).catch(() => []);
  const resolvedCompanyName = psRow?.company_name ?? null;

  const job = await prisma.job.update({
    where: { id },
    data: {
      title:              title,
      positionReason:     positionReason || null,
      shortDescription:   shortDescription || null,
      description:        description || null,
      requirements:       requirements || null,
      benefits:           benefits || null,
      department:         department || null,
      employementType:    employementType || null,
      hiringManager:      hiringManager || null,
      salaryMin:          toBigInt(salaryMin),
      salaryMax:          toBigInt(salaryMax),
      showSalary:         showSalary || null,
      keywords:           keywords || null,
      status:             status,
      closingDate:        closingDate ? new Date(closingDate) : null,
      display:            display || title || '',
      code:               code || null,
      companyName:        resolvedCompanyName,
      showHiringManager:  showHiringManager || null,
      country:            country || null,
      location:           location || null,
      postalCode:         postalCode || null,
      experienceLevel:    experienceLevel || null,
      jobFunction:        jobFunction || null,
      educationLevel:     educationLevel || null,
      currency:           currency || null,
      attachment:         attachment !== undefined ? (attachment || null) : undefined,
    },
  });

  logActivity({ module: 'Recruitment', action: 'update_job', entityId: String(id), entityName: job.title, ...fromReq(req) });
  return respond.ok(res, 'Job updated', s(job));
});

const deleteJob = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  await prisma.job.delete({ where: { id } });
  logActivity({ module: 'Recruitment', action: 'delete_job', entityId: String(id), ...fromReq(req) });
  return respond.ok(res, 'Job deleted');
});

// ── Candidates ────────────────────────────────────────────────────────────────

const getCandidates = asyncHandler(async (req, res) => {
  const { job, stage, source } = req.query;
  const where = {};
  if (job)    where.jobId       = toBigInt(job);
  if (stage)  where.hiringStage = toBigInt(stage);
  if (source) where.source      = source;

  const candidates = await prisma.candidates.findMany({
    where,
    orderBy: { id: 'desc' },
  });
  return respond.ok(res, 'Candidates', s(candidates));
});

const getCandidateById = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  const candidate = await prisma.candidates.findUnique({ where: { id } });
  if (!candidate) return respond.notFound(res, 'Candidate not found');

  const [applications, interviews, pipeline] = await Promise.all([
    prisma.applications.findMany({ where: { candidate: id }, orderBy: { id: 'desc' } }),
    prisma.interviews.findMany({ where: { candidate: id }, orderBy: { id: 'desc' } }),
    prisma.hiringpipeline.findMany({ orderBy: { id: 'asc' } }),
  ]);

  return respond.ok(res, 'Candidate', s({ ...candidate, applications, interviews, pipeline }));
});

const createCandidate = asyncHandler(async (req, res) => {
  const {
    first_name, last_name, middle_name, email, mobile_phone, gender,
    marital_status, birthday, address1, address2, city, country,
    cv_title, totalYearsOfExperience, totalMonthsOfExperience,
    expectedSalary, source, jobId, notes, cv_file,
  } = req.body;

  const candidate = await prisma.candidates.create({
    data: {
      first_name:              first_name || '',
      last_name:               last_name  || '',
      middle_name:             middle_name || null,
      email:                   email || null,
      mobile_phone:            mobile_phone || null,
      gender:                  gender || null,
      marital_status:          marital_status || null,
      birthday:                birthday ? new Date(birthday) : null,
      address1:                address1 || null,
      address2:                address2 || null,
      city:                    city || null,
      country:                 country || null,
      cv_title:                cv_title || '',
      totalYearsOfExperience:  totalYearsOfExperience ? parseInt(totalYearsOfExperience) : null,
      totalMonthsOfExperience: totalMonthsOfExperience ? parseInt(totalMonthsOfExperience) : null,
      expectedSalary:          expectedSalary ? parseInt(expectedSalary) : null,
      source:                  source || 'Sourced',
      jobId:                   toBigInt(jobId),
      notes:                   notes || null,
      created:                 new Date(),
      updated:                 new Date(),
    },
  });
  if (cv_file) {
    await prisma.$executeRawUnsafe(`UPDATE candidates SET cv_file = ? WHERE id = ?`, cv_file, candidate.id);
  }

  // Auto-create an application record when a job is assigned
  if (candidate.jobId) {
    await prisma.applications.create({
      data: { job: candidate.jobId, candidate: candidate.id, created: new Date() },
    }).catch(() => {});
  }

  logActivity({ module: 'Recruitment', action: 'create_candidate', entityId: String(candidate.id), entityName: `${candidate.first_name} ${candidate.last_name}`, ...fromReq(req) });
  return respond.created(res, 'Candidate created', s(candidate));
});

const updateCandidate = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  const {
    first_name, last_name, middle_name, email, mobile_phone, gender,
    marital_status, birthday, address1, address2, city, country,
    cv_title, totalYearsOfExperience, totalMonthsOfExperience,
    expectedSalary, source, jobId, notes, cv_file,
  } = req.body;

  const candidate = await prisma.candidates.update({
    where: { id },
    data: {
      first_name:              first_name,
      last_name:               last_name,
      middle_name:             middle_name || null,
      email:                   email || null,
      mobile_phone:            mobile_phone || null,
      gender:                  gender || null,
      marital_status:          marital_status || null,
      birthday:                birthday ? new Date(birthday) : null,
      address1:                address1 || null,
      address2:                address2 || null,
      city:                    city || null,
      country:                 country || null,
      cv_title:                cv_title || '',
      totalYearsOfExperience:  totalYearsOfExperience ? parseInt(totalYearsOfExperience) : null,
      totalMonthsOfExperience: totalMonthsOfExperience ? parseInt(totalMonthsOfExperience) : null,
      expectedSalary:          expectedSalary ? parseInt(expectedSalary) : null,
      source:                  source || null,
      jobId:                   toBigInt(jobId),
      notes:                   notes || null,
      updated:                 new Date(),
    },
  });
  if (cv_file !== undefined) {
    await prisma.$executeRawUnsafe(`UPDATE candidates SET cv_file = ? WHERE id = ?`, cv_file || null, id);
  }

  logActivity({ module: 'Recruitment', action: 'update_candidate', entityId: String(id), entityName: `${candidate.first_name} ${candidate.last_name}`, ...fromReq(req) });
  return respond.ok(res, 'Candidate updated', s(candidate));
});

const deleteCandidate = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  await prisma.applications.deleteMany({ where: { candidate: id } });
  await prisma.candidates.delete({ where: { id } });
  logActivity({ module: 'Recruitment', action: 'delete_candidate', entityId: String(id), ...fromReq(req) });
  return respond.ok(res, 'Candidate deleted');
});

const moveCandidateStage = asyncHandler(async (req, res) => {
  const id      = toBigInt(req.params.id);
  const stageId = toBigInt(req.body.stageId);

  const candidate = await prisma.candidates.update({
    where: { id },
    data:  { hiringStage: stageId, updated: new Date() },
  });

  // Fire-and-forget stage notification email
  if (candidate.email) {
    Promise.all([
      prisma.hiringpipeline.findUnique({ where: { id: stageId } }).catch(() => null),
      candidate.jobId ? prisma.job.findUnique({ where: { id: candidate.jobId } }).catch(() => null) : Promise.resolve(null),
    ]).then(([stage, job]) => {
      if (stage) {
        sendCandidateStageEmail({
          to:            candidate.email,
          candidateName: `${candidate.first_name} ${candidate.last_name}`,
          stageName:     stage.name || stage.type,
          jobTitle:      job?.title || null,
        }).catch(() => {});
      }
    }).catch(() => {});
  }

  logActivity({ module: 'Recruitment', action: 'move_candidate_stage', entityId: String(id), details: { stageId: String(stageId) }, ...fromReq(req) });
  return respond.ok(res, 'Stage updated', s(candidate));
});

// ── Applications ──────────────────────────────────────────────────────────────

const getApplications = asyncHandler(async (req, res) => {
  const { job } = req.query;
  const where = {};
  if (job) where.job = toBigInt(job);

  const applications = await prisma.applications.findMany({
    where,
    orderBy: { id: 'desc' },
  });
  return respond.ok(res, 'Applications', s(applications));
});

const createApplication = asyncHandler(async (req, res) => {
  const { job, candidate, notes, referredByEmail } = req.body;

  const application = await prisma.applications.create({
    data: {
      job:            toBigInt(job),
      candidate:      toBigInt(candidate),
      notes:          notes || null,
      referredByEmail: referredByEmail || null,
      created:        new Date(),
    },
  });

  logActivity({ module: 'Recruitment', action: 'create_application', entityId: String(application.id), ...fromReq(req) });
  return respond.created(res, 'Application created', s(application));
});

const deleteApplication = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  await prisma.applications.delete({ where: { id } });
  logActivity({ module: 'Recruitment', action: 'delete_application', entityId: String(id), ...fromReq(req) });
  return respond.ok(res, 'Application deleted');
});

// ── Interviews ────────────────────────────────────────────────────────────────

const getInterviews = asyncHandler(async (req, res) => {
  const { candidate, job } = req.query;

  let sql = 'SELECT * FROM interviews';
  const params = [];
  const conditions = [];
  if (candidate) { conditions.push('candidate = ?'); params.push(BigInt(candidate)); }
  if (job)       { conditions.push('job = ?');       params.push(BigInt(job)); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY id DESC';

  const interviews = await prisma.$queryRawUnsafe(sql, ...params);
  return respond.ok(res, 'Interviews', s(interviews));
});

const createInterview = asyncHandler(async (req, res) => {
  const { job, candidate, level, scheduled, location, notes, interviewers, status, schedule_options } = req.body;

  const interview = await prisma.interviews.create({
    data: {
      job:              toBigInt(job),
      candidate:        toBigInt(candidate),
      level:            level || null,
      scheduled:        scheduled ? new Date(scheduled) : null,
      location:         location || null,
      notes:            notes || null,
      interviewers:     interviewers || null,
      status:           status || 'Scheduled',
      schedule_options: schedule_options || null,
      created:          new Date(),
      updated:          new Date(),
    },
  });

  logActivity({ module: 'Recruitment', action: 'create_interview', entityId: String(interview.id), ...fromReq(req) });
  return respond.created(res, 'Interview created', s(interview));
});

const updateInterview = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  const { job, candidate, level, scheduled, location, notes, interviewers, status, outcome, feedback, schedule_options } = req.body;

  const data = { updated: new Date() };
  if (job              !== undefined) data.job              = toBigInt(job);
  if (candidate        !== undefined) data.candidate        = toBigInt(candidate);
  if (level            !== undefined) data.level            = level || null;
  if (scheduled        !== undefined) data.scheduled        = scheduled ? new Date(scheduled) : null;
  if (location         !== undefined) data.location         = location || null;
  if (notes            !== undefined) data.notes            = notes || null;
  if (interviewers     !== undefined) data.interviewers     = interviewers || null;
  if (status           !== undefined) data.status           = status || null;
  if (outcome          !== undefined) data.outcome          = outcome || null;
  if (feedback         !== undefined) data.feedback         = feedback || null;
  if (schedule_options !== undefined) data.schedule_options = schedule_options || null;

  const interview = await prisma.interviews.update({ where: { id }, data });

  logActivity({ module: 'Recruitment', action: 'update_interview', entityId: String(id), ...fromReq(req) });
  return respond.ok(res, 'Interview updated', s(interview));
});

const deleteInterview = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  await prisma.interviews.delete({ where: { id } });
  logActivity({ module: 'Recruitment', action: 'delete_interview', entityId: String(id), ...fromReq(req) });
  return respond.ok(res, 'Interview deleted');
});

// ── Pipeline stages ───────────────────────────────────────────────────────────

const getPipeline = asyncHandler(async (req, res) => {
  const stages = await prisma.hiringpipeline.findMany({ orderBy: { id: 'asc' } });
  return respond.ok(res, 'Pipeline', s(stages));
});

// ── Hire conversion ───────────────────────────────────────────────────────────

const hireCandidate = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  const candidate = await prisma.candidates.findUnique({ where: { id } });
  if (!candidate) return respond.notFound(res, 'Candidate not found');

  // Split full name parts
  const firstName  = candidate.first_name  || '';
  const lastName   = candidate.last_name   || '';
  const middleName = candidate.middle_name || null;

  const employee = await prisma.employee.create({
    data: {
      firstName,
      lastName,
      middleName,
      email:          candidate.email || null,
      work_email:     candidate.email || null,
      mobilePhone:    candidate.mobile_phone || null,
      address1:       candidate.address1 || null,
      city:           candidate.city || null,
      country:        candidate.country || null,
      approvalStatus: 'PENDING',
      lifecycleStatus:'PENDING',
      posted_by:      toBigInt(req.user?.id),
    },
  });

  // Mark candidate as hired — find the "Hired" stage
  const hiredStage = await prisma.hiringpipeline.findFirst({
    where: { type: 'Hired' },
  });
  if (hiredStage) {
    await prisma.candidates.update({
      where: { id },
      data:  { hiringStage: hiredStage.id, updated: new Date() },
    });
  }

  logActivity({ module: 'Recruitment', action: 'hire_candidate', entityId: String(employee.id), entityName: `${employee.firstName} ${employee.lastName}`, details: { candidateId: id.toString() }, ...fromReq(req) });
  return respond.created(res, 'Employee record created', s({ employee }));
});

// ── Public (no-auth) endpoints ────────────────────────────────────────────────

const getPublicSettings = asyncHandler(async (req, res) => {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT company_name, company_logo_url, company_address, accent_color FROM payslip_settings LIMIT 1`
  );
  return respond.ok(res, 'Settings', s(rows[0] ?? {}));
});

const getPublicJobs = asyncHandler(async (req, res) => {
  const { search, department, type } = req.query;

  const jobs = await prisma.job.findMany({
    where: { status: 'Active' },
    orderBy: { id: 'desc' },
  });

  let result = jobs;
  if (search) {
    const q = search.toLowerCase();
    result = result.filter(j =>
      j.title?.toLowerCase().includes(q) ||
      j.department?.toLowerCase().includes(q) ||
      j.keywords?.toLowerCase().includes(q)
    );
  }
  if (department) result = result.filter(j => j.department === department);
  if (type)       result = result.filter(j => j.employementType === type);

  return respond.ok(res, 'Jobs', s(result));
});

const getPublicJobByCode = asyncHandler(async (req, res) => {
  const { code } = req.params;

  // Try code first, then numeric id as fallback
  let job = await prisma.job.findFirst({ where: { code, status: 'Active' } });
  if (!job) {
    const numId = toBigInt(code);
    if (numId) job = await prisma.job.findFirst({ where: { id: numId, status: 'Active' } });
  }
  if (!job) return respond.notFound(res, 'Job not found');
  return respond.ok(res, 'Job', s(job));
});

const applyForJob = asyncHandler(async (req, res) => {
  const { code } = req.params;

  let job = await prisma.job.findFirst({ where: { code, status: 'Active' } });
  if (!job) {
    const numId = toBigInt(code);
    if (numId) job = await prisma.job.findFirst({ where: { id: numId, status: 'Active' } });
  }
  if (!job) return respond.notFound(res, 'Job not found');

  const { first_name, last_name, email, mobile_phone, cv_title, coverLetter } = req.body;
  if (!first_name || !last_name || !email) {
    return respond.badReq(res, 'First name, last name and email are required');
  }

  // Prevent duplicate applications: same (email OR phone) + same job
  const orConditions = [{ email, jobId: job.id }];
  if (mobile_phone) orConditions.push({ mobile_phone, jobId: job.id });
  const existing = await prisma.candidates.findFirst({ where: { OR: orConditions } });
  if (existing) {
    return respond.badReq(res, 'You have already applied for this position.');
  }

  const candidate = await prisma.candidates.create({
    data: {
      first_name,
      last_name,
      email:        email || null,
      mobile_phone: mobile_phone || null,
      cv_title:     cv_title || job.title,
      source:       'Applied',
      jobId:        job.id,
      notes:        coverLetter || null,
      created:      new Date(),
      updated:      new Date(),
    },
  });
  if (req.file?.filename) {
    await prisma.$executeRawUnsafe(`UPDATE candidates SET cv_file = ? WHERE id = ?`, req.file.filename, candidate.id);
  }

  await prisma.applications.create({
    data: {
      job:       job.id,
      candidate: candidate.id,
      created:   new Date(),
    },
  });

  return respond.created(res, 'Application submitted successfully', s({ candidateId: candidate.id }));
});

// ── Self-scheduling ───────────────────────────────────────────────────────────

const sendScheduleLink = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);

  const interview = await prisma.interviews.findUnique({ where: { id } });
  if (!interview) return respond.notFound(res, 'Interview not found');
  if (!interview.schedule_options) return respond.badReq(res, 'No scheduling slots defined for this interview');

  const candidate = interview.candidate
    ? await prisma.candidates.findUnique({ where: { id: interview.candidate } })
    : null;
  if (!candidate?.email) return respond.badReq(res, 'Candidate has no email address');

  const job = interview.job
    ? await prisma.job.findUnique({ where: { id: interview.job } })
    : null;

  const token   = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.interviews.update({
    where: { id },
    data: { schedule_token: token, schedule_expires: expires },
  });

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
  const link  = `${frontendUrl}/schedule/${token}`;
  const slots = JSON.parse(interview.schedule_options || '[]');

  await sendSchedulingInvite({
    to: candidate.email,
    candidateName: `${candidate.first_name ?? ''} ${candidate.last_name ?? ''}`.trim(),
    jobTitle: job?.title ?? 'Position',
    slots,
    link,
    expiresAt: expires,
  });

  return respond.ok(res, 'Scheduling link sent');
});

const getSchedulePage = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const interview = await prisma.interviews.findFirst({ where: { schedule_token: token } });
  if (!interview) return res.status(404).json({ status: '404', message: 'Link not found or invalid' });

  if (interview.schedule_expires && new Date(interview.schedule_expires) < new Date()) {
    return res.status(410).json({ status: '410', message: 'This scheduling link has expired' });
  }

  const candidate = interview.candidate
    ? await prisma.candidates.findUnique({ where: { id: interview.candidate } })
    : null;
  const job = interview.job
    ? await prisma.job.findUnique({ where: { id: interview.job } })
    : null;

  const slots = JSON.parse(interview.schedule_options || '[]');

  return respond.ok(res, 'Schedule page', s({
    interview: { level: interview.level, location: interview.location },
    job:       { title: job?.title ?? null },
    candidate: { first_name: candidate?.first_name ?? null },
    slots,
    alreadyBooked: !!interview.scheduled,
  }));
});

const confirmSchedule = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { slot }  = req.body;

  if (!slot) return respond.badReq(res, 'No slot provided');

  const interview = await prisma.interviews.findFirst({ where: { schedule_token: token } });
  if (!interview) return res.status(404).json({ status: '404', message: 'Link not found or invalid' });

  if (interview.schedule_expires && new Date(interview.schedule_expires) < new Date()) {
    return res.status(410).json({ status: '410', message: 'This scheduling link has expired' });
  }

  if (interview.scheduled) return respond.badReq(res, 'Interview already confirmed');

  const slots = JSON.parse(interview.schedule_options || '[]');
  if (!slots.includes(slot)) return respond.badReq(res, 'Invalid slot selected');

  await prisma.interviews.update({
    where: { id: interview.id },
    data: {
      scheduled:       new Date(slot),
      status:          'Scheduled',
      scheduleUpdated: 1,
      updated:         new Date(),
    },
  });

  const candidate = interview.candidate
    ? await prisma.candidates.findUnique({ where: { id: interview.candidate } })
    : null;
  const job = interview.job
    ? await prisma.job.findUnique({ where: { id: interview.job } })
    : null;

  const slotDate = new Date(slot);
  const slotEnd  = new Date(slotDate.getTime() + 60 * 60 * 1000);

  const icsContent = buildIcs({
    uid:            `interview-${s(interview.id)}-${Date.now()}`,
    summary:        `Interview: ${job?.title ?? 'Position'}${interview.level ? ` - ${interview.level}` : ''}`,
    dtstart:        slotDate,
    dtend:          slotEnd,
    location:       interview.location ?? '',
    organizerEmail: job?.hiringManager?.includes('@') ? job.hiringManager : null,
    attendeeEmail:  candidate?.email ?? null,
  });

  const recipients = [];
  if (candidate?.email) {
    recipients.push({ to: candidate.email, name: `${candidate.first_name ?? ''} ${candidate.last_name ?? ''}`.trim() });
  }
  if (job?.hiringManager?.includes('@')) {
    recipients.push({ to: job.hiringManager, name: 'Hiring Manager' });
  }
  if (interview.interviewers) {
    for (const entry of interview.interviewers.split(',').map(x => x.trim()).filter(Boolean)) {
      if (entry.includes('@')) recipients.push({ to: entry, name: entry });
    }
  }

  await Promise.allSettled(
    recipients.map(({ to, name }) =>
      sendInterviewConfirmation({
        to,
        name,
        jobTitle:     job?.title ?? 'Position',
        level:        interview.level ?? '',
        datetime:     slotDate.toLocaleString(),
        location:     interview.location ?? '',
        interviewers: interview.interviewers ?? '',
        icsContent,
      })
    )
  );

  return respond.ok(res, 'Interview confirmed');
});

module.exports = {
  getJobs, createJob, updateJob, deleteJob,
  getCandidates, getCandidateById, createCandidate, updateCandidate, deleteCandidate, moveCandidateStage,
  getApplications, createApplication, deleteApplication,
  getInterviews, createInterview, updateInterview, deleteInterview,
  getPipeline,
  hireCandidate,
  getPublicSettings, getPublicJobs, getPublicJobByCode, applyForJob,
  sendScheduleLink, getSchedulePage, confirmSchedule,
};
