/**
 * Seeds working demo accounts for a deployment that has no PostgreSQL.
 *
 * The built-in user seed ships a PLACEHOLDER password hash, so no seeded account can actually
 * sign in — correct for production, unhelpful for a demo. With PostgreSQL attached the real
 * hashes live in the database and this script does nothing. Without it, the JSON store is the
 * only source of accounts and they are unusable.
 *
 * This script fills that gap using the SAME scheme the auth service verifies with
 * (`crypto.scrypt`, stored as `salt:hexDigest`), so the accounts it writes work through the
 * normal login path — no backdoor, no bypass, no special-case login branch.
 *
 * It is opt-in and refuses to run unless `SEED_DEMO_ACCOUNTS=true`, so a real deployment cannot
 * acquire well-known credentials by accident.
 *
 * Usage: node dist/scripts/seed-demo-accounts.js
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/** Must match AuthService.hashPassword exactly, or the login check will reject these hashes. */
function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plain, salt, 64);
  return `${salt}:${derived.toString('hex')}`;
}

interface SeedAccount {
  userId: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'HOD' | 'INSTRUCTOR' | 'STUDENT';
}

// One account per role, plus a second lecturer and student so the appeals and gradebook flows
// can be demonstrated with more than one participant.
const ACCOUNTS: SeedAccount[] = [
  { userId: 'ADMIN001', email: 'admin@aita.fpt.edu.vn', fullName: 'Hệ Thống Quản Trị AITA', role: 'ADMIN' },
  { userId: 'HOD001', email: 'hod@fe.edu.vn', fullName: 'Trưởng Bộ Môn', role: 'HOD' },
  { userId: 'GV0001', email: 'trungdt@fe.edu.vn', fullName: 'Đinh Thanh Trung', role: 'INSTRUCTOR' },
  { userId: 'GV0002', email: 'vinhnh@fe.edu.vn', fullName: 'Nguyễn Hoàng Vinh', role: 'INSTRUCTOR' },
  { userId: 'SE170000', email: 'trungse170000@fpt.edu.vn', fullName: 'Đinh Thành Trung', role: 'STUDENT' },
  { userId: 'SE170123', email: 'nguyentt@fpt.edu.vn', fullName: 'Trần Thanh Nguyên', role: 'STUDENT' },
];

function main(): void {
  if (process.env.SEED_DEMO_ACCOUNTS !== 'true') {
    console.log('[seed] SEED_DEMO_ACCOUNTS is not "true" — skipping demo account seeding.');
    return;
  }

  const password = process.env.DEMO_ACCOUNT_PASSWORD || 'Aita@2026';
  const dataDir = path.resolve(process.cwd(), 'data');
  const storePath = path.join(dataDir, 'users_store.json');

  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  let store: any[] = [];
  if (fs.existsSync(storePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      if (Array.isArray(parsed)) store = parsed;
    } catch {
      console.warn('[seed] existing users_store.json is unreadable; starting a fresh list');
    }
  }

  const byEmail = new Map(store.map((u) => [String(u.email).toLowerCase(), u]));
  let created = 0;
  let updated = 0;

  for (const account of ACCOUNTS) {
    const key = account.email.toLowerCase();
    const existing = byEmail.get(key);
    // A fresh salt per run means the stored hash changes, which is correct: the same password
    // must never produce the same digest twice.
    const passwordHash = hashPassword(password);

    if (existing) {
      existing.passwordHash = passwordHash;
      existing.role = account.role;
      existing.fullName = account.fullName;
      existing.isActive = true;
      existing.updatedAt = new Date().toISOString();
      updated++;
    } else {
      const now = new Date().toISOString();
      const record = {
        userId: account.userId,
        email: account.email,
        fullName: account.fullName,
        role: account.role,
        passwordHash,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      store.push(record);
      byEmail.set(key, record);
      created++;
    }
  }

  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
  console.log(
    `[seed] demo accounts ready: ${created} created, ${updated} refreshed, ${store.length} total`,
  );
  console.log(`[seed] password for every demo account: ${password}`);
}

main();
