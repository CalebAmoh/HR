const cron = require('node-cron');
const leaveCtrl = require('../controllers/leaveController');

// Runs daily at 06:00 — posts GL for all approved leaves whose start date has arrived
cron.schedule('0 6 * * *', () => {
  leaveCtrl.runDailyLeaveGL().catch(err =>
    console.error('[cron] Daily leave GL run failed:', err.message)
  );
});

console.log('[cron] Daily leave GL scheduled — runs at 06:00 every day');
