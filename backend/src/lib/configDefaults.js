/** Default system config keys (R1–R3). Used by seed, bootstrap, and admin UI. */
const CONFIG_DEFAULTS = [
  {
    key: 'LOAN_DAYS',
    value: '14',
    description: 'Default loan period in days (online borrow & desk checkout).',
  },
  {
    key: 'MIN_PASSWORD_LENGTH',
    value: '6',
    description: 'Minimum password length for registration and admin-created accounts.',
  },
  {
    key: 'MAX_BORROW_BOOKS',
    value: '5',
    description: 'Maximum concurrent active loans per reader account.',
  },
  {
    key: 'MAX_RENEW_COUNT',
    value: '1',
    description: 'Maximum number of renewals allowed per loan (0 = renewals disabled).',
  },
  {
    key: 'FINE_RATE_PER_DAY',
    value: '0.50',
    description: 'Fine amount charged per overdue day on return.',
  },
  {
    key: 'READER_CARD_ID_PATTERN',
    value: '^[A-Z0-9]{6,12}$',
    description: 'Suggested reader card ID format (regex, policy text).',
  },
  {
    key: 'REMINDER_DAYS_AHEAD',
    value: '3',
    description: 'Days before due date to send in-app loan reminders (R1.06).',
  },
  {
    key: 'AUTO_BACKUP_ENABLED',
    value: 'false',
    description: 'Enable scheduled automatic database backups (A1.09).',
  },
  {
    key: 'AUTO_BACKUP_INTERVAL_HOURS',
    value: '24',
    description: 'Hours between automatic database backups.',
  },
  {
    key: 'AUTO_BACKUP_RETENTION_DAYS',
    value: '30',
    description: 'Days to keep automatic backup files before pruning.',
  },
];

module.exports = { CONFIG_DEFAULTS };
