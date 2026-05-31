const axios = require('axios');

const cfg = {
  url:         () => process.env.POSTING_API_URL,
  apiKey:      () => process.env.POSTING_API_KEY      || '',
  apiSecret:   () => process.env.POSTING_API_SECRET   || '',
  channelCode: () => process.env.POSTING_CHANNEL_CODE || 'HRP',
  transType:   () => process.env.POSTING_TRANS_TYPE   || '1504',
  postedBy:    () => process.env.POSTING_POSTED_BY    || 'HRMS',
  currency:    () => process.env.POSTING_DEFAULT_CURRENCY || 'SLL',
  branch:      () => process.env.POSTING_DEFAULT_BRANCH   || '000',
};

/**
 * Post a bulk payment to the GL system.
 * @param {{ approvedBy: string, referenceNo: string, debitAccounts: any[], creditAccounts: any[] }} opts
 * @returns {{ documentRef: string, raw: object }}
 */
async function postToGL({ approvedBy, referenceNo, debitAccounts, creditAccounts }) {
  const url = cfg.url();
  if (!url) throw new Error('POSTING_API_URL not configured');

  const payload = {
    approvedBy,
    channelCode:    cfg.channelCode(),
    transType:      cfg.transType(),
    debitAccounts,
    creditAccounts,
    referenceNo,
    postedBy:       cfg.postedBy(),
  };

  const res = await axios({
    method:        'put',
    maxBodyLength: Infinity,
    url,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key':    cfg.apiKey(),
      'x-api-secret': cfg.apiSecret(),
    },
    data:    payload,
    timeout: 30000,
  });

  const data = res.data || {};
  // responseCode "00" / "000" / "0" = success; anything else = failure
  const code = String(data.responseCode ?? '');
  if (code && code !== '00' && code !== '000' && code !== '0') {
    const err = new Error(`GL error ${code}: ${data.message || 'Unknown error'}`);
    err.glResponse = data;
    throw err;
  }
  return {
    documentRef: data.documentRef || data.document_ref || data.referenceNo || referenceNo,
    raw: data,
  };
}

module.exports = { postToGL, cfg };
