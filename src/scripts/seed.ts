import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLeaseService } from '@/lib/services/lease.service'
import { recordPaymentService, approvePaymentService } from '@/lib/services/payment.service'
import { MemberRole, PaymentMethod, ROLES, STORAGE } from '@/lib/constants'
import { AuthContext } from '@/lib/auth'

const SEED_PASSWORD = 'Password123!'

async function getOrCreateAuthUser(adminClient: ReturnType<typeof createAdminClient>, email: string) {
  // Check if user already exists
  const { data: listData } = await adminClient.auth.admin.listUsers()
  const existing = listData?.users.find((u) => u.email === email)

  if (existing) {
    return existing
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
  })

  if (error || !data.user) {
    throw new Error(`Failed to create auth user for ${email}: ${error?.message}`)
  }

  return data.user
}

async function uploadSeedSlip(adminClient: ReturnType<typeof createAdminClient>, orgId: string): Promise<string> {
  const filePath = `${orgId}/slips/seed-bank-slip.png`
  // 1x1 transparent PNG buffer
  const dummyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')

  const { error } = await adminClient.storage
    .from(STORAGE.PAYMENT_SLIPS_BUCKET)
    .upload(filePath, dummyPng, {
      contentType: 'image/png',
      upsert: true,
    })

  if (error) {
    console.warn(`Note: Could not upload seed slip to storage (${error.message}). Continuing...`)
  }

  return filePath
}

export async function runSeed() {
  console.log('🌱 Starting database seed...')
  const adminClient = createAdminClient()

  // 1. Create Organizations
  console.log('Creating organizations...')
  const northwind = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: { name: 'Northwind Properties' },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Northwind Properties',
    },
  })

  const beta = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: { name: 'Beta Realty' },
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Beta Realty',
    },
  })

  // 2. Create Auth Users and Memberships
  console.log('Creating auth accounts and memberships...')

  // Northwind Manager
  const nwManagerUser = await getOrCreateAuthUser(adminClient, 'manager@northwind.test')
  await prisma.membership.upsert({
    where: { userId: nwManagerUser.id },
    update: { orgId: northwind.id, role: MemberRole.manager },
    create: {
      userId: nwManagerUser.id,
      orgId: northwind.id,
      role: MemberRole.manager,
    },
  })

  // Northwind Staff
  const nwStaffUser = await getOrCreateAuthUser(adminClient, 'staff@northwind.test')
  await prisma.membership.upsert({
    where: { userId: nwStaffUser.id },
    update: { orgId: northwind.id, role: MemberRole.staff },
    create: {
      userId: nwStaffUser.id,
      orgId: northwind.id,
      role: MemberRole.staff,
    },
  })

  // Beta Manager
  const betaManagerUser = await getOrCreateAuthUser(adminClient, 'manager@beta.test')
  await prisma.membership.upsert({
    where: { userId: betaManagerUser.id },
    update: { orgId: beta.id, role: MemberRole.manager },
    create: {
      userId: betaManagerUser.id,
      orgId: beta.id,
      role: MemberRole.manager,
    },
  })

  // 3. Create Tenants
  console.log('Creating tenants...')

  // Aisyah Rahman (Northwind)
  const aisyahUser = await getOrCreateAuthUser(adminClient, 'aisyah@northwind.test')
  const aisyahTenant = await prisma.tenant.upsert({
    where: { userId: aisyahUser.id },
    update: { fullName: 'Aisyah Rahman', email: 'aisyah@northwind.test', phone: '+60123456789' },
    create: {
      orgId: northwind.id,
      userId: aisyahUser.id,
      fullName: 'Aisyah Rahman',
      email: 'aisyah@northwind.test',
      phone: '+60123456789',
    },
  })

  // Ben Lim (Northwind)
  const benUser = await getOrCreateAuthUser(adminClient, 'ben@northwind.test')
  const benTenant = await prisma.tenant.upsert({
    where: { userId: benUser.id },
    update: { fullName: 'Ben Lim', email: 'ben@northwind.test', phone: '+60123456780' },
    create: {
      orgId: northwind.id,
      userId: benUser.id,
      fullName: 'Ben Lim',
      email: 'ben@northwind.test',
      phone: '+60123456780',
    },
  })

  // Probe Tenant (Northwind)
  const probeUser = await getOrCreateAuthUser(adminClient, 'probe@northwind.test')
  const probeTenant = await prisma.tenant.upsert({
    where: { userId: probeUser.id },
    update: { fullName: 'Probe Tenant', email: 'probe@northwind.test', phone: '+60123456781' },
    create: {
      orgId: northwind.id,
      userId: probeUser.id,
      fullName: 'Probe Tenant',
      email: 'probe@northwind.test',
      phone: '+60123456781',
    },
  })

  // Chen Wei (Beta)
  const chenUser = await getOrCreateAuthUser(adminClient, 'chen@beta.test')
  const chenTenant = await prisma.tenant.upsert({
    where: { userId: chenUser.id },
    update: { fullName: 'Chen Wei', email: 'chen@beta.test', phone: '+60123456782' },
    create: {
      orgId: beta.id,
      userId: chenUser.id,
      fullName: 'Chen Wei',
      email: 'chen@beta.test',
      phone: '+60123456782',
    },
  })

  // 4. Create Units
  console.log('Creating units...')
  const unitA123 = await prisma.unit.upsert({
    where: { orgId_name: { orgId: northwind.id, name: 'A-12-3' } },
    update: {},
    create: { orgId: northwind.id, name: 'A-12-3' },
  })

  const unitB051 = await prisma.unit.upsert({
    where: { orgId_name: { orgId: northwind.id, name: 'B-05-1' } },
    update: {},
    create: { orgId: northwind.id, name: 'B-05-1' },
  })

  const unitC017 = await prisma.unit.upsert({
    where: { orgId_name: { orgId: northwind.id, name: 'C-01-7' } },
    update: {},
    create: { orgId: northwind.id, name: 'C-01-7' },
  })

  await prisma.unit.upsert({
    where: { orgId_name: { orgId: northwind.id, name: 'D-03-2' } },
    update: {},
    create: { orgId: northwind.id, name: 'D-03-2' },
  })

  const unitKL1 = await prisma.unit.upsert({
    where: { orgId_name: { orgId: beta.id, name: 'KL-1' } },
    update: {},
    create: { orgId: beta.id, name: 'KL-1' },
  })

  // 5. Create Leases through normal application code path (createLeaseService)
  console.log('Creating leases via createLeaseService...')
  const nwManagerAuth: AuthContext = {
    userId: nwManagerUser.id,
    email: 'manager@northwind.test',
    role: MemberRole.manager,
    orgId: northwind.id,
  }

  const betaManagerAuth: AuthContext = {
    userId: betaManagerUser.id,
    email: 'manager@beta.test',
    role: MemberRole.manager,
    orgId: beta.id,
  }

  // Check if Aisyah's lease exists
  let aisyahLease = await prisma.lease.findFirst({
    where: { unitId: unitA123.id, tenantId: aisyahTenant.id },
  })
  if (!aisyahLease) {
    aisyahLease = await createLeaseService(nwManagerAuth, {
      unitId: unitA123.id,
      tenantId: aisyahTenant.id,
      startDate: '2026-01-31',
      endDate: '2026-07-15',
      monthlyRentSen: 150000,
      depositSen: 300000,
    })
  }

  // Ben's lease
  const existingBenLease = await prisma.lease.findFirst({
    where: { unitId: unitB051.id, tenantId: benTenant.id },
  })
  if (!existingBenLease) {
    await createLeaseService(nwManagerAuth, {
      unitId: unitB051.id,
      tenantId: benTenant.id,
      startDate: '2026-01-01',
      endDate: '2026-04-15',
      monthlyRentSen: 100029,
      depositSen: 0,
    })
  }

  // Probe's lease
  const existingProbeLease = await prisma.lease.findFirst({
    where: { unitId: unitC017.id, tenantId: probeTenant.id },
  })
  if (!existingProbeLease) {
    await createLeaseService(nwManagerAuth, {
      unitId: unitC017.id,
      tenantId: probeTenant.id,
      startDate: '2026-02-28',
      endDate: '2027-02-27',
      monthlyRentSen: 200000,
      depositSen: 400000,
    })
  }

  // Chen Wei's lease (Beta)
  const existingChenLease = await prisma.lease.findFirst({
    where: { unitId: unitKL1.id, tenantId: chenTenant.id },
  })
  if (!existingChenLease) {
    await createLeaseService(betaManagerAuth, {
      unitId: unitKL1.id,
      tenantId: chenTenant.id,
      startDate: '2026-03-15',
      endDate: '2027-03-14',
      monthlyRentSen: 220000,
      depositSen: 440000,
    })
  }

  // 6. Payments on Aisyah's lease through normal application code paths
  console.log('Recording payments on Aisyah lease via payment service...')
  const existingPayments = await prisma.payment.findMany({
    where: { leaseId: aisyahLease.id },
  })

  if (existingPayments.length === 0) {
    // Payment 1: Cash, RM 3,000.00, received 2026-01-31 10:00 MYT (+08:00), recorded by manager -> approved immediately
    await recordPaymentService(nwManagerAuth, aisyahLease.id, {
      amountSen: 300000,
      method: PaymentMethod.cash,
      receivedAt: '2026-01-31T10:00:00+08:00',
      idempotencyKey: 'seed-payment-cash-aisyah',
    })

    // Payment 2: Bank transfer, RM 2,000.00, received 2026-03-01 00:30 MYT (+08:00), recorded by staff with slip, approved by manager
    const slipPath = await uploadSeedSlip(adminClient, northwind.id)

    const nwStaffAuth: AuthContext = {
      userId: nwStaffUser.id,
      email: 'staff@northwind.test',
      role: MemberRole.staff,
      orgId: northwind.id,
    }

    const staffPayment = await recordPaymentService(nwStaffAuth, aisyahLease.id, {
      amountSen: 200000,
      method: PaymentMethod.bank_transfer,
      receivedAt: '2026-03-01T00:30:00+08:00',
      slipPath,
      idempotencyKey: 'seed-payment-bank-aisyah',
    })

    // Manager approves the staff payment
    await approvePaymentService(nwManagerAuth, staffPayment.id)
  }

  console.log('✔ Seed completed successfully!')
  console.log(`🔑 All accounts initialized with password: "${SEED_PASSWORD}"`)
}

// Execute if run directly from CLI
if (require.main === module || process.argv[1]?.endsWith('seed.ts')) {
  runSeed()
    .then(async () => {
      await prisma.$disconnect()
      process.exit(0)
    })
    .catch(async (e) => {
      console.error('Seed failed:', e)
      await prisma.$disconnect()
      process.exit(1)
    })
}

