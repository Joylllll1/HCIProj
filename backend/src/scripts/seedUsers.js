import User from '../models/User.js';

const USERS = [
  { email: 'admin@nju.edu.cn', password: '12345678', role: 'admin' },
  { email: 'test@nju.edu.cn', password: '12345678', role: 'user' },
];

export async function seedUsers() {
  for (const { email, password, role } of USERS) {
    const existing = await User.findOne({ email });
    if (existing) {
      if (existing.role !== role) {
        existing.role = role;
        await existing.save();
        console.log(`Updated role for ${email} to "${role}"`);
      } else {
        console.log(`User ${email} already exists (role: ${existing.role})`);
      }
    } else {
      await User.create({ email, password, role });
      console.log(`Created user ${email} (role: ${role})`);
    }
  }
}

// Direct execution
if (process.argv[1]?.includes('seedUsers')) {
  const { default: connectDB } = await import('../config/db.js');
  await connectDB();
  await seedUsers();
  process.exit(0);
}
