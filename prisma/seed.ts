import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const Role = {
  PRODUCT_MANAGER: 'PRODUCT_MANAGER',
  UI_UX: 'UI_UX',
  FRONTEND: 'FRONTEND',
  BACKEND: 'BACKEND',
  CLIENT: 'CLIENT',
} as const;

const Department = {
  MANAGEMENT: 'MANAGEMENT',
  DESIGN: 'DESIGN',
  FRONTEND: 'FRONTEND',
  BACKEND: 'BACKEND',
  CLIENT: 'CLIENT',
} as const;

const ProjectStatus = {
  ACTIVE: 'ACTIVE',
  ON_HOLD: 'ON_HOLD',
} as const;

const TaskStatus = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  BLOCKED: 'BLOCKED',
  DONE: 'DONE',
} as const;

const Priority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data (in order due to FK constraints)
  await prisma.auditLog.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.taskDependency.deleteMany();
  await prisma.task.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  console.log('📝 Creating users...');

  const hashedPassword = await hashPassword('password123');

  // Create Users
  const pm = await prisma.user.create({
    data: {
      email: 'pm@projectflow.com',
      name: 'Sarah Johnson',
      password: hashedPassword,
      role: Role.PRODUCT_MANAGER,
      department: Department.MANAGEMENT,
    },
  });

  const uiux = await prisma.user.create({
    data: {
      email: 'uiux@projectflow.com',
      name: 'Alex Chen',
      password: hashedPassword,
      role: Role.UI_UX,
      department: Department.DESIGN,
    },
  });

  const frontendDev = await prisma.user.create({
    data: {
      email: 'frontend@projectflow.com',
      name: 'Mike Rivera',
      password: hashedPassword,
      role: Role.FRONTEND,
      department: Department.FRONTEND,
    },
  });

  const backendDev = await prisma.user.create({
    data: {
      email: 'backend@projectflow.com',
      name: 'Diana Park',
      password: hashedPassword,
      role: Role.BACKEND,
      department: Department.BACKEND,
    },
  });

  const client = await prisma.user.create({
    data: {
      email: 'client@projectflow.com',
      name: 'John Smith',
      password: hashedPassword,
      role: Role.CLIENT,
      department: Department.CLIENT,
    },
  });

  const client2 = await prisma.user.create({
    data: {
      email: 'client2@projectflow.com',
      name: 'Emily Davis',
      password: hashedPassword,
      role: Role.CLIENT,
      department: Department.CLIENT,
    },
  });

  console.log('📁 Creating projects...');

  // Create Projects
  const project1 = await prisma.project.create({
    data: {
      name: 'E-Commerce Platform',
      description: 'Full-stack e-commerce platform with payment integration, product catalog, and order management.',
      status: ProjectStatus.ACTIVE,
      clientId: client.id,
    },
  });

  const project2 = await prisma.project.create({
    data: {
      name: 'Healthcare Dashboard',
      description: 'Real-time healthcare monitoring dashboard for patient data visualization and analytics.',
      status: ProjectStatus.ACTIVE,
      clientId: client.id,
    },
  });

  const project3 = await prisma.project.create({
    data: {
      name: 'Social Media App',
      description: 'Mobile-first social media application with real-time messaging and content sharing.',
      status: ProjectStatus.ON_HOLD,
      clientId: client2.id,
    },
  });

  console.log('👥 Creating project members...');

  // Add members to projects
  const memberData = [
    // Project 1: E-Commerce - all team members
    { projectId: project1.id, userId: pm.id },
    { projectId: project1.id, userId: uiux.id },
    { projectId: project1.id, userId: frontendDev.id },
    { projectId: project1.id, userId: backendDev.id },
    // Project 2: Healthcare - PM + Backend + Frontend
    { projectId: project2.id, userId: pm.id },
    { projectId: project2.id, userId: frontendDev.id },
    { projectId: project2.id, userId: backendDev.id },
    // Project 3: Social Media - PM + UI/UX
    { projectId: project3.id, userId: pm.id },
    { projectId: project3.id, userId: uiux.id },
  ];

  for (const member of memberData) {
    await prisma.projectMember.create({ data: member });
  }

  console.log('✅ Creating tasks...');

  // ========== Project 1 Tasks: E-Commerce ==========
  // Dependency chain: UI Design → Backend API → Frontend Slicing → Testing

  const task1 = await prisma.task.create({
    data: {
      title: 'UI Design - Product Pages',
      description: 'Design product listing, detail, and cart pages with responsive layouts.',
      status: TaskStatus.DONE,
      priority: Priority.HIGH,
      department: Department.DESIGN,
      assigneeId: uiux.id,
      projectId: project1.id,
      clientVisible: true,
      dueDate: new Date('2026-09-20'),
    },
  });

  const task2 = await prisma.task.create({
    data: {
      title: 'Backend API - Product CRUD',
      description: 'Implement REST API for product management: CRUD operations, search, and filtering.',
      status: TaskStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      department: Department.BACKEND,
      assigneeId: backendDev.id,
      projectId: project1.id,
      clientVisible: true,
      dueDate: new Date('2026-09-25'),
    },
  });

  const task3 = await prisma.task.create({
    data: {
      title: 'Frontend Slicing - Product Pages',
      description: 'Implement frontend components for product pages based on UI design.',
      status: TaskStatus.BLOCKED,
      priority: Priority.HIGH,
      department: Department.FRONTEND,
      assigneeId: frontendDev.id,
      projectId: project1.id,
      clientVisible: true,
      dueDate: new Date('2026-10-01'),
    },
  });

  const task4 = await prisma.task.create({
    data: {
      title: 'Integration Testing - Product Flow',
      description: 'End-to-end testing of product listing, detail view, and cart functionality.',
      status: TaskStatus.BLOCKED,
      priority: Priority.MEDIUM,
      department: Department.BACKEND,
      assigneeId: backendDev.id,
      projectId: project1.id,
      clientVisible: false, // Internal only
      dueDate: new Date('2026-10-05'),
    },
  });

  const task5 = await prisma.task.create({
    data: {
      title: 'Payment Gateway Integration',
      description: 'Integrate Stripe payment gateway for checkout process.',
      status: TaskStatus.TODO,
      priority: Priority.CRITICAL,
      department: Department.BACKEND,
      assigneeId: backendDev.id,
      projectId: project1.id,
      clientVisible: true,
      dueDate: new Date('2026-10-10'),
    },
  });

  const task6 = await prisma.task.create({
    data: {
      title: 'UI Design - Checkout Flow',
      description: 'Design checkout, payment, and order confirmation pages.',
      status: TaskStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      department: Department.DESIGN,
      assigneeId: uiux.id,
      projectId: project1.id,
      clientVisible: true,
      dueDate: new Date('2026-09-22'),
    },
  });

  const task7 = await prisma.task.create({
    data: {
      title: 'Database Schema Review',
      description: 'Review and optimize database schema for performance.',
      status: TaskStatus.DONE,
      priority: Priority.LOW,
      department: Department.BACKEND,
      assigneeId: backendDev.id,
      projectId: project1.id,
      clientVisible: false, // Internal only
      dueDate: new Date('2026-09-15'),
    },
  });

  // ========== Project 2 Tasks: Healthcare Dashboard ==========

  const task8 = await prisma.task.create({
    data: {
      title: 'Patient Data API',
      description: 'Build secure API endpoints for patient data retrieval and management.',
      status: TaskStatus.TODO,
      priority: Priority.CRITICAL,
      department: Department.BACKEND,
      assigneeId: backendDev.id,
      projectId: project2.id,
      clientVisible: true,
      dueDate: new Date('2026-09-30'),
    },
  });

  const task9 = await prisma.task.create({
    data: {
      title: 'Dashboard Charts - Vitals',
      description: 'Implement real-time charts for patient vital signs monitoring.',
      status: TaskStatus.BLOCKED,
      priority: Priority.HIGH,
      department: Department.FRONTEND,
      assigneeId: frontendDev.id,
      projectId: project2.id,
      clientVisible: true,
      dueDate: new Date('2026-10-05'),
    },
  });

  const task10 = await prisma.task.create({
    data: {
      title: 'Security Audit - HIPAA Compliance',
      description: 'Conduct security audit for HIPAA compliance requirements.',
      status: TaskStatus.TODO,
      priority: Priority.CRITICAL,
      department: Department.BACKEND,
      assigneeId: backendDev.id,
      projectId: project2.id,
      clientVisible: false, // Internal only
      dueDate: new Date('2026-10-15'),
    },
  });

  console.log('🔗 Creating task dependencies...');

  // Dependency chain: UI Design → Backend API → Frontend Slicing → Testing
  await prisma.taskDependency.create({
    data: { taskId: task2.id, dependsOnTaskId: task1.id }, // Backend API depends on UI Design
  });

  await prisma.taskDependency.create({
    data: { taskId: task3.id, dependsOnTaskId: task2.id }, // Frontend depends on Backend API
  });

  await prisma.taskDependency.create({
    data: { taskId: task4.id, dependsOnTaskId: task3.id }, // Testing depends on Frontend
  });

  await prisma.taskDependency.create({
    data: { taskId: task4.id, dependsOnTaskId: task2.id }, // Testing also depends on Backend API
  });

  // Healthcare: Dashboard depends on Patient API
  await prisma.taskDependency.create({
    data: { taskId: task9.id, dependsOnTaskId: task8.id },
  });

  console.log('📋 Creating audit logs...');

  // Audit logs
  await prisma.auditLog.create({
    data: {
      taskId: task1.id,
      userId: pm.id,
      action: 'CREATE',
      changedColumn: null,
      oldValue: null,
      newValue: 'Task created',
    },
  });

  await prisma.auditLog.create({
    data: {
      taskId: task1.id,
      userId: uiux.id,
      action: 'STATUS_CHANGE',
      changedColumn: 'status',
      oldValue: 'TODO',
      newValue: 'IN_PROGRESS',
    },
  });

  await prisma.auditLog.create({
    data: {
      taskId: task1.id,
      userId: uiux.id,
      action: 'STATUS_CHANGE',
      changedColumn: 'status',
      oldValue: 'IN_PROGRESS',
      newValue: 'DONE',
    },
  });

  await prisma.auditLog.create({
    data: {
      taskId: task2.id,
      userId: pm.id,
      action: 'CREATE',
      changedColumn: null,
      oldValue: null,
      newValue: 'Task created',
    },
  });

  await prisma.auditLog.create({
    data: {
      taskId: task2.id,
      userId: backendDev.id,
      action: 'STATUS_CHANGE',
      changedColumn: 'status',
      oldValue: 'TODO',
      newValue: 'IN_PROGRESS',
    },
  });

  await prisma.auditLog.create({
    data: {
      taskId: task7.id,
      userId: pm.id,
      action: 'UPDATE',
      changedColumn: 'priority',
      oldValue: 'MEDIUM',
      newValue: 'LOW',
    },
  });

  console.log('✅ Seed completed successfully!');
  console.log('');
  console.log('Demo Accounts:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Product Manager:  pm@projectflow.com / password123');
  console.log('UI/UX Designer:   uiux@projectflow.com / password123');
  console.log('Frontend Dev:     frontend@projectflow.com / password123');
  console.log('Backend Dev:      backend@projectflow.com / password123');
  console.log('Client:           client@projectflow.com / password123');
  console.log('Client 2:         client2@projectflow.com / password123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

