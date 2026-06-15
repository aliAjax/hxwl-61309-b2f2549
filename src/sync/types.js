export const OPERATION_TYPES = {
  ADD_RECORD: 'add_record',
  UPDATE_RECORD: 'update_record',
  DELETE_RECORD: 'delete_record',
  UPDATE_RECORD_STATUS: 'update_record_status',
  ADD_DEVIATION: 'add_deviation',
  UPDATE_DEVIATION: 'update_deviation',
  DELETE_DEVIATION: 'delete_deviation',
  UPDATE_DEVIATION_STATUS: 'update_deviation_status',
  ADD_TEMPLATE: 'add_template',
  UPDATE_TEMPLATE: 'update_template',
  DELETE_TEMPLATE: 'delete_template',
  ADD_CENTER: 'add_center',
  UPDATE_CENTER: 'update_center',
  DELETE_CENTER: 'delete_center',
  PUBLISH_VERSION: 'publish_version',
  EXECUTE_MIGRATION: 'execute_migration',
  ROLLBACK_MIGRATION: 'rollback_migration',
};

export const OPERATION_STATUSES = {
  PENDING: 'pending',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  FAILED: 'failed',
  CONFLICT: 'conflict',
};

export const CONFLICT_TYPES = {
  CONCURRENT_MODIFY: 'concurrent_modify',
  DELETE_THEN_EDIT: 'delete_then_edit',
  VERSION_CHANGED: 'version_changed',
  RECORD_NOT_FOUND: 'record_not_found',
  PERMISSION_DENIED: 'permission_denied',
};

export const SYNC_STATUSES = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  SYNCING: 'syncing',
  ERROR: 'error',
};

export const STORAGE_KEYS = {
  OPERATION_QUEUE: 'hxwl-61309-op-queue',
  SYNC_STATE: 'hxwl-61309-sync-state',
  CONFLICTS: 'hxwl-61309-conflicts',
  LAST_SYNC_TIME: 'hxwl-61309-last-sync',
  CLIENT_ID: 'hxwl-61309-client-id',
  ENTITY_SNAPSHOTS: 'hxwl-61309-entity-snapshots',
};
