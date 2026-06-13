import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  // Admin
  const admin = await prisma.employee.upsert({
    where: { email: 'admin@dentalcare.com' },
    update: {},
    create: {
      email: 'admin@dentalcare.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'System',
      documentId: '00000000',
      role: 'ADMIN',
    }
  });

  // Doctor
  const doctor = await prisma.employee.upsert({
    where: { email: 'doctor@dentalcare.com' },
    update: {},
    create: {
      email: 'doctor@dentalcare.com',
      password: hashedPassword,
      firstName: 'Juan',
      lastName: 'Pérez',
      documentId: '11111111',
      role: 'DOCTOR',
      licenseNumber: 'COL-OD-001',
    }
  });

  const ortodoncia = await prisma.specialty.upsert({
    where: { name: 'Ortodoncia' },
    update: {},
    create: { name: 'Ortodoncia', description: 'Corrección de posición dental y mordida.' }
  });

  await prisma.employee.update({
    where: { id: doctor.id },
    data: { specialties: { connect: { id: ortodoncia.id } } }
  }).catch(() => undefined);

  const responsable = await prisma.responsible.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      firstName: 'Ana',
      lastName: 'García',
      relationship: 'Madre',
      phone: '555-0101',
      email: 'ana@example.com',
      documentNumber: '0801199000012'
    }
  });

  // Procedure Types
  await prisma.procedureType.upsert({
    where: { name: 'Limpieza Dental' },
    update: {},
    create: { name: 'Limpieza Dental', price: 50.0, description: 'Limpieza profunda de sarro y placa.' }
  });

  // Patient
  const patient = await prisma.patient.upsert({
    where: { documentNumber: '12345678' },
    update: {},
    create: {
      firstName: 'María',
      lastName: 'García',
      documentType: 'DNI',
      documentNumber: '12345678',
      birthDate: new Date('1990-05-15'),
      gender: 'Femenino',
      phone: '555-0199',
      email: 'maria@example.com',
      doctorId: doctor.id,
      responsibleId: responsable.id
    }
  });

  // Appointment
  await prisma.appointment.create({
    data: {
      date: new Date(),
      type: 'CONSULTATION',
      description: 'Revisión general',
      patientId: patient.id,
      doctorId: doctor.id,
      status: 'SCHEDULED',
      startTime: '09:00',
      endTime: '09:30',
      durationMinutes: 30
    }
  });

  await prisma.inventoryItem.upsert({
    where: { name: 'Guantes de látex' },
    update: {},
    create: { name: 'Guantes de látex', quantityAvailable: 100, minimumStock: 20, unitOfMeasure: 'caja', description: 'Guantes para atención clínica.' }
  });

  await prisma.clinicalHistory.create({
    data: {
      patientId: patient.id,
      odontologistId: doctor.id,
      diagnosis: 'Revisión inicial sin complicaciones graves',
      treatmentPerformed: 'Evaluación general y limpieza recomendada',
      observations: 'Paciente sin dolor agudo.'
    }
  });

  console.log('Seed completed. Usuarios: admin@dentalcare.com / admin123 y doctor@dentalcare.com / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
