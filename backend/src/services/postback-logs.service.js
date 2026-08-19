import { listAdminPostbackLogs as listAdminPostbackLogsModel } from '../models/postback-logs.model.js';

export async function listAdminPostbackLogs(filter = {}, pagination = {}) {
  return listAdminPostbackLogsModel(filter, pagination);
}
