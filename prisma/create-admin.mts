/**
 * إنشاء حساب أدمن رئيسي (أو إعادة تعيين كلمة مروره) من الطرفية:
 *   npm run admin:create
 * كلمة المرور لا تظهر على الشاشة أثناء الكتابة، ولا تُحفظ إلا مشفّرة (argon2id).
 */
import "dotenv/config";
import readline from "node:readline";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

// واجهة قراءة واحدة طوال التشغيل؛ في وضع الإخفاء تُستبدل الأحرف المكتوبة بنجوم
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
const internal = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
const originalWrite = internal._writeToOutput.bind(rl);
let masking: string | null = null;
internal._writeToOutput = (s: string) => {
  if (masking === null || s.includes(masking) || s === "\r\n" || s === "\n") originalWrite(s);
  else internal.output.write("*".repeat(s.length));
};

// نجمع الأسطر في طابور حتى لا يضيع أي إدخال أثناء انتظار قاعدة البيانات
const pending: string[] = [];
const waiters: Array<(line: string) => void> = [];
let closed = false;
rl.on("line", (line) => {
  const waiter = waiters.shift();
  if (waiter) waiter(line);
  else pending.push(line);
});
rl.on("close", () => {
  closed = true;
  while (waiters.length) waiters.shift()!("");
});

function ask(question: string, hidden = false): Promise<string> {
  masking = hidden ? question : null;
  rl.setPrompt(question);
  rl.prompt();
  return new Promise((resolve) => {
    const done = (line: string) => {
      masking = null;
      if (!process.stdin.isTTY) process.stdout.write("\n");
      resolve(line);
    };
    if (pending.length) done(pending.shift()!);
    else if (closed) done("");
    else waiters.push(done);
  });
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL غير موجود في ملف .env");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

  try {
    console.log("\nإنشاء حساب أدمن — Template Definition Requests\n");
    const username = (await ask("اسم المستخدم (أحرف إنجليزية وأرقام): ")).trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,50}$/.test(username)) {
      throw new Error("اسم المستخدم يجب أن يكون 3–50 حرفاً: a-z و 0-9 و . _ -");
    }

    const existing = await db.admin.findUnique({ where: { username } });
    if (existing) {
      const answer = (await ask(`الحساب «${username}» موجود. إعادة تعيين كلمة مروره؟ (y/n): `)).trim().toLowerCase();
      if (answer !== "y") {
        console.log("لم يتغير شيء.");
        return;
      }
    }

    const password = await ask("كلمة المرور (12 حرفاً على الأقل): ", true);
    if (password.length < 12) throw new Error("كلمة المرور قصيرة: 12 حرفاً على الأقل.");
    const confirm = await ask("أعد كتابة كلمة المرور: ", true);
    if (password !== confirm) throw new Error("كلمتا المرور غير متطابقتين.");

    const passwordHash = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });

    if (existing) {
      await db.admin.update({
        where: { id: existing.id },
        // تغيير كلمة المرور يلغي جلسات الدخول القديمة
        data: { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null, isActive: true },
      });
      console.log(`\n✔ تم تحديث كلمة مرور «${username}».`);
    } else {
      await db.admin.create({ data: { username, passwordHash, role: "SUPER_ADMIN", displayName: username } });
      console.log(`\n✔ تم إنشاء الأدمن «${username}». ادخل من /admin/login`);
    }
  } finally {
    rl.close();
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(`\n✖ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
