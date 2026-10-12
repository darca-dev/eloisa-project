import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

function windowsAcl(target) {
  const script = '$a=Get-Acl -LiteralPath $env:MERDN_PRIVATE_PATH; @{owner=$a.GetOwner([System.Security.Principal.SecurityIdentifier]).Value;user=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value;rules=@($a.Access | ForEach-Object { @{sid=$_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value;type=$_.AccessControlType.ToString()} })} | ConvertTo-Json -Depth 4 -Compress';
  return JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { env: { ...process.env, MERDN_PRIVATE_PATH: target } }).toString());
}

export async function assertPrivateFile(target) {
  const stat = await fs.lstat(target);
  if (stat.isSymbolicLink()) throw new Error('Private path cannot be a link');
  if (process.platform === 'win32') {
    const acl = windowsAcl(target);
    const allowed = new Set([acl.user, 'S-1-5-18', 'S-1-5-32-544']);
    if (acl.owner !== acl.user || acl.rules.some(rule => rule.type === 'Allow' && !allowed.has(rule.sid))) throw new Error('Private ACL required');
  } else if (stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0) throw new Error('Private permissions required');
}

export async function securePrivateDirectory(directory) {
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  if (process.platform === 'win32') {
    const { user } = windowsAcl(directory);
    execFileSync('icacls.exe', [directory, '/inheritance:r', '/grant:r', `*${user}:(OI)(CI)F`, '*S-1-5-18:(OI)(CI)F', '*S-1-5-32-544:(OI)(CI)F']);
  } else await fs.chmod(directory, 0o700);
  await assertPrivateFile(directory);
}

/** Daemon-wide persistent mutex, shared by every OS user and checkout. */
export async function acquireMaintenanceLock(docker, key) {
  if (!/^[a-f0-9]{64}$/u.test(key)) throw new Error('Exact daemon/project lock key required');
  const token = randomUUID();
  const name = `merdn-identity-maintenance-${key}`;
  // docker create is atomic across users. This container is NEVER started.
  const id = docker(['create', '--name', name, '--network', 'none', '--read-only', '--entrypoint', '/bin/true',
    '--label', 'com.merdn.scope=identity-maintenance', '--label', `com.merdn.maintenance-token=${token}`,
    '--label', `com.merdn.operator-pid=${process.pid}`, '--label', `com.merdn.created-at=${new Date().toISOString()}`,
    'postgres:17.6-alpine']).toString().trim();
  const assertOwned = async () => {
    const current = JSON.parse(docker(['inspect', name]))[0];
    if (current.Id !== id || current.State.Running || current.State.Status !== 'created'
      || current.Config.Labels['com.merdn.scope'] !== 'identity-maintenance'
      || current.Config.Labels['com.merdn.maintenance-token'] !== token) throw new Error('Maintenance mutex ownership lost');
  };
  return { name, id, assertOwned, async release() { await assertOwned(); docker(['rm', id]); } };
}
