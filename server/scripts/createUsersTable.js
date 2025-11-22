// Creates [dbo].[Users] table in DATADB (VaultIDCardProcessor) for user management
// Uses environment variables: DATADB_SERVER, DATADB_USER, DATADB_PASSWORD, DATADB_NAME, DATADB_PORT
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const sql = require('mssql');

async function main() {
  const config = {
    user: process.env.DATADB_USER,
    password: process.env.DATADB_PASSWORD,
    server: process.env.DATADB_SERVER,
    database: process.env.DATADB_NAME || 'VaultIDCardProcessor',
    port: parseInt(process.env.DATADB_PORT || '1433', 10),
    options: { encrypt: false, trustServerCertificate: true },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 }
  };

  if (!config.server || !config.user || !config.password) {
    console.error('Missing DATADB connection env. Required: DATADB_SERVER, DATADB_USER, DATADB_PASSWORD');
    process.exit(1);
  }

  const createSql = `
IF OBJECT_ID('dbo.Users', 'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[Users] (
    [Id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    [Name] NVARCHAR(200) NOT NULL,
    [Email] NVARCHAR(320) NOT NULL,
    [Role] NVARCHAR(20) NOT NULL,
    [Status] NVARCHAR(20) NOT NULL,
    [PasswordHash] NVARCHAR(MAX) NULL,
    [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
-- Ensure columns exist
IF COL_LENGTH('dbo.Users','Role') IS NULL ALTER TABLE [dbo].[Users] ADD [Role] NVARCHAR(20) NOT NULL DEFAULT N'User';
IF COL_LENGTH('dbo.Users','Status') IS NULL ALTER TABLE [dbo].[Users] ADD [Status] NVARCHAR(20) NOT NULL DEFAULT N'Active';
IF COL_LENGTH('dbo.Users','PasswordHash') IS NULL ALTER TABLE [dbo].[Users] ADD [PasswordHash] NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.Users','CreatedAt') IS NULL ALTER TABLE [dbo].[Users] ADD [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME();
IF COL_LENGTH('dbo.Users','UpdatedAt') IS NULL ALTER TABLE [dbo].[Users] ADD [UpdatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME();
-- Ensure constraints
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Users_Role')
  ALTER TABLE [dbo].[Users] ADD CONSTRAINT [CK_Users_Role] CHECK ([Role] IN (N'Admin', N'User'));
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Users_Status')
  ALTER TABLE [dbo].[Users] ADD CONSTRAINT [CK_Users_Status] CHECK ([Status] IN (N'Active', N'Inactive'));
-- Ensure unique index
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Users_Email' AND object_id = OBJECT_ID('dbo.Users'))
  CREATE UNIQUE INDEX [IX_Users_Email] ON [dbo].[Users]([Email]);
`;

  const ensureTrigger = `
IF OBJECT_ID('dbo.trg_Users_UpdateTimestamp', 'TR') IS NULL
BEGIN
  EXEC('CREATE TRIGGER [dbo].[trg_Users_UpdateTimestamp] ON [dbo].[Users]
        AFTER UPDATE AS BEGIN SET NOCOUNT ON; UPDATE u SET UpdatedAt = SYSUTCDATETIME() FROM [dbo].[Users] u INNER JOIN inserted i ON u.Id = i.Id; END');
END
`;

  try {
    console.log(`[DATADB] Connecting ${config.server}:${config.port}/${config.database}`);
    await sql.connect(config);
    console.log('[DATADB] Connected');
    // Stepwise
    await sql.query("IF OBJECT_ID('dbo.Users','U') IS NULL BEGIN CREATE TABLE [dbo].[Users] ([Id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY, [Name] NVARCHAR(200) NOT NULL, [Email] NVARCHAR(320) NOT NULL, [Role] NVARCHAR(20) NOT NULL, [Status] NVARCHAR(20) NOT NULL, [PasswordHash] NVARCHAR(MAX) NULL, [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(), [UpdatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()); END");
    await sql.query("IF COL_LENGTH('dbo.Users','Role') IS NULL ALTER TABLE [dbo].[Users] ADD [Role] NVARCHAR(20) NOT NULL DEFAULT N'User'");
    await sql.query("IF COL_LENGTH('dbo.Users','Status') IS NULL ALTER TABLE [dbo].[Users] ADD [Status] NVARCHAR(20) NOT NULL DEFAULT N'Active'");
    await sql.query("IF COL_LENGTH('dbo.Users','PasswordHash') IS NULL ALTER TABLE [dbo].[Users] ADD [PasswordHash] NVARCHAR(MAX) NULL");
    await sql.query("IF COL_LENGTH('dbo.Users','CreatedAt') IS NULL ALTER TABLE [dbo].[Users] ADD [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()");
    await sql.query("IF COL_LENGTH('dbo.Users','UpdatedAt') IS NULL ALTER TABLE [dbo].[Users] ADD [UpdatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()");
    await sql.query("IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Users_Role') ALTER TABLE [dbo].[Users] ADD CONSTRAINT [CK_Users_Role] CHECK ([Role] IN (N'Admin', N'User'))");
    await sql.query("IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Users_Status') ALTER TABLE [dbo].[Users] ADD CONSTRAINT [CK_Users_Status] CHECK ([Status] IN (N'Active', N'Inactive'))");
    await sql.query("IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Users_Email' AND object_id = OBJECT_ID('dbo.Users')) CREATE UNIQUE INDEX [IX_Users_Email] ON [dbo].[Users]([Email])");
    // Remove problematic recursive trigger if present; we set UpdatedAt in application layer
    await sql.query("IF OBJECT_ID('dbo.trg_Users_UpdateTimestamp','TR') IS NOT NULL DROP TRIGGER [dbo].[trg_Users_UpdateTimestamp]");
    const check = await sql.query("SELECT TOP 1 * FROM [dbo].[Users]");
    console.log(`[DATADB] Users table ready. Sample rows: ${check.recordset.length}`);
  } catch (err) {
    console.error('[DATADB] Error creating Users table:', err.message || err);
    process.exitCode = 1;
  } finally {
    await sql.close();
  }
}

main();