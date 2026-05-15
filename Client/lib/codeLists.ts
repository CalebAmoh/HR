import api from './api';

export async function createCodeList({ code, description }) {
  return api.post('/system/code-lists', { code, description });
}
