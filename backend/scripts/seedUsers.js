require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const { connectDatabase } = require('../src/config/database');
const User = require('../src/models/User');

const users = [
  {
    fullName: 'System Admin',
    email: 'admin@recons.local',
    password: 'Admin@123',
    role: 'admin',
  },
  {
    fullName: 'Ops Analyst',
    email: 'analyst@recons.local',
    password: 'Analyst@123',
    role: 'analyst',
  },
  {
    fullName: 'Read Only Viewer',
    email: 'viewer@recons.local',
    password: 'Viewer@123',
    role: 'viewer',
  },
];

async function seed() {
  await connectDatabase(process.env.MONGO_URI);

  for (const user of users) {
    const existing = await User.findOne({ email: user.email });
    const passwordHash = await bcrypt.hash(user.password, 10);

    if (!existing) {
      await User.create({
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        passwordHash,
      });
      // eslint-disable-next-line no-console
      console.log(`Created ${user.role}: ${user.email}`);
    } else {
      existing.fullName = user.fullName;
      existing.role = user.role;
      existing.passwordHash = passwordHash;
      await existing.save();
      // eslint-disable-next-line no-console
      console.log(`Updated ${user.role}: ${user.email}`);
    }
  }

  // eslint-disable-next-line no-console
  console.log('User seed complete.');
  process.exit(0);
}

seed().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
