// @ts-nocheck
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Bypass the pool entirely and use the DIRECT_URL that we know works perfectly!
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL!, 
    },
  }
})
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Bypass the pool entirely and use the DIRECT_URL that we know works perfectly!
// Bypass the pool entirely and use the DIRECT_URL that we know works perfectly!
const prisma = new PrismaClient({
  // @ts-ignore
  datasources: {
    db: {
      url: process.env.DIRECT_URL!, // <-- Add the exclamation mark right here
    },
  },
});

async function main() {
  console.log('Starting to seed Block 5 rooms...');

  // --- 1. GROUND FLOOR ---
  const groundProf = ['005', '006', '007', '008'].map((room) => ({ room: room, type: 'Professor Room', floor: 'Ground', capacity: 1 }));
  const groundClass = ['12', '13', '14', '15', '16', '17', '18', '22', '24', '25', '26', '27'].map((room) => ({ room: room, type: 'Classroom', floor: 'Ground', capacity: 80 }));

  // --- 2. FIRST FLOOR ---
  const firstProf = ['108', '107', '109', '106', '105', '110', '111', '104', '117', '118', '120', '121', '122', '123', '124', '125', '132', '131', '134', '135', '136', '137', '139', '140'].map((room) => ({ room: room, type: 'Professor Room', floor: 'First', capacity: 1 }));
  const firstLab = ['115', '128', '129', '130', '133', '138', '101', '102', '103'].map((room) => ({ room: room, type: 'Lab', floor: 'First', capacity: 60 }));
  const firstClass = ['116', '119', '127'].map((room) => ({ room: room, type: 'Classroom', floor: 'First', capacity: 80 }));

  // --- 3. SECOND FLOOR ---
  const secondProf = ['208', '207', '209', '206', '205', '204', '210', '211'].map((room) => ({ room: room, type: 'Professor Room', floor: 'Second', capacity: 1 }));
  const secondLab = ['219', '201', '202', '203'].map((room) => ({ room: room, type: 'Lab', floor: 'Second', capacity: 60 }));
  const secondClass = ['215', '216', '217', '218', '220', '221', '222'].map((room) => ({ room: room, type: 'Classroom', floor: 'Second', capacity: 80 }));

  // --- 4. THIRD FLOOR ---
  const thirdLab = ['309'].map((room) => ({ room: room, type: 'Lab', floor: 'Third', capacity: 60 }));
  const thirdClass = ['301', '305', '306', '307', '308', '310', '311', '312'].map((room) => ({ room: room, type: 'Classroom', floor: 'Third', capacity: 80 }));

  // Combine all rooms into one master array
  const allRooms = [
    ...groundProf, ...groundClass,
    ...firstProf, ...firstLab, ...firstClass,
    ...secondProf, ...secondLab, ...secondClass,
    ...thirdLab, ...thirdClass
  ];

  // Loop through and upsert each room into Supabase
  for (const item of allRooms) {
    const fullName = `Block 5 - ${item.room}`;

    await prisma.room.upsert({
      where: { name: fullName },
      update: {}, // Do nothing if it already exists
      create: {
        name: fullName,
        building: 'Block 5',
        floor: item.floor, 
        capacity: item.capacity,
        latitude: 0.0,
        longitude: 0.0,
        status: 'AVAILABLE', 
      },
    });
  }

  console.log(`✅ Successfully seeded ${allRooms.length} rooms for Block 5!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });