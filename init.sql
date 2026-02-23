CREATE DATABASE flowable;
CREATE DATABASE tazama_dwh;
CREATE DATABASE tazama_cms;

-- npx prisma migrate dev --schema=prismaDWH/schema.dwh.prisma
-- npx prisma migrate dev --name init


-- npx prisma generate --schema=prismaDWH/schema.dwh.prisma