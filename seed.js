const prisma = require('./config/prisma')
const bcrypt = require('bcryptjs')

async function main() {
  const email = 'admin@tablebook.com'
  const password = 'admin@123'

  // Check already exists
  const existing = await prisma.user.findUnique({
    where: { email }
  })

  if (existing) {
    console.log('Admin already exists!')
    return
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  await prisma.user.create({
    data: {
      name: 'Super Admin',
      email,
      password: hashedPassword,
      role: 'admin',
      phone: '03000000000'
    }
  })

  console.log('✅ Admin created successfully!')
  console.log('Email:', email)
  console.log('Password:', password)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())