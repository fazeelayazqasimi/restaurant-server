const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash('admin@123', 10)
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@tablebook.com' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@tablebook.com',
      password: hashedPassword,
      phone: '9999999999',
      role: 'admin',
      isApproved: true,
      isVerified: true
    }
  })
  
  console.log('✅ Admin user created:', admin.email)
}

main()
  .catch(e => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })